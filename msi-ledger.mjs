/* Brújula v1.15.1 · Extracto MSI informativo por tarjeta.
 * Un cargo MSI mostrado aquí NO se agrega a state.movements ni a la deuda.
 * Las compras originales MSI (históricas o nuevas) ya están incluidas en el
 * saldo inicial o en su movimiento de compra original. */
import {addMonths,monthlyDate} from './planning-rules.mjs';
import {installmentAmount} from './msi-payment-link.mjs';
const money=n=>Math.round((Number(n)||0)*100)/100;
export const monthLabel=month=>new Date(month+'-15T12:00:00').toLocaleDateString('es-MX',{month:'short',year:'numeric'});
const validMonth=month=>/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month||''));
export function scheduledMsiEntries(state,asOf,accountId=null){
 const current=String(asOf||'').slice(0,7),result=[];
 if(!validMonth(current))return result;
 for(const plan of state.installments||[]){
  if(accountId&&plan.account_id!==accountId)continue;
  if(plan.status==='cancelled')continue;
  const first=String(plan.first_charge_month||'').slice(0,7);
  if(!validMonth(first))continue;
  const account=(state.accounts||[]).find(a=>a.id===plan.account_id);
  if(!account||account.kind!=='credit')continue;
  const totalMonths=Math.min(120,Math.max(0,Number(plan.months)||0));
  const paidCount=Math.min(totalMonths,Math.max(0,Number(plan.installments_paid)||0));
  for(let i=0;i<totalMonths;i++){
   const month=addMonths(first,i);
   if(month>current)break;
   const amount=money(installmentAmount(plan,i));
   const links=(state.msi_payment_links||[]).filter(l=>l.installment_id===plan.id&&Number(l.installment_number)===i+1);
   const linked=links.length>0;
   const nominalDay=Number(account.cutoff_day);
   const date=Number.isInteger(nominalDay)&&nominalDay>=1&&nominalDay<=31?
    monthlyDate(month,nominalDay):month+'-01';
   const paid=linked||i<paidCount;
   const label='Cargo MSI previsto · '+(plan.description||'Plan MSI')+' · '+(i+1)+' de '+totalMonths;
   result.push({id:'msi-schedule:'+plan.id+':'+(i+1),account_id:account.id,
    transaction_date:date,cycle_month:month,kind:'msi_schedule',amount,
    category:'Meses sin intereses',description:label,msi_plan_id:plan.id,
    installment_number:i+1,installment_total:totalMonths,
    linked,paid,virtual:true,categoryLabel:'MSI',status:linked?'Pago vinculado':paid?'Marcada pagada':'Por confirmar',
    note:'Cargo mensual previsto según tu plan, no movimiento bancario confirmado. Ya incluido en el saldo de la compra original; no modifica deuda ni disponible.'});
  }
 }
 return result.sort((a,b)=>b.cycle_month.localeCompare(a.cycle_month)||b.installment_number-a.installment_number);
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
  const da=a.virtual?a.cycle_month:a.transaction_date,db=b.virtual?b.cycle_month:b.transaction_date;
  return String(db||'').localeCompare(String(da||''))||
    Number(Boolean(b.virtual))-Number(Boolean(a.virtual))||
    String(b.created_at||b.id||'').localeCompare(String(a.created_at||a.id||''));
 });
}
