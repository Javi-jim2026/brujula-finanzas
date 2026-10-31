import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {transactionCycle,evaluateMovement,accountCycleDecisions,cycleSpendSummary,isHistoricalMovement} from '../conditional-engine.mjs';
import {accountBalanceFrom,availableCreditFrom,assertMovementAfterBaseline} from '../finance-rules.mjs';
import {renderConditionsByCard} from '../conditional-ui.mjs';
const stori={id:'st',name:'Stori',kind:'credit',opening_balance:4000,opening_balance_date:'2026-10-20',
 credit_limit:10000,cutoff_day:12,due_day:4,due_month_offset:1,due_window_days:0};
const plata={...stori,id:'pl',name:'Plata Card',cutoff_day:5,due_day:5,due_window_days:1};
const s=(account,kind,date,more={})=>evaluateMovement(account,{kind,transaction_date:date,...more},'2026-10-30');
test('Gastos del mismo día de corte se incluyen en ese ciclo; un día después corresponde al siguiente',()=>{
 const a=transactionCycle(stori,'2026-10-12'),b=transactionCycle(stori,'2026-10-13');
 assert.deepEqual([a.cutoff,a.estimatedDue,a.alreadyPastCutoff],['2026-10-12','2026-11-04',false]);
 assert.deepEqual([b.cutoff,b.estimatedDue,b.alreadyPastCutoff],['2026-11-12','2026-12-04',true]);
 const c=transactionCycle(plata,'2026-10-06');
 assert.equal(c.cutoff,'2026-11-05');
 assert.equal(c.estimatedDue,'2026-12-05');
 assert.equal(c.estimatedDueEnd,'2026-12-06');
});
test('Gasto anterior a inicio permitido solo como histórico, no como saldo nuevo',()=>{
 const decision=s(stori,'purchase','2026-10-15');
 assert.equal(decision.ok,true);assert.equal(decision.historical,true);
 assert.equal(decision.changesBalance,false);
 assert.match(decision.message,/saldo inicial/i);
 const a=accountBalanceFrom(stori,[{account_id:'st',kind:'purchase',amount:700,transaction_date:'2026-10-15',historical_only:true}]);
 assert.equal(a,4000);
});
test('No permite abono previo al saldo inicial, ni registrarlo como compra futura',()=>{
 assert.equal(s(stori,'payment','2026-10-15').ok,false);
 assert.match(s(stori,'payment','2026-10-15').message,/ya están incluidos/);
 assert.equal(s(stori,'purchase','2026-11-02').ok,false);
});
test('Mismo día del saldo inicial: diferencia histórico vs compra posterior a captura',()=>{
 const old=s(stori,'purchase','2026-10-20');
 const newDay=s(stori,'purchase','2026-10-20',{post_baseline_same_day:true});
 assert.equal(old.historical,true);assert.equal(newDay.historical,false);
 assert.equal(newDay.postSnapshot,true);assert.equal(newDay.changesBalance,true);
 assert.equal(isHistoricalMovement(stori,'2026-10-20',true),false);
 const arr=[
  {account_id:'st',kind:'purchase',transaction_date:'2026-10-20',amount:100,historical_only:true},
  {account_id:'st',kind:'purchase',transaction_date:'2026-10-20',amount:250,post_baseline_same_day:true},
  {account_id:'st',kind:'purchase',transaction_date:'2026-10-21',amount:300}
 ];
 assert.equal(accountBalanceFrom(stori,arr),4550);
 assert.doesNotThrow(()=>assertMovementAfterBaseline(stori,arr[1]));
 assert.throws(()=>assertMovementAfterBaseline(stori,arr[0]),/incluida/);
});
test('Instantánea de crédito no pierde compras posteriores del mismo día',()=>{
 const snap={id:'stmt',account_id:'st',close_date:'2026-10-20',available_at:'2026-10-20',bank_available:6000};
 const purchases=[
 {account_id:'st',kind:'purchase',transaction_date:'2026-10-20',amount:200,historical_only:true},
 {account_id:'st',kind:'purchase',transaction_date:'2026-10-20',amount:250,post_baseline_same_day:true},
 {account_id:'st',kind:'payment',transaction_date:'2026-10-21',amount:50}
 ];
 assert.equal(availableCreditFrom(stori,[snap],purchases,'2026-10-30'),5800);
});
test('Corte hoy indica cierre, pero sin estado bancario no inventa importe',()=>{
 const data={accounts:[stori],movements:[],statements:[]};
 const d=accountCycleDecisions(data,stori,'2026-11-12');
 assert.equal(d.cutoffToday,true);
 assert.equal(d.cycleLabel,'El corte habitual es hoy');
 assert.equal(d.payment?.source,'estimated');
 assert.equal(d.payment?.amount,null);
 assert.match(renderConditionsByCard(data,'2026-11-12'),/Importe aún desconocido/);
});
test('Compras registradas agrupadas por periodo bancario, histórico aparte',()=>{
 const movements=[
 {account_id:'st',kind:'purchase',amount:300,transaction_date:'2026-10-21'},
 {account_id:'st',kind:'purchase',amount:150,transaction_date:'2026-10-28'},
 {account_id:'st',kind:'purchase',amount:900,transaction_date:'2026-10-12',historical_only:true},
 {account_id:'st',kind:'payment',amount:100,transaction_date:'2026-10-29'}
 ];
 const d=accountCycleDecisions({accounts:[stori],movements,statements:[]},stori,'2026-10-30');
 assert.equal(d.currentClose,'2026-11-12');assert.equal(d.cycleSpend,450);assert.equal(d.purchaseCount,2);
 assert.equal(d.historicalSpend,0);
});
test('Confirmación bancaria prevalece y presenta importe pendiente exacto, no suma compras',()=>{
 const official={id:'of',account_id:'st',close_date:'2026-10-12',due_date:'2026-11-04',no_interest_amount:1800,paid_before_baseline:200};
 const state={accounts:[stori],statements:[official],
  movements:[{account_id:'st',kind:'payment',statement_id:'of',amount:500,transaction_date:'2026-10-29'}]};
 const d=accountCycleDecisions(state,stori,'2026-10-30');
 assert.equal(d.payment.source,'official');assert.equal(d.payment.amount,1100);
 assert.match(renderConditionsByCard(state,'2026-10-30'),/1,100/);
});
test('Evaluar varias tarjetas independiente, con ciclo y semáforo en cada una',()=>{
 const state={accounts:[stori,plata],movements:[],statements:[]};
 const rows=cycleSpendSummary(state,state.accounts,'2026-10-30');
 assert.equal(rows.length,2);
 assert.equal(rows[0].currentClose,'2026-11-12');
 assert.equal(rows[1].currentClose,'2026-11-05');
 const html=renderConditionsByCard(state,'2026-10-30');
 assert.match(html,/Stori/);assert.match(html,/Plata Card/);
});
test('La interfaz de captura ofrece revisión por fechas y confirmación, sin retirar acciones antiguas',()=>{
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(app,/id="movement-condition"/);
 assert.match(app,/id="snapshot-timing-row"/);
 assert.match(app,/name="historical_ack"/);
 assert.match(app,/post_baseline_same_day/);
 assert.match(app,/renderConditionsByCard/);
 assert.match(app,/updateMovementCondition/);
});
