/* Brújula v1.15 · conciliación mensual estilo Excel, sin registrar deuda adicional.
   Calcula exclusivamente a partir de datos capturados; el estado de cuenta prevalece.
*/
import {addMonths,monthlyDate,cash} from './planning-rules.mjs';
import {cycleDates} from './card-cycle.mjs';
import {installmentAmount} from './msi-payment-link.mjs';
import {paymentPending} from './finance-rules.mjs';
import {scheduledMsiEntries} from './msi-ledger.mjs';
const asCents=n=>Math.round((Number(n)||0)*100);
const valid=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||''));
const purchaseKinds=new Set(['purchase','fee','interest','adjustment_plus']);
const creditKinds=new Set(['refund','adjustment_minus']);
export function cycleWindow(card,closeMonth,statement=null){
 if(!/^\d{4}-\d{2}$/.test(String(closeMonth||'')))return null;
 const day=Number(card.cutoff_day);
 if(!Number.isInteger(day)||day<1||day>31)return null;
 const cutoff=valid(statement?.close_date)?statement.close_date:monthlyDate(closeMonth,day);
 const prev=monthlyDate(addMonths(closeMonth,-1),day);
 const start=valid(statement?.period_start)?statement.period_start:null;
 return {month:closeMonth,startExclusive:start?null:prev,startInclusive:start,end:cutoff,
   periodDescription:start?'Periodo bancario capturado':'Periodo estimado por día de corte'};
}
export function cycleMonthsFor(card,asOf,{back=2,ahead=2}={}){
 if(!Number.isInteger(Number(card?.cutoff_day))||Number(card.cutoff_day)<1||Number(card.cutoff_day)>31)return [];
 const now=asOf.slice(0,7),closeThis=monthlyDate(now,Number(card.cutoff_day));
 const reference=asOf>closeThis?addMonths(now,1):now;
 const result=[];
 for(let i=-back;i<=ahead;i++)result.push(addMonths(reference,i));
 return result;
}
function monthIndex(start,end){
 const a=String(start||'').slice(0,7),b=String(end||'').slice(0,7);
 if(!/^\d{4}-\d{2}$/.test(a)||!/^\d{4}-\d{2}$/.test(b))return -1;
 const [ay,am]=a.split('-').map(Number),[by,bm]=b.split('-').map(Number);
 return (by-ay)*12+bm-am;
}
export function estimatedCycle(state,card,closeMonth,asOf){
 const availableStatements=(state.statements||[]).filter(s=>s.account_id===card.id&&
   s.close_date?.startsWith(closeMonth)&&s.close_date<=asOf).sort((a,b)=>b.close_date.localeCompare(a.close_date));
 const official=availableStatements[0]||null,window=cycleWindow(card,closeMonth,official);
 if(!window)return null;
 const schedule=cycleDates(card,closeMonth);
 const ended=window.end<=asOf;
 // Recorded transactions use the posting date when supplied; do not count future postings.
 const linkedMsis=new Set((state.installments||[]).filter(p=>p.account_id===card.id&&p.movement_id)
   .map(p=>String(p.movement_id)));
 const lines=[],notes=[],skipped=[];
 let purchaseC=0,feeC=0,creditC=0,msiC=0,linkedMsiC=0,plannedMsiC=0,excludedC=0;
 const linkedEntries=scheduledMsiEntries(state,asOf,card.id);
 const linkedInstallments=new Set(linkedEntries.map(x=>String(x.msi_plan_id)+':'+String(x.installment_number)));
 const accountMovements=(state.movements||[]).filter(m=>m.account_id===card.id);
 for(const m of accountMovements){
  const posting=m.posting_date||m.transaction_date;
  if(!valid(posting)||posting>asOf||posting>window.end)continue;
  if(window.startInclusive?posting<window.startInclusive:posting<=window.startExclusive)continue;
  // Informational old entries already included in the opening balance cannot be charged again.
  if(m.historical_only||card.opening_balance_date&&
    (posting<card.opening_balance_date||
    (posting===card.opening_balance_date&&!m.post_baseline_same_day))){
    excludedC+=asCents(m.amount);continue;
  }
  if(m.kind==='purchase'&&linkedMsis.has(String(m.id))){
   skipped.push({id:m.id,type:'msi_original',label:m.description||m.merchant||'Compra original MSI',amount:cash(m.amount)});
   continue;
  }
  const sign=purchaseKinds.has(m.kind)?1:creditKinds.has(m.kind)?-1:0;
  if(!sign)continue; // payments to the bank are not an expense of the purchase cycle
  const value=asCents(m.amount)*sign;
  if(!Number.isFinite(value))continue;
  if(sign<0)creditC+=-value;
  else if(m.kind==='purchase')purchaseC+=value;
  else feeC+=value;
  lines.push({id:String(m.id||'mov:'+posting+':'+lines.length),type:m.kind,
    date:posting,label:m.description||m.merchant||m.category||'Movimiento',amount:cash(value)});
 }
 // Los gastos MSI que realmente vinculó el usuario deben entrar al acumulado
 // del periodo según la fecha del abono. Nunca alteran otra vez la deuda global.
 for(const linked of linkedEntries){
  const date=linked.transaction_date;
  if(date>window.end||(window.startInclusive?date<window.startInclusive:date<=window.startExclusive))continue;
  const value=asCents(linked.amount);
  linkedMsiC+=value;msiC+=value;
  lines.push({id:linked.id,type:'msi_linked',date,
    label:linked.description,amount:cash(value)});
 }
 // MSI futuros/no vinculados: previsiones del plan para estimar el próximo corte.
 // Si esa mensualidad ya tiene vínculo, no se contabiliza una segunda vez.
 for(const plan of state.installments||[]){
  if(plan.account_id!==card.id||plan.status==='cancelled')continue;
  const idx=monthIndex(plan.first_charge_month,closeMonth);
  if(idx<0||idx>=Number(plan.months))continue;
  if(linkedInstallments.has(String(plan.id)+':'+String(idx+1)))continue;
  const amount=installmentAmount(plan,idx),value=asCents(amount);
  if(value<=0)continue;
  plannedMsiC+=value;msiC+=value;
  lines.push({id:'msi:'+plan.id+':'+idx,type:'msi',date:window.end,
    label:(plan.description||'MSI')+' · mensualidad programada '+(idx+1)+' de '+plan.months,
    amount:cash(value)});
 }
 const total=cash((purchaseC+feeC+msiC-creditC)/100);
 const opening=card.opening_balance_date;
 const partial=!opening||window.startInclusive?Boolean(!opening||window.startInclusive&&opening>=window.startInclusive):opening>window.startExclusive;
 if(!opening)notes.push('No hay fecha de saldo inicial confirmada; los movimientos pueden no cubrir todo el periodo.');
 else if(partial)notes.push('El periodo incluye fechas anteriores o iguales al saldo inicial: solo se suma lo posterior a esa fotografía.');
 if(skipped.length)notes.push('Las compras originales MSI vinculadas se sustituyen por su mensualidad para evitar duplicación.');
 if(!ended)notes.push('Corte todavía abierto: el importe cambiará conforme agregues compras y cargos.');
 if(!official)notes.push('Sin estado de cuenta: cálculo orientativo, no pago bancario confirmado.');
 if(!schedule)notes.push('Falta completar fecha habitual de vencimiento de la tarjeta.');
 const officialAmount=official?cash(official.no_interest_amount):null;
 const linkedPaid=official?cash((state.movements||[]).filter(m=>m.statement_id===official.id&&m.kind==='payment'&&m.transaction_date<=asOf)
   .reduce((sum,m)=>sum+Number(m.amount||0),0)):0;
 const pending=official?paymentPending(official,state.movements||[],asOf):null;
 const status=official?'official':ended?'closed-unverified':'open';
 const diff=official?cash(officialAmount-total):null;
 lines.sort((a,b)=>a.date.localeCompare(b.date)||a.label.localeCompare(b.label));
 return {accountId:card.id,accountName:card.name,closeMonth,window,closeDate:window.end,
   dueDate:official?.due_date||schedule?.earliest||null,dueEnd:official?.due_date||schedule?.latest||null,
   status,source:official?'official':'calculated',officialId:official?.id||null,
   officialAmount,linkedPaid,paidBeforeBaseline:Number(official?.paid_before_baseline||0),
   pending,difference:diff,projectedTotal:total,partial,finished:ended,
   purchaseTotal:cash(purchaseC/100),extrasTotal:cash(feeC/100),
   linkedMsiTotal:cash(linkedMsiC/100),scheduledMsiTotal:cash(plannedMsiC/100),
   creditsTotal:cash(creditC/100),msiTotal:cash(msiC/100),
   excludedFromBaseline:cash(excludedC/100),lines,skipped,notes};
}
export function cycleEstimates(state,asOf,{back=2,ahead=2}={}){
 return (state.accounts||[]).filter(a=>a.kind==='credit'&&a.active!==false)
  .flatMap(a=>cycleMonthsFor(a,asOf,{back,ahead}).map(month=>estimatedCycle(state,a,month,asOf)).filter(Boolean))
  .sort((a,b)=>a.closeDate.localeCompare(b.closeDate)||a.accountName.localeCompare(b.accountName));
}
export function cycleReconciliationSummary(state,asOf){
 // Build review history from recorded cycles rather than a sliding two-month window:
 // a past estimate is never silently treated as paid merely because the calendar advanced.
 const all=[];
 for(const card of (state.accounts||[]).filter(a=>a.kind==='credit'&&a.active!==false)){
  const months=new Set();
  for(const statement of state.statements||[])
   if(statement.account_id===card.id&&statement.close_date<=asOf)months.add(statement.close_date.slice(0,7));
  for(const m of state.movements||[]){
   if(m.account_id!==card.id||!m.transaction_date||m.transaction_date>asOf)continue;
   if(!purchaseKinds.has(m.kind)&&!creditKinds.has(m.kind))continue;
   const d=m.posting_date||m.transaction_date,month=d.slice(0,7);
   if(!/^[0-9]{4}-[0-9]{2}$/.test(month))continue;
   const close=monthlyDate(month,Number(card.cutoff_day)||1);
   months.add(d>close?addMonths(month,1):month);
  }
  for(const plan of state.installments||[]){
   if(plan.account_id!==card.id||plan.status==='cancelled')continue;
   const first=String(plan.first_charge_month||'').slice(0,7);
   if(!/^[0-9]{4}-[0-9]{2}$/.test(first))continue;
   for(let i=0;i<Math.min(120,Number(plan.months)||0);i++){
    const month=addMonths(first,i);
    if(month>asOf.slice(0,7))break;
    months.add(month);
   }
  }
  for(const month of months){
   const x=estimatedCycle(state,card,month,asOf);
   if(!x)continue;
   if(x.status==='official'){if(x.pending>0)all.push(x);continue}
   if(x.status!=='closed-unverified'||!x.lines.length)continue;
   // MSI plans previously marked paid are historical control, not a new reminder.
   const potentiallyUnpaid=x.lines.some(line=>{
    if(line.type!=='msi')return true;
    const [,id,indexText]=line.id.split(':');
    const plan=(state.installments||[]).find(p=>String(p.id)===id);
    return !plan||Number(indexText)>=(Number(plan.installments_paid)||0);
   });
   if(potentiallyUnpaid)all.push(x);
  }
 }
 return all.sort((a,b)=>b.closeDate.localeCompare(a.closeDate)||a.accountName.localeCompare(b.accountName));
}
