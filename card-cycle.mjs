/* Brújula Finanzas v1.11 · Ciclos bancarios por tarjeta
 * Proyecciones de fechas ≠ obligación monetaria confirmada. Las cifras oficiales
 * solo proceden de estados de cuenta que el usuario ingresó.
 */
import {addDays,addMonths,monthlyDate,cash} from './planning-rules.mjs';
const validDay=d=>Number.isInteger(Number(d))&&Number(d)>=1&&Number(d)<=31;
export function cycleRule(card){
 const close=Number(card.cutoff_day),due=Number(card.due_day),offset=card.due_month_offset;
 if(!validDay(close)||!validDay(due)||offset===null||offset===undefined||offset===''||![0,1,2].includes(Number(offset)))return null;
 return {cutoff:close,due,offset:Number(offset),window:Math.min(3,Math.max(0,Number(card.due_window_days)||0))};
}
export function cycleDates(card,closeMonth){
 const rule=cycleRule(card);
 if(!rule)return null;
 const cutoff=monthlyDate(closeMonth,rule.cutoff);
 const dueMonth=addMonths(closeMonth,rule.offset);
 const earliest=monthlyDate(dueMonth,rule.due);
 const latest=addDays(earliest,rule.window);
 if(earliest<cutoff)return null; // no calendar period should pay before closing
 return {closeMonth,cutoff,earliest,latest,variable:rule.window>0};
}
const daysBetween=(today,date)=>Math.round((new Date(date+'T12:00:00Z')-new Date(today+'T12:00:00Z'))/86400000);
export function dueStatus(item,today){
 if(item.source==='official'){
  if(item.amount<=0)return {key:'covered',label:'Corte cubierto',severity:'ok'};
  const diff=daysBetween(today,item.date);
  return diff<0?{key:'overdue',label:'Vencido · monto oficial pendiente',severity:'danger'}:
   diff===0?{key:'today',label:'Vence hoy · confirmado',severity:'danger'}:
   diff<=7?{key:'soon',label:'Por vencer · pago confirmado',severity:'warning'}:
   {key:'scheduled',label:'Pago confirmado por el banco',severity:'neutral'};
 }
 const diff=daysBetween(today,item.date);
 if(diff<0)return {key:'unverified',label:'Fecha estimada pasada · verificar en banco',severity:'warning'};
 if(diff===0)return {key:'forecast-today',label:'Vencimiento estimado para hoy · verificar',severity:'warning'};
 if(diff<=7)return {key:'forecast-soon',label:'Vencimiento estimado próximo · verificar',severity:'warning'};
 return {key:'forecast',label:'Próximo vencimiento estimado',severity:'neutral'};
}
export function cardPaymentTimeline(card,statements,movements,today,{monthsBack=4,monthsForward=3}={}){
 if(card.kind!=='credit'||card.active===false)return[];
 const list=(statements||[]).filter(s=>s.account_id===card.id);
 const byMonth=new Map();
 for(const s of list){
  const key=s.close_date?.slice(0,7);
  if(!key)continue;
  if(!byMonth.has(key)||s.close_date>byMonth.get(key).close_date)byMonth.set(key,s);
 }
 const result=[];
 for(let n=-monthsBack;n<=monthsForward;n++){
  const ym=addMonths(today.slice(0,7),n);
  const s=byMonth.get(ym);
  if(s){
   const assigned=(movements||[]).filter(m=>m.statement_id===s.id&&m.kind==='payment').reduce((v,m)=>v+Number(m.amount||0),0);
   const amount=cash(Math.max(0,Number(s.no_interest_amount||0)-Number(s.paid_before_baseline||0)-assigned));
   const item={account_id:card.id,accountName:card.name,cycleMonth:ym,closeDate:s.close_date,date:s.due_date,
    latestDate:s.due_date,source:'official',amount,statementId:s.id,days:daysBetween(today,s.due_date)};
   result.push({...item,...dueStatus(item,today)});continue;
  }
  const dates=cycleDates(card,ym);
  if(!dates)continue;
  // A predicted deadline does not imply a confirmed debt.
  const item={account_id:card.id,accountName:card.name,cycleMonth:ym,
   closeDate:dates.cutoff,date:dates.earliest,latestDate:dates.latest,
   source:'estimated',amount:null,statementId:null,days:daysBetween(today,dates.earliest)};
  result.push({...item,...dueStatus(item,today)});
 }
 return result.sort((a,b)=>a.date.localeCompare(b.date));
}
export function upcomingCardPayments(state,today){
 const cards=(state.accounts||[]).filter(a=>a.kind==='credit'&&a.active!==false);
 const items=cards.flatMap(a=>cardPaymentTimeline(a,state.statements||[],state.movements||[],today));
 // Historic forecasts cannot be declared overdue or included as a current confirmed payment.
 return items.filter(x=>x.source==='official'&&x.amount>0 || x.source==='estimated'&&x.date>=today)
   .sort((a,b)=>a.date.localeCompare(b.date)||String(a.accountName).localeCompare(String(b.accountName)));
}
export function cardPaymentPreview(state,card,today){
 const items=cardPaymentTimeline(card,state.statements||[],state.movements||[],today);
 const pending=items.filter(x=>x.source==='official'&&x.amount>0&&x.date<today);
 const future=items.filter(x=>x.date>=today);
 return pending[0]||future[0]||null;
}
