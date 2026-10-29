import test from 'node:test';
import assert from 'node:assert/strict';
import {monthlyFixedBills,monthEquivalent,recurringDates,dueEvents,monthlyDate,amortization,budgetSpent} from '../planning-rules.mjs';
test('Gastos fijos convierte periodos sin insertar cargos',()=>{
 const bills=[{id:'internet',name:'Internet',direction:'expense',amount:500,frequency:'monthly',due_day:20,next_date:'2026-10-20',active:true},
 {id:'anual',name:'Seguro',direction:'expense',amount:1200,frequency:'yearly',due_day:12,next_date:'2026-03-12',active:true}];
 assert.equal(monthlyFixedBills(bills),600);
 assert.equal(monthEquivalent(bills[0]),500);
});
test('Próximas fechas mensuales respetan fecha inicial y último día del mes',()=>{
 const b={id:'x',name:'prueba',amount:100,frequency:'monthly',active:true,next_date:'2026-10-31',due_day:31};
 assert.deepEqual(recurringDates(b,'2026-10-01','2027-01-31'),['2026-10-31','2026-11-30','2026-12-31','2027-01-31']);
 const future={...b,next_date:'2026-10-20',due_day:15};
 assert.deepEqual(recurringDates(future,'2026-10-01','2026-11-30'),['2026-11-15']);
});
test('Compromisos declarados son previsiones; no crean movimientos',()=>{
 const state={accounts:[],movements:[],statements:[],loans:[],recurring_bills:[{id:'a',name:'Renta',direction:'expense',amount:3500,frequency:'monthly',active:true,next_date:'2026-10-30',due_day:30}]};
 const list=dueEvents(state,'2026-10-20','2026-11-30');
 assert.equal(list.length,2);
 assert.equal(state.movements.length,0);
});
test('Un pago a tarjeta no se suma como gasto presupuestado',()=>{
 const mov=[{transaction_date:'2026-10-20',amount:1000,kind:'purchase',category:'Alimentos'},
 {transaction_date:'2026-10-23',amount:1000,kind:'payment',category:'Alimentos'},
 {transaction_date:'2026-10-23',amount:200,kind:'expense',category:'Alimentos'}];
 assert.equal(budgetSpent(mov,'2026-10','Alimentos'),1200);
});
test('Amortización de tasa fija: pago 0% exacto y tasa insuficiente',()=>{
 const p=amortization(1200,0,100);assert.equal(p.rows.length,12);assert.equal(p.totalInterest,0);assert.equal(p.remaining,0);
 const bad=amortization(1200,24,10);assert.ok(bad.warning);assert.equal(bad.rows.length,0);
});
