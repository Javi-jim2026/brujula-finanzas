/* Brújula v1.5 · Proyecciones informativas; no realizan cargos ni movimientos. */
export const cash=n=>Math.round((Number(n)||0)*100)/100;
export function asDate(iso){return new Date(iso+'T12:00:00Z')}
export function iso(d){return d.toISOString().slice(0,10)}
export function addDays(day,n){const d=asDate(day);d.setUTCDate(d.getUTCDate()+n);return iso(d)}
export function endOfMonth(y,m){return new Date(Date.UTC(y,m,0)).getUTCDate()}
export function monthlyDate(ym,day){const [y,m]=ym.split('-').map(Number);return ym+'-'+String(Math.min(day,endOfMonth(y,m))).padStart(2,'0')}
export function addMonths(ym,n){const [y,m]=ym.split('-').map(Number);return iso(new Date(Date.UTC(y,m-1+n,1))).slice(0,7)}
export function monthEquivalent(b){if(!b.active)return 0;return cash(b.amount*({weekly:52/12,biweekly:26/12,monthly:1,yearly:1/12}[b.frequency]||1))}
export function monthlyFixedBills(bills){return cash(bills.filter(b=>b.direction!=='income').reduce((s,b)=>s+monthEquivalent(b),0))}
export function recurringDates(b,from,to){
 if(!b.active)return[];
 const results=[];
 let d=b.next_date||monthlyDate(from.slice(0,7),Number(b.due_day)||1);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return[];
 if(b.frequency==='monthly'||b.frequency==='yearly'){
  const startYM=d.slice(0,7),fixedDay=Number(b.due_day)||Number(d.slice(-2));
  for(let n=0;n<240;n++){
   const month=addMonths(startYM,n*(b.frequency==='yearly'?12:1)),day=monthlyDate(month,fixedDay);
   if(day>to)break;if(day>=from)results.push(day);
  }
 }else{
  const interval=b.frequency==='biweekly'?14:7;
  for(let n=0;n<1500;n++){
   const day=addDays(d,n*interval);if(day>to)break;if(day>=from)results.push(day);
  }
 }
 return results;
}
export function dueEvents(state,from,to){
 const items=[];
 for(const b of state.recurring_bills||[]){
  for(const date of recurringDates(b,from,to))items.push({date,type:'recurring',id:b.id,amount:cash(b.amount),
    label:b.name,account_id:b.account_id,direction:b.direction||'expense',due_key:b.id+':'+date,category:b.category});
 }
 for(const s of state.statements||[]){
  if(s.due_date>=from&&s.due_date<=to){const total=cash(s.no_interest_amount)-cash(s.paid_before_baseline)
   -(state.movements||[]).filter(m=>m.statement_id===s.id&&m.kind==='payment').reduce((v,m)=>v+cash(m.amount),0);
   if(total>0)items.push({date:s.due_date,type:'statement',id:s.id,amount:cash(total),label:'Tarjeta · '+(state.accounts||[]).find(a=>a.id===s.account_id)?.name,account_id:s.account_id});}
 }
 for(const l of state.loans||[]){
  if(l.status!=='active'||!l.monthly_payment||!l.next_due_date)continue;
  const startYM=l.next_due_date.slice(0,7),dueDay=Number(l.next_due_date.slice(-2));
  for(let n=0;n<36;n++){
    const date=monthlyDate(addMonths(startYM,n),dueDay);
    if(date>to)break;if(date>=from)items.push({date,type:'loan',id:l.id,amount:cash(l.monthly_payment),
      label:'Crédito · '+l.name,account_id:null,monthly_lender:l.lender});
  }
 }
 return items.sort((a,b)=>a.date.localeCompare(b.date)||a.type.localeCompare(b.type));
}
export function budgetSpent(movements,month,category){
 return cash((movements||[]).filter(m=>m.transaction_date?.startsWith(month) &&
 (m.kind==='purchase'||m.kind==='expense') && m.category===category).reduce((v,m)=>v+cash(m.amount),0));
}
export function amortization(balance,annualRate,payment,maxMonths=600){
 let principal=cash(balance),rate=(Number(annualRate)||0)/1200,monthly=cash(payment);
 if(principal<=0||monthly<=0)return {rows:[],totalInterest:0,remaining:principal,warning:'Falta saldo o mensualidad.'};
 const monthlyInterest=principal*rate;
 if(rate>0 && monthly<=monthlyInterest)return {rows:[],totalInterest:0,remaining:principal,warning:'La mensualidad no cubre los intereses estimados.'};
 const rows=[];let interestSum=0;
 for(let n=1;n<=maxMonths && principal>0.005;n++){
  const interest=cash(principal*rate),paid=Math.min(monthly,cash(principal+interest)),amort=cash(paid-interest);
  if(amort<=0)break;
  principal=cash(Math.max(0,principal-amort));interestSum=cash(interestSum+interest);
  rows.push({number:n,payment:paid,principal:amort,interest,balance:principal});
 }
 return {rows,totalInterest:interestSum,remaining:principal,warning:principal>0?'El plazo calculado supera el horizonte mostrado.':null};
}
