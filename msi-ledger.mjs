/* Brújula v1.15.2 · Solo gastos de MSI vinculados explícitamente a pagos reales.
 * Un cargo MSI mostrado aquí NO se agrega a state.movements ni a la deuda.
 * Las compras originales MSI (históricas o nuevas) ya están incluidas en el
 * saldo inicial o en su movimiento de compra original. */
import {addMonths,monthlyDate} from './planning-rules.mjs';
import {installmentAmount} from './msi-payment-link.mjs';
const money=n=>Math.round((Number(n)||0)*100)/100;
export const monthLabel=month=>new Date(month+'-15T12:00:00').toLocaleDateString('es-MX',{month:'short',year:'numeric'});
const validMonth=month=>/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month||''));
export function scheduledMsiEntries(state,asOf,accountId=null){
 // Solo generar gasto cuando el usuario haya VINCULADO esa mensualidad a un pago bancario real.
 // Nunca crear cargos por el calendario del plan ni por contador de mensualidades pagadas.
 const plans=new Map((state.installments||[]).map(p=>[String(p.id),p]));
 const payments=new Map((state.movements||[]).filter(m=>m.kind==='payment').map(m=>[String(m.id),m]));
 const result=[];
 for(const link of state.msi_payment_links||[]){
  const plan=plans.get(String(link.installment_id));
  const payment=payments.get(String(link.payment_movement_id));
  if(!plan||!payment||plan.account_id!==payment.account_id)continue;
  if(accountId&&plan.account_id!==accountId)continue;
  const date=String(payment.transaction_date||'');
  if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)||date>asOf)continue;
  const n=Number(link.installment_number),months=Number(plan.months);
  if(!Number.isInteger(n)||n<1||n>months)continue;
  const amount=money(link.allocated_amount);
  if(!(amount>0))continue;
  result.push({id:'msi-linked-expense:'+String(link.id||plan.id+':'+n),
   account_id:plan.account_id,transaction_date:date,cycle_month:date.slice(0,7),
   kind:'msi_expense',amount,category:'Meses sin intereses',
   description:'Gasto MSI · '+(plan.description||'Plan MSI')+' · mensualidad '+n+' de '+months,
   msi_plan_id:plan.id,installment_number:n,installment_total:months,
   linked:true,virtual:true,status:'Gasto registrado al vincular el pago',
   payment_movement_id:payment.id,
   note:'Asociado al pago real, sin generar un segundo cargo bancario ni duplicar la deuda.'});
 }
 return result.sort((a,b)=>b.transaction_date.localeCompare(a.transaction_date)||b.installment_number-a.installment_number);
}
export function msiPaymentAssignments(state,paymentId){
 return (state.msi_payment_links||[]).filter(l=>l.payment_movement_id===paymentId)
  .map(l=>{
   const plan=(state.installments||[]).find(p=>p.id===l.installment_id);
   return {planName:plan?.description||'Plan MSI',number:Number(l.installment_number),
    months:Number(plan?.months)||null,amount:money(l.allocated_amount)};
  });
}
export function msiPaymentSummary(state,movement){
 if(movement.kind!=='payment')return '';
 const items=msiPaymentAssignments(state,movement.id);
 return items.map(x=>x.planName+' · mensualidad '+x.number+(x.months?' de '+x.months:'')).join(' · ');
}
export function ledgerEntries(state,asOf,accountId=null,kind='all'){
 const recorded=(state.movements||[]).filter(m=>
  (!accountId||m.account_id===accountId)&&
  (kind==='all'||kind==='msi_schedule'?kind!=='msi_schedule':m.kind===kind));
 const msis=kind==='all'||kind==='msi_schedule'?scheduledMsiEntries(state,asOf,accountId):[];
 return [...recorded,...msis].sort((a,b)=>{
  const da=a.transaction_date,db=b.transaction_date;
  return String(db||'').localeCompare(String(da||''))||
    Number(Boolean(b.virtual))-Number(Boolean(a.virtual))||
    String(b.created_at||b.id||'').localeCompare(String(a.created_at||a.id||''));
 });
}
