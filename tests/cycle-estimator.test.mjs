import test from 'node:test';
import assert from 'node:assert/strict';
import {cycleWindow,cycleMonthsFor,estimatedCycle,cycleEstimates,cycleReconciliationSummary} from '../cycle-estimator.mjs';
import {renderCycleLedger,cycleEstimateCard,cycleLedgerAttention} from '../cycle-ledger-ui.mjs';
const stori={id:'st',kind:'credit',name:'Stori crédito',active:true,opening_balance_date:'2026-08-31',opening_balance:5000,cutoff_day:12,due_day:4,due_month_offset:1,due_window_days:0};
const plata={...stori,id:'pl',name:'Plata Card',cutoff_day:5,due_day:5,due_month_offset:1,due_window_days:1};
const base=()=>({accounts:[stori,plata],movements:[],installments:[],statements:[],msi_payment_links:[]});
const movement=(id,date,amount,kind='purchase',extra={})=>({id,account_id:'st',transaction_date:date,amount,kind,...extra});
test('Corte 12 octubre: compras 13 septiembre–12 octubre, las del 13 octubre entran en noviembre',()=>{
 const state=base();state.movements=[
  movement('a','2026-09-12',999),
  movement('b','2026-09-13',500),
  movement('c','2026-10-12',1000),
  movement('d','2026-10-13',200),
  movement('e','2026-11-01',100),
 ];
 const oct=estimatedCycle(state,stori,'2026-10','2026-11-01');
 const nov=estimatedCycle(state,stori,'2026-11','2026-11-01');
 assert.equal(oct.projectedTotal,1500);
 assert.equal(oct.purchaseTotal,1500);
 assert.equal(oct.status,'closed-unverified');
 assert.equal(nov.projectedTotal,300);
 assert.equal(nov.status,'open');
 assert.equal(oct.dueDate,'2026-11-04');
 assert.equal(nov.dueDate,'2026-12-04');
});
test('Compra al corte real utiliza periodo del estado de cuenta si el banco lo movió',()=>{
 const state=base();state.statements=[{id:'statement',account_id:'st',close_date:'2026-10-13',
  period_start:'2026-09-14',due_date:'2026-11-06',no_interest_amount:1400,paid_before_baseline:0}];
 state.movements=[movement('a','2026-09-13',200),movement('b','2026-09-14',400),movement('c','2026-10-13',900)];
 const oct=estimatedCycle(state,stori,'2026-10','2026-11-01');
 assert.equal(oct.projectedTotal,1300);
 assert.equal(oct.status,'official');assert.equal(oct.dueDate,'2026-11-06');assert.equal(oct.difference,100);
 assert.equal(oct.window.startInclusive,'2026-09-14');
});
test('Compras y devoluciones, comisiones e intereses, sumados con precisión centavo',()=>{
 const state=base();state.movements=[
  movement('a','2026-10-15',1000.12),
  movement('b','2026-10-18',300.08),
  movement('c','2026-10-21',40.25,'fee'),
  movement('d','2026-10-23',10.01,'interest'),
  movement('e','2026-10-24',100.06,'refund'),
  movement('f','2026-10-26',3.03,'adjustment_minus'),
  movement('g','2026-10-26',0.02,'adjustment_plus'),
  movement('payment','2026-10-29',1200,'payment')
 ];
 const c=estimatedCycle(state,stori,'2026-11','2026-10-29');
 assert.equal(c.purchaseTotal,1300.2);
 assert.equal(c.extrasTotal,50.28);
 assert.equal(c.creditsTotal,103.09);
 assert.equal(c.projectedTotal,1247.39);
 assert.ok(!c.lines.some(l=>l.type==='payment'));
});
test('MSI asociado: sustituir compra original total por mensualidad exacta, no duplicarla',()=>{
 const state=base();
 state.movements=[movement('original','2026-10-18',9000),
                  movement('other','2026-10-20',120)];
 state.installments=[{id:'msi',account_id:'st',movement_id:'original',entry_type:'new_purchase',
   description:'Laptop',original_amount:9000,months:18,monthly_amount:500,
   first_charge_month:'2026-11-01',installments_paid:0,status:'active'}];
 const nov=estimatedCycle(state,stori,'2026-11','2026-11-01');
 assert.equal(nov.projectedTotal,620);
 assert.equal(nov.msiTotal,500);
 assert.equal(nov.skipped.length,1);
 assert.equal(nov.skipped[0].amount,9000);
 assert.equal(nov.lines.filter(x=>x.type==='msi').length,1);
 const dec=estimatedCycle(state,stori,'2026-12','2026-12-01');
 assert.equal(dec.projectedTotal,500);
});
test('MSI histórico 14 de 18 entra por parcialidad aunque compra original ya esté en saldo inicial',()=>{
 const state=base();state.installments=[{id:'old',account_id:'st',movement_id:null,
  description:'Teléfono',original_amount:9000,months:18,monthly_amount:500,
  first_charge_month:'2025-10-01',installments_paid:13,status:'active'}];
 const nov=estimatedCycle(state,stori,'2026-11','2026-11-01');
 assert.equal(nov.projectedTotal,500);
 assert.match(nov.lines[0].label,/mensualidad 14 de 18/);
});
test('Centavos de mensualidades: el último cargo absorbe ajuste redondeado',()=>{
 const state=base();state.installments=[{id:'round',account_id:'st',original_amount:1724.72,
  months:3,monthly_amount:574.91,first_charge_month:'2026-09-01',status:'active'}];
 const oct=estimatedCycle(state,stori,'2026-10','2026-10-12');
 const nov=estimatedCycle(state,stori,'2026-11','2026-11-12');
 assert.equal(oct.projectedTotal,574.91);
 assert.equal(nov.projectedTotal,574.90);
});
test('Historias capturadas dentro de saldo inicial no aumentan total calculado',()=>{
 const card={...stori,opening_balance_date:'2026-10-20'};
 const state=base();state.movements=[
  movement('legacy','2026-10-17',400,'purchase',{historical_only:true}),
  movement('start','2026-10-20',100,'purchase',{historical_only:true}),
  movement('actual','2026-10-21',125),
 ];
 const nov=estimatedCycle(state,card,'2026-11','2026-11-01');
 assert.equal(nov.projectedTotal,125);assert.equal(nov.partial,true);
 assert.equal(nov.excludedFromBaseline,500);
});
test('Movimientos con fecha de contabilización posterior pertenecen al ciclo posterior',()=>{
 const state=base();state.movements=[
  movement('a','2026-10-12',100,'purchase',{posting_date:'2026-10-13'}),
  movement('b','2026-10-12',200,'purchase',{posting_date:'2026-10-12'}),
  movement('c','2026-10-12',300,'purchase',{posting_date:'2026-11-20'}),
 ];
 const oct=estimatedCycle(state,stori,'2026-10','2026-11-01');
 const nov=estimatedCycle(state,stori,'2026-11','2026-11-01');
 assert.equal(oct.projectedTotal,200);
 assert.equal(nov.projectedTotal,100);
});
test('Pago bancario confirmado prevalece y la diferencia es el importe real menos cálculo, no se modifica',()=>{
 const state=base();state.movements=[movement('a','2026-10-01',1000),
  movement('pay','2026-10-24',500,'payment',{statement_id:'official'})];
 state.statements=[{id:'official',account_id:'st',close_date:'2026-10-12',due_date:'2026-11-04',
   no_interest_amount:3984.58,paid_before_baseline:0}];
 const c=estimatedCycle(state,stori,'2026-10','2026-11-01');
 assert.equal(c.projectedTotal,1000);
 assert.equal(c.officialAmount,3984.58);
 assert.equal(c.difference,2984.58);
 assert.equal(c.pending,3484.58);
 assert.equal(c.linkedPaid,500);
 assert.equal(c.status,'official');
});
test('Historial de ciclo no desaparece cuando vencimiento estimado pasa; queda por conciliar',()=>{
 const state=base();state.movements=[movement('a','2026-10-15',100)];
 const date='2026-12-07';
 const items=cycleReconciliationSummary(state,date);
 assert.ok(items.some(x=>x.closeMonth==='2026-11'&&x.status==='closed-unverified'));
});
test('Corte 5 Plata: octubre 6→noviembre 5, vencimiento estimado diciembre 5–6',()=>{
 const state=base();state.movements=[{id:'pl1',account_id:'pl',transaction_date:'2026-11-05',kind:'purchase',amount:499}];
 const nov=estimatedCycle(state,plata,'2026-11','2026-11-05');
 assert.equal(nov.projectedTotal,499);
 assert.equal(nov.dueDate,'2026-12-05');assert.equal(nov.dueEnd,'2026-12-06');
});
test('Las vistas presentan total calculado separado del oficial y lista detallada',()=>{
 const state=base();state.movements=[movement('a','2026-10-30',300)];
 state.statements=[{id:'official',account_id:'st',close_date:'2026-10-12',due_date:'2026-11-04',no_interest_amount:3984.58}];
 const html=renderCycleLedger(state,'2026-11-01');
 assert.match(html,/Compras acumuladas por periodo de corte/);
 assert.match(html,/Total calculado/);
 assert.match(html,/Pago para no generar intereses/);
 assert.match(html,/3,984.58/);
 assert.match(html,/300.00/);
 assert.match(html,/Ver movimientos del periodo/);
 assert.match(html,/data-act="cycle-add-purchase"/);
 assert.match(cycleLedgerAttention(state,'2026-11-01'),/Stori crédito/);
});

