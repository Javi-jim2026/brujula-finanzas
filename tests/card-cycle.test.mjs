import test from 'node:test';
import assert from 'node:assert/strict';
import {cycleRule,cycleDates,cardPaymentTimeline,cardPaymentPreview,upcomingCardPayments} from '../card-cycle.mjs';
import {cycleAgenda,cardCycleLabel} from '../cycle-ui.mjs';
import {paymentPlan} from '../payday-planning.mjs';
const today='2026-10-29';
const stori={id:'stori',name:'Stori',kind:'credit',cutoff_day:12,due_day:4,due_month_offset:1,due_window_days:0,active:true};
const plata={id:'plata',name:'Plata Card',kind:'credit',cutoff_day:5,due_day:5,due_month_offset:1,due_window_days:1,active:true};
const data={accounts:[stori,plata],statements:[],movements:[],loans:[],loan_payments:[],recurring_bills:[],recurring_checks:[],recurring_postings:[]};
test('Stori corte 12 octubre proyecta pago 4 noviembre',()=>{
 const c=cycleDates(stori,'2026-10');
 assert.deepEqual(c,{closeMonth:'2026-10',cutoff:'2026-10-12',earliest:'2026-11-04',latest:'2026-11-04',variable:false});
 const p=cardPaymentPreview(data,stori,today);
 assert.equal(p.date,'2026-11-04');assert.equal(p.source,'estimated');assert.equal(p.amount,null);assert.equal(p.key,'forecast-soon');
});
test('Plata 5 octubre con posible 5 o 6 noviembre, no inventa el monto',()=>{
 const c=cycleDates(plata,'2026-10');
 assert.equal(c.earliest,'2026-11-05');assert.equal(c.latest,'2026-11-06');
 const p=cardPaymentPreview(data,plata,today);
 assert.equal(p.date,'2026-11-05');assert.equal(p.latestDate,'2026-11-06');assert.equal(p.amount,null);
});
test('Sin relación de meses configurada, no inventa vencimiento',()=>{
 const unknown={...stori,due_month_offset:null};
 assert.equal(cycleRule(unknown),null);
 assert.equal(cycleDates(unknown,'2026-10'),null);
 assert.equal(cardPaymentTimeline(unknown,[],[],today).length,0);
});
test('Febrero y fin de mes se ajustan correctamente, sin saltarse año',()=>{
 const feb={...stori,cutoff_day:28,due_day:28,due_month_offset:1,due_window_days:0};
 assert.equal(cycleDates(feb,'2026-01').earliest,'2026-02-28');
 assert.equal(cycleDates(feb,'2028-01').earliest,'2028-02-28');
 assert.equal(cycleDates(feb,'2026-12').earliest,'2027-01-28');
 assert.equal(cycleDates({...feb,cutoff_day:20,due_day:10,due_month_offset:0},'2026-10'),null);
});
test('Corte real manda sobre pronóstico y solo sus pagos vinculados reducen deuda',()=>{
 const official={id:'close1',account_id:'stori',close_date:'2026-10-12',due_date:'2026-11-06',no_interest_amount:1100,paid_before_baseline:0};
 const paid={...data,statements:[official],movements:[{id:'p1',account_id:'stori',kind:'payment',statement_id:'close1',amount:300}]};
 const p=cardPaymentPreview(paid,stori,today);
 assert.equal(p.source,'official');
 assert.equal(p.date,'2026-11-06');
 assert.equal(p.amount,800);
 assert.equal(p.key,'scheduled'); // Nov 6 está a ocho días del 29 de octubre
 const altered={...paid,movements:[...paid.movements,{id:'p2',account_id:'stori',kind:'payment',amount:400}]};
 assert.equal(cardPaymentPreview(altered,stori,today).amount,800);
 const complete={...paid,movements:[...paid.movements,{id:'p3',account_id:'stori',kind:'payment',statement_id:'close1',amount:800}]};
 assert.equal(cardPaymentPreview(complete,stori,today).source,'estimated'); // following cycle, covered one is skipped in preview
});
test('El vencimiento oficial confirmado y sin pago sigue presente cuando está vencido',()=>{
 const state={...data,statements:[{id:'s1',account_id:'stori',close_date:'2026-09-12',due_date:'2026-10-04',no_interest_amount:2000,paid_before_baseline:0}]};
 const list=upcomingCardPayments(state,today);
 assert.ok(list.some(x=>x.key==='overdue'&&x.amount===2000));
 assert.ok(list.some(x=>x.source==='estimated'&&x.date==='2026-11-04'));
});
test('Planeación de siete días detecta Stori y siguiente semana Plata sin sumar importe incierto',()=>{
 const a=paymentPlan(data,'2026-10-29','2026-11-04',{today});
 const b=paymentPlan(data,'2026-11-05','2026-11-11',{today});
 assert.equal(a.required,0);assert.equal(b.required,0);
 assert.deepEqual(a.cardForecasts.map(p=>p.accountName),['Stori']);
 assert.deepEqual(b.cardForecasts.map(p=>p.accountName),['Plata Card']);
});
test('Vista enseña origen, diferencia entre fechas estimadas y oficiales, y controles',()=>{
 const html=cycleAgenda(data,today);
 assert.match(html,/Stori/);assert.match(html,/Plata Card/);
 assert.match(html,/Importe por confirmar/);
 assert.match(html,/5 nov 2026 al 6 nov 2026/);
 assert.match(html,/data-act="cycle-statement"/);
 assert.match(cardCycleLabel(data,plata,today),/Fecha proyectada/);
});
