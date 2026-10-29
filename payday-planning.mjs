/* Brújula v1.9. Control quincenal 15/30. Proyecciones, no cargo ni abono automático. */
import {addDays,addMonths,monthlyDate,dueEvents,cash} from './planning-rules.mjs';
export const MX_PAYDAYS=[15,30];
export function payDate(month,day){if(day!==15&&day!==30)throw Error('El día de nómina debe ser 15 o 30');return monthlyDate(month,day)}
export function paySchedule(anchor,monthRange=3){
 const ym=anchor.slice(0,7);const dates=[];
 for(let i=-monthRange;i<=monthRange;i++){
  const month=addMonths(ym,i);
  dates.push(payDate(month,15),payDate(month,30));
 }
 return [...new Set(dates)].sort();
}
export function salaryPeriod(today,offset=0){
 const dates=paySchedule(today,Math.max(4,Math.abs(offset)+4));
 const nextIndex=dates.findIndex(d=>d>today);
 if(nextIndex<=0)throw Error('No se pudo determinar la próxima fecha de nómina');
 const idx=nextIndex-1+offset;
 if(idx<0||idx+1>=dates.length)throw Error('Periodo fuera del calendario');
 return {start:dates[idx],end:addDays(dates[idx+1],-1),nextPayday:dates[idx+1],label:offset===0?'Quincena actual':offset===1?'Próxima quincena':'Quincena'};
}
export function weekPeriod(today,offset=0){
 const start=addDays(today,offset*7);
 return {start,end:addDays(start,6),nextPayday:null,label:offset===0?'Próximos 7 días':'Siguientes 7 días'};
}
export function availableMoney(state,balance){
 const accounts=(state.accounts||[]).filter(a=>a.kind!=='credit'&&a.active!==false);
 return cash(accounts.reduce((v,a)=>v+Number(balance(a)),0));
}
export function creditAvailableTotal(state,available){
 return cash((state.accounts||[]).filter(a=>a.kind==='credit'&&a.active!==false).reduce((v,a)=>v+Math.max(0,Number(available(a))),0));
}
export function cardDebtTotal(state,balance){
 return cash((state.accounts||[]).filter(a=>a.kind==='credit'&&a.active!==false).reduce((v,a)=>v+Math.max(0,Number(balance(a))),0));
}
function uniqueLatestStatements(statements){
 const map=new Map();
 for(const s of statements||[]){
  const previous=map.get(s.account_id);
  if(!previous||String(s.close_date)>String(previous.close_date))map.set(s.account_id,s);
 }
 return new Set([...map.values()].map(s=>s.id));
}
export function paymentPlan(state,from,to,{today=from}={}){
 const events=dueEvents(state,from,to);
 const latestStatements=uniqueLatestStatements(state.statements||[]);
 const all=[];
 const statements=new Set();
 for(const e of events){
  if(e.type==='statement'){
   if(!latestStatements.has(e.id)||statements.has(e.id))continue;
   statements.add(e.id);
  }
  if(e.type==='recurring'){
   const status=(state.recurring_postings||[]).find(p=>p.bill_id===e.id&&p.occurrence_date===e.date);
   const legacy=(state.recurring_checks||[]).some(c=>c.bill_id===e.id&&c.occurrence_date===e.date);
   if(status||legacy)continue;
   if(e.direction==='income'){all.push({...e,flow:'income',note:'Ingreso programado; no confirmado'});continue}
   const a=(state.accounts||[]).find(x=>x.id===e.account_id);
   if(a?.kind==='credit'){
    all.push({...e,flow:'credit_charge',note:'Cargo futuro de tarjeta; no es pago inmediato en efectivo'});continue;
   }
   // Si una misma mensualidad de préstamo está registrada también en Gastos fijos,
   // no presupuestarla automáticamente dos veces. Unir sólo coincidencia fuerte.
   const loanOverlap=events.some(l=>l.type==='loan'&&l.date===e.date&&
     Math.abs(Number(l.amount)-Number(e.amount))<0.01&&(
       /cr[eé]dito|pr[eé]stamo|auto|financiamiento/i.test(e.label||'')||
       (state.loans||[]).some(x=>x.id===l.id&&e.label?.toLowerCase().includes(String(x.name||'').toLowerCase()))));
   if(loanOverlap)all.push({...e,flow:'duplicate',note:'Posible duplicado de pago de préstamo; revisar una sola vez'});
   else all.push({...e,flow:'outflow',note:'Gasto fijo previsto, pendiente de confirmar'});
  }else if(e.type==='loan'){
   const loan=(state.loans||[]).find(l=>l.id===e.id);
   if(loan?.payroll_deduction){
    all.push({...e,flow:'payroll',note:'Descuento de nómina: no restado del efectivo de nuevo'});continue;
   }
   const paymentDone=(state.loan_payments||[]).some(p=>p.loan_id===e.id&&p.payment_date>=addDays(e.date,-5)&&p.payment_date<=addDays(e.date,5)&&p.payment_date<=today);
   if(paymentDone)continue;
   all.push({...e,flow:'outflow',note:'Mensualidad prevista del crédito'});
  }else if(e.type==='statement'){
   all.push({...e,flow:'outflow',note:'Importe pendiente del estado de cuenta bancario'});
  }
 }
 const payable=all.filter(e=>e.flow==='outflow');
 const income=all.filter(e=>e.flow==='income');
 const sum=x=>cash(x.reduce((n,e)=>n+Number(e.amount),0));
 return {items:all,payable,required:sum(payable),incomePlanned:sum(income),
   creditCharges:sum(all.filter(e=>e.flow==='credit_charge')),
   payrollDeductions:sum(all.filter(e=>e.flow==='payroll')),
   duplicates:all.filter(e=>e.flow==='duplicate')};
}
export function treasurySummary(state,balance,available,today){
 const dueNow=weekPeriod(today,0),beforePay=salaryPeriod(today,0);
 const liquid=availableMoney(state,balance);
 const cards=cardDebtTotal(state,balance);
 const credit=creditAvailableTotal(state,available);
 const weekly=paymentPlan(state,dueNow.start,dueNow.end,{today});
 const upcoming=paymentPlan(state,today,beforePay.end,{today});
 return {liquid,cards,credit,weekly,upcoming,
  weeklyDifference:cash(liquid-weekly.required),
  beforePayDifference:cash(liquid-upcoming.required),
  period:beforePay,week:dueNow};
}