test('Un corte estimado de hace seis meses permanece en revisión si nunca fue conciliado',()=>{
 const state=base();state.accounts[0]={...stori,opening_balance_date:'2026-03-31'};
 state.movements=[movement('april','2026-04-21',1234.50)];
 const rows=cycleReconciliationSummary(state,'2026-11-01');
 assert.ok(rows.some(x=>x.closeMonth==='2026-05'&&x.projectedTotal===1234.5));
 assert.match(cycleLedgerAttention(state,'2026-11-01'),/may/);
});
test('El historial MSI ya marcado como pagado no se confunde con deuda vencida',()=>{
 const state=base();
 state.installments=[{id:'old',account_id:'st',description:'MSI pasado',original_amount:9000,
   months:18,monthly_amount:500,first_charge_month:'2025-10-01',installments_paid:13,status:'active'}];
 const reviews=cycleReconciliationSummary(state,'2026-11-01');
 assert.ok(!reviews.some(x=>x.closeMonth<'2026-11'&&x.accountId==='st'));
});
test('Un corte bancario completamente pagado muestra estado cubierto, sin alerta vencida',()=>{
 const state=base();
 state.statements=[{id:'stmt',account_id:'st',close_date:'2026-10-12',due_date:'2026-11-04',
  no_interest_amount:400,paid_before_baseline:0}];
 state.movements=[movement('pay','2026-10-30',400,'payment',{statement_id:'stmt'})];
 const c=estimatedCycle(state,stori,'2026-10','2026-11-01');
 assert.equal(c.pending,0);
 assert.match(cycleEstimateCard(c),/Pago oficial cubierto/);
 assert.ok(!cycleReconciliationSummary(state,'2026-11-01').some(x=>x.officialId==='stmt'));
});

