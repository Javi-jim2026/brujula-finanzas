import test from 'node:test';
import assert from 'node:assert/strict';
import {sequenceForCard,sequenceForAll} from '../sequence-engine.mjs';
import {accountBalanceFrom,availableCreditFrom} from '../finance-rules.mjs';
import {renderSequencePanel} from '../sequence-ui.mjs';
const stori={id:'st',name:'Stori',kind:'credit',active:true,cutoff_day:12,due_day:4,due_month_offset:1,due_window_days:0,credit_limit:10000,opening_balance:3500,opening_balance_date:'2026-10-01'};
const plata={...stori,id:'pl',name:'Plata Card',cutoff_day:5,due_day:5,due_window_days:1,credit_limit:5000,opening_balance:200};
test('Cada tarjeta genera cortes y vencimientos secuenciales correctos',()=>{
 const st={accounts:[stori,plata],movements:[],statements:[]};
 const a=sequenceForCard(stori,st,'2026-10-30');
 const b=sequenceForCard(plata,st,'2026-10-30');
 assert.equal(a.nextDue.date,'2026-11-04');
 assert.equal(a.nextDue.source,'estimated');
 assert.equal(a.nextDue.amount,null);
 assert.equal(b.nextDue.date,'2026-11-05');
 assert.equal(b.nextDue.windowEnd,'2026-11-06');
 assert.equal(a.nextCutoff.date,'2026-11-12');
 assert.equal(b.nextCutoff.date,'2026-11-05');
 assert.equal(sequenceForAll(st,'2026-10-30').length,2);
});
test('Fecha de corte se evalúa usando día exacto y cambia el ciclo',()=>{
 const data={accounts:[stori],movements:[],statements:[]};
 assert.equal(sequenceForCard(stori,data,'2026-10-11').cyclePhase,'before');
 assert.equal(sequenceForCard(stori,data,'2026-10-12').cyclePhase,'cutoff-day');
 assert.equal(sequenceForCard(stori,data,'2026-10-13').cyclePhase,'after');
});
test('No usa gastos futuros para calcular deuda ni disponible de hoy',()=>{
 const m=[
 {id:'m1',account_id:'st',kind:'purchase',transaction_date:'2026-10-20',amount:1000},
 {id:'m2',account_id:'st',kind:'purchase',transaction_date:'2026-11-10',amount:1500}
 ];
 const state={accounts:[stori],movements:m,statements:[]};
 const s=sequenceForCard(stori,state,'2026-10-30');
 assert.equal(s.debt,4500);
 assert.equal(s.available,5500);
 assert.equal(s.events.filter(e=>e.kind==='charge').length,1);
 assert.equal(accountBalanceFrom(stori,m,'2026-10-30'),4500);
 assert.equal(availableCreditFrom(stori,[],m,'2026-10-30'),5500);
 assert.equal(sequenceForCard(stori,state,'2026-11-10').debt,6000);
});
test('Una instantánea oficial del disponible excluye operaciones posteriores a fecha evaluada',()=>{
 const statements=[{id:'snap',account_id:'st',close_date:'2026-10-10',available_at:'2026-10-20',bank_available:6000,no_interest_amount:0,due_date:'2026-11-04'}];
 const moves=[
 {id:'p1',account_id:'st',kind:'purchase',transaction_date:'2026-10-22',amount:400},
 {id:'p2',account_id:'st',kind:'purchase',transaction_date:'2026-11-10',amount:700}
 ];
 assert.equal(availableCreditFrom(stori,statements,moves,'2026-10-30'),5600);
});
test('Corte confirmado y pago bancario prevalecen sobre fechas estimadas',()=>{
 const statements=[{id:'official',account_id:'st',close_date:'2026-10-13',due_date:'2026-11-05',no_interest_amount:1700,paid_before_baseline:0}];
 const moves=[{id:'paid',account_id:'st',kind:'payment',transaction_date:'2026-10-28',statement_id:'official',amount:500}];
 const state={accounts:[stori],movements:moves,statements};
 const a=sequenceForCard(stori,state,'2026-10-30');
 const official=a.events.find(e=>e.id==='due:official');
 assert.equal(official.date,'2026-11-05');
 assert.equal(official.amount,1200);
 assert.equal(a.nextDue.source,'official');
 assert.equal(a.expected,1200);
 assert.equal(a.events.find(e=>e.id==='cutoff:st:2026-10').source,'official');
});
test('Límites generan aviso sin inventar bloqueos bancarios',()=>{
 const data={accounts:[stori],movements:[],statements:[]};
 assert.equal(sequenceForCard(stori,data,'2026-10-30').limitState,'available');
 data.movements=[{id:'p',account_id:'st',kind:'purchase',transaction_date:'2026-10-23',amount:6200}];
 assert.equal(sequenceForCard(stori,data,'2026-10-30').limitState,'low');
 data.movements=[{id:'p',account_id:'st',kind:'purchase',transaction_date:'2026-10-23',amount:7100}];
 assert.equal(sequenceForCard(stori,data,'2026-10-30').limitState,'over-limit');
});
test('No duplica compras históricas que ya estaban en saldo inicial',()=>{
 const state={accounts:[stori],statements:[],movements:[
  {id:'historic',account_id:'st',kind:'purchase',transaction_date:'2026-09-21',historical_only:true,amount:400},
  {id:'actual',account_id:'st',kind:'purchase',transaction_date:'2026-10-22',amount:100}
 ]};
 const a=sequenceForCard(stori,state,'2026-10-30');
 assert.equal(a.debt,3600);
 assert.equal(a.events.find(e=>e.id==='movement:historic').affectsDebt,false);
});
test('Diciembre y enero no mezclan el mes de corte con el de pago',()=>{
 const state={accounts:[stori],movements:[],statements:[]};
 const a=sequenceForCard(stori,state,'2026-12-20');
 assert.equal(a.nextDue.date,'2027-01-04');
 assert.equal(a.nextCutoff.date,'2027-01-12');
});
test('La vista mantiene separados importe confirmado y fecha estimada',()=>{
 const state={accounts:[stori,plata],movements:[],statements:[]};
 const html=renderSequencePanel(state,'2026-10-30');
 assert.match(html,/Motor de secuencias y límites/);
 assert.match(html,/Stori/);
 assert.match(html,/Plata Card/);
 assert.match(html,/importe desconocido/);
 assert.match(html,/Disponible estimado/);
});
