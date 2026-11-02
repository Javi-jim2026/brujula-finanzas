import test from 'node:test';
import assert from 'node:assert/strict';
import {accountCycleDecisions,transactionCycle} from '../conditional-engine.mjs';
import {cardPaymentTimeline,cycleDates} from '../card-cycle.mjs';
import {sequenceForCard} from '../sequence-engine.mjs';
import {paymentPending} from '../finance-rules.mjs';
import {dueEvents} from '../planning-rules.mjs';
import {paymentPlan} from '../payday-planning.mjs';
import {financeClock} from '../finance-clock.mjs';
const card={id:'stori',kind:'credit',name:'Stori',active:true,credit_limit:10000,opening_balance:1500,
 opening_balance_date:'2026-10-01',cutoff_day:12,due_day:4,due_month_offset:1,due_window_days:0};
const plata={...card,id:'plata',name:'Plata Card',cutoff_day:5,due_day:5,due_window_days:1};
const base={accounts:[card,plata],movements:[],statements:[],recurring_bills:[],recurring_checks:[],
 recurring_postings:[],loans:[],loan_payments:[]};
test('No incluye compras futuras en resumen del corte aunque su fecha pertenezca al ciclo futuro',()=>{
 const data={...base,movements:[
  {id:'old',account_id:'stori',kind:'purchase',transaction_date:'2026-10-26',amount:100},
  {id:'future',account_id:'stori',kind:'purchase',transaction_date:'2026-11-10',amount:700}
 ]};
 const now=accountCycleDecisions(data,card,'2026-11-01');
 assert.equal(now.currentClose,'2026-11-12');
 assert.equal(now.cycleSpend,100);
 assert.equal(now.purchaseCount,1);
 const later=accountCycleDecisions(data,card,'2026-11-10');
 assert.equal(later.cycleSpend,800);
 const sequence=sequenceForCard(card,data,'2026-11-01');
 assert.equal(sequence.debt,1600);
 assert.equal(sequence.available,8400);
 assert.equal(sequence.events.filter(e=>e.kind==='charge').length,1);
});
test('Pago con fecha futura no reduce el saldo oficial al evaluar el día de hoy',()=>{
 const statement={id:'official',account_id:'stori',close_date:'2026-10-12',due_date:'2026-11-04',no_interest_amount:1000,paid_before_baseline:0};
 const movements=[
  {id:'today',account_id:'stori',kind:'payment',statement_id:'official',transaction_date:'2026-10-30',amount:250},
  {id:'future',account_id:'stori',kind:'payment',statement_id:'official',transaction_date:'2026-11-03',amount:750}
 ];
 const data={...base,statements:[statement],movements};
 assert.equal(paymentPending(statement,movements,'2026-11-01'),750);
 assert.equal(paymentPending(statement,movements,'2026-11-03'),0);
 const current=cardPaymentTimeline(card,data.statements,movements,'2026-11-01').find(e=>e.statementId==='official');
 assert.equal(current.amount,750);
 assert.equal(current.source,'official');
 const after=cardPaymentTimeline(card,data.statements,movements,'2026-11-03').find(e=>e.statementId==='official');
 assert.equal(after.amount,0);
 assert.equal(sequenceForCard(card,data,'2026-11-01').nextDue.amount,750);
 assert.equal(paymentPlan(data,'2026-11-01','2026-11-04',{today:'2026-11-01'}).required,750);
 assert.equal(dueEvents(data,'2026-11-01','2026-11-04','2026-11-01')[0].amount,750);
});
test('Un corte ingresado con fecha futura aún no se considera estado de cuenta oficial emitido',()=>{
 const future={id:'future-st',account_id:'stori',close_date:'2026-11-12',due_date:'2026-12-04',no_interest_amount:3100,paid_before_baseline:0};
 const data={...base,statements:[future]};
 const current=cardPaymentTimeline(card,data.statements,[],'2026-11-01');
 assert.equal(current.find(e=>e.cycleMonth==='2026-11').source,'estimated');
 assert.equal(current.find(e=>e.cycleMonth==='2026-11').amount,null);
 assert.equal(sequenceForCard(card,data,'2026-11-01').expected,null);
 assert.equal(sequenceForCard(card,data,'2026-11-12').expected,3100);
});
test('Comportamiento a primer día de noviembre: Stori 4, Plata 5–6 sin inventar importes',()=>{
 const today='2026-11-01';
 const st=sequenceForCard(card,base,today);
 const pl=sequenceForCard(plata,base,today);
 assert.equal(st.nextDue.date,'2026-11-04');
 assert.equal(pl.nextDue.date,'2026-11-05');
 assert.equal(pl.nextDue.windowEnd,'2026-11-06');
 assert.equal(st.nextDue.amount,null);
 assert.equal(pl.nextDue.amount,null);
 const plan=paymentPlan(base,'2026-11-01','2026-11-07',{today});
 assert.equal(plan.required,0);
 assert.deepEqual(plan.cardForecasts.map(e=>e.accountName).sort(),['Plata Card','Stori']);
});
test('Cambio de diciembre a enero y febrero bisiesto: no pierde el mes de pago',()=>{
 assert.equal(cycleDates(card,'2026-12').earliest,'2027-01-04');
 assert.equal(transactionCycle(card,'2026-12-13').estimatedDue,'2027-02-04');
 assert.equal(cycleDates({...card,cutoff_day:29,due_day:29},'2028-01').earliest,'2028-02-29');
 assert.equal(cycleDates({...card,cutoff_day:29,due_day:29},'2027-01').earliest,'2027-02-28');
});
test('Reloj corregido por servidor cambia el día de evaluación de forma consistente',()=>{
 let now=new Date(2026,10,1,23,59,0).getTime();
 const clock=financeClock({now:()=>now,timeZone:()=> 'America/Mexico_City'});
 assert.equal(clock.today(),'2026-11-01');
 assert.equal(clock.compareServer(new Date(now+120000).toISOString(),now,now),true);
 assert.equal(clock.today(),'2026-11-02');
 const a=sequenceForCard(card,base,clock.today());
 assert.equal(a.asOf,'2026-11-02');
 assert.equal(a.nextDue.date,'2026-11-04');
});