test('Caso real de control: MSI vinculados por $479.08 y $250 suman $729.08 a deuda del periodo, sin duplicar el abono',()=>{
 const card={...stori,id:'mercado',name:'Mercado crédito',opening_balance_date:'2026-09-01',opening_balance:5000};
 const state={accounts:[card],statements:[],installments:[
  {id:'reloj',account_id:'mercado',description:'Reloj Samsung',original_amount:5749,months:12,
   monthly_amount:479.08,first_charge_month:'2026-06-01',installments_paid:6,status:'active'},
  {id:'otro',account_id:'mercado',description:'Otro MSI',original_amount:3000,months:12,
   monthly_amount:250,first_charge_month:'2026-06-01',installments_paid:6,status:'active'}],
  movements:[{id:'pago',account_id:'mercado',kind:'payment',amount:1682.53,
   transaction_date:'2026-11-01',description:'Pago real a tarjeta'}],
  msi_payment_links:[
   {id:'uno',installment_id:'reloj',installment_number:6,payment_movement_id:'pago',allocated_amount:479.08},
   {id:'dos',installment_id:'otro',installment_number:6,payment_movement_id:'pago',allocated_amount:250}]};
 const nov=estimatedCycle(state,card,'2026-11','2026-11-02');
 assert.equal(nov.linkedMsiTotal,729.08);
 assert.equal(nov.scheduledMsiTotal,0);
 assert.equal(nov.msiTotal,729.08);
 assert.equal(nov.projectedTotal,729.08);
 assert.equal(nov.lines.filter(x=>x.type==='msi_linked').length,2);
 assert.equal(nov.lines.filter(x=>x.type==='msi').length,0);
 assert.ok(!nov.lines.some(x=>x.type==='payment'));
 const report=cycleEstimateCard(nov);
 assert.match(report,/729\.08/);
 assert.match(report,/MSI vinculados/);
 assert.equal(state.movements.length,1);
});
test('Vincular un MSI en un mes distinto al previsto solo lo suma una vez, en el periodo del vínculo',()=>{
 const card={...stori,opening_balance_date:'2026-09-01'};
 const state=base();state.accounts[0]=card;
 state.installments=[{id:'reloj',account_id:'st',description:'Reloj',
 original_amount:1200,months:3,monthly_amount:400,first_charge_month:'2026-09-01',status:'active'}];
 state.movements=[{id:'bank',account_id:'st',kind:'payment',amount:400,transaction_date:'2026-11-20'}];
 state.msi_payment_links=[{id:'link',installment_id:'reloj',installment_number:2,payment_movement_id:'bank',allocated_amount:400}];
 const october=estimatedCycle(state,card,'2026-10','2026-11-21');
 const december=estimatedCycle(state,card,'2026-12','2026-11-21');
 assert.equal(october.msiTotal,0);
 assert.equal(december.linkedMsiTotal,400);
 assert.equal(december.msiTotal,400); // número 2 ya se excluyó del mes estimado
});
