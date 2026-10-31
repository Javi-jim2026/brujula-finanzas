/* Brújula v1.14 · Motor de secuencias: eventos pasados y futuros por tarjeta.
   Las proyecciones NO crean cobros ni cambian saldos. */
import {addMonths,monthlyDate,cash} from './planning-rules.mjs';
import {cycleDates} from './card-cycle.mjs';
import {accountBalanceFrom,availableCreditFrom,paymentPending} from './finance-rules.mjs';
import {transactionCycle} from './conditional-engine.mjs';
const chargeKinds=new Set(['purchase','fee','interest']);
const isReal=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||''));
export function sequenceForCard(card,state,asOf,{back=2,ahead=3}={}){
 if(card.kind!=='credit'||card.active===false) return null;
 const movements=(state.movements||[]).filter(m=>m.account_id===card.id);
 const statements=(state.statements||[]).filter(s=>s.account_id===card.id);
 const limit=cash(Math.max(0,Number(card.credit_limit)||0));
 const debt=cash(accountBalanceFrom(card,movements,asOf));
 const available=cash(availableCreditFrom(card,statements,movements,asOf));
 const headroom=Math.max(0,available);
 const utilization=limit>0?Math.round(1000*Math.max(debt,0)/limit)/10:null;
 const limitState=limit<=0?'needs-limit':debt>limit?'over-limit':headroom<=0?'exhausted':headroom/limit<=0.1?'low':'available';
 const events=[];
 const index=new Map();
 for(const s of statements){
  if(!isReal(s.close_date)||!isReal(s.due_date))continue;
  const month=s.close_date.slice(0,7);
  const prev=index.get(month);
  if(!prev||s.close_date>prev.close_date)index.set(month,s);
 }
 const baseMonth=asOf.slice(0,7);
 for(let i=-back;i<=ahead;i++){
  const month=addMonths(baseMonth,i);
  const bank=index.get(month);
  const estimate=cycleDates(card,month);
  const cutoff=bank?.close_date||estimate?.cutoff;
  if(cutoff){
   events.push({id:'cutoff:'+card.id+':'+month,accountId:card.id,date:cutoff,kind:'cutoff',
    source:bank?'official':'estimated',amount:null,month,
    phase:cutoff<asOf?'past':cutoff===asOf?'today':'future'});
  }
  if(bank){
   const amount=paymentPending(bank,movements.filter(m=>m.transaction_date<=asOf));
   events.push({id:'due:'+bank.id,accountId:card.id,date:bank.due_date,kind:'due',month,
    source:'official',statementId:bank.id,amount,phase:bank.due_date<asOf?'past':bank.due_date===asOf?'today':'future'});
  }else if(estimate){
   events.push({id:'due-est:'+card.id+':'+month,accountId:card.id,date:estimate.earliest,
    windowEnd:estimate.latest,kind:'due',month,source:'estimated',amount:null,
    phase:estimate.latest<asOf?'past':estimate.earliest<=asOf?'today':'future'});
  }
 }
 for(const m of movements){
  if(!isReal(m.transaction_date)||m.transaction_date>asOf)continue;
  if(!chargeKinds.has(m.kind)&&m.kind!=='payment')continue;
  const isHistoric=Boolean(m.historical_only||card.opening_balance_date&&
   (m.transaction_date<card.opening_balance_date||m.transaction_date===card.opening_balance_date&&!m.post_baseline_same_day));
  const cycle=chargeKinds.has(m.kind)?transactionCycle(card,m.posting_date||m.transaction_date):null;
  events.push({id:'movement:'+(m.id||m.transaction_date),accountId:card.id,date:m.transaction_date,
   kind:m.kind==='payment'?'payment':'charge',source:'recorded',amount:cash(Number(m.amount)),
   historical:isHistoric,affectsDebt:!isHistoric,month:cycle?.closeMonth||null,
   uncertainCutoff:Boolean(cycle&&(m.posting_date||m.transaction_date)===cycle.cutoff),
   phase:'past'});
 }
 const order={charge:0,payment:1,cutoff:2,due:3};
 events.sort((a,b)=>a.date.localeCompare(b.date)||order[a.kind]-order[b.kind]||a.id.localeCompare(b.id));
 // A closed, unpaid, official statement takes priority over a later projected cutoff.
 const pending=events.filter(e=>e.kind==='due'&&e.source==='official'&&e.amount>0);
 const overdue=pending.filter(e=>e.date<asOf).sort((a,b)=>b.date.localeCompare(a.date))[0];
 const nextDue=overdue||events.filter(e=>e.kind==='due'&&(e.date>=asOf||e.windowEnd>=asOf)&&
  (e.source==='estimated'||e.amount>0)).sort((a,b)=>a.date.localeCompare(b.date))[0]||null;
 const nextCutoff=events.filter(e=>e.kind==='cutoff'&&e.date>=asOf).sort((a,b)=>a.date.localeCompare(b.date))[0]||null;
 const cutoffDay=Number(card.cutoff_day);
 const nominal=cutoffDay?monthlyDate(baseMonth,cutoffDay):null;
 const activeCutoff=events.find(e=>e.kind==='cutoff'&&e.month===baseMonth);
 const cyclePhase=!nominal?'unconfigured':asOf<nominal?'before':asOf===nominal?'cutoff-day':'after';
 const cutoffVerified=Boolean(activeCutoff?.source==='official');
 return {accountId:card.id,name:card.name,asOf,events,limit,debt,available,headroom,utilization,limitState,
  cyclePhase,cutoffVerified,nextCutoff,nextDue,
  expected:nextDue?.source==='official'?nextDue.amount:null,
  source:nextDue?.source||null};
}
export function sequenceForAll(state,asOf){
 return (state.accounts||[]).filter(a=>a.kind==='credit'&&a.active!==false).map(a=>sequenceForCard(a,state,asOf));
}
