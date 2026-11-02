import test from 'node:test';
import assert from 'node:assert/strict';
import {creditPortfolio,msiPortfolioPilot,remainingPlanBalance} from '../credit-portfolio.mjs';
const card={id:'mercado',kind:'credit',name:'Mercado crédito',bank_name:'Mercado Pago',credit_limit:8600,opening_balance:0,opening_balance_date:'2026-10-12'};
const watch={id:'watch',account_id:'mercado',description:'Reloj Samsung',original_amount:5749,months:12,monthly_amount:479.08,installments_paid:6,status:'active',entry_type:'historical'};
const other={id:'other',account_id:'mercado',description:'Otra compra',original_amount:3000,months:12,monthly_amount:250,installments_paid:6,status:'active'};
const fixture=()=>({accounts:[{...card}],installments:[{...watch},{...other}],movements:[
 {id:'buy',account_id:'mercado',transaction_date:'2026-10-15',kind:'purchase',amount:1152.5},
 {id:'bank',account_id:'mercado',transaction_date:'2026-10-29',kind:'payment',amount:1682.53}],
 msi_payment_links:[
 {installment_id:'watch',installment_number:6,payment_movement_id:'bank',allocated_amount:479.08},
 {installment_id:'other',installment_number:6,payment_movement_id:'bank',allocated_amount:250}]
});
test('Mercado Crédito usa motor MSI, otras tarjetas conservan fórmula vigente',()=>{
 assert.equal(msiPortfolioPilot(card),true);
 assert.equal(msiPortfolioPilot({...card,name:'Stori',bank_name:'Stori'}),false);
});
test('Reloj Samsung: los seis pagos pendientes reservan todo su capital, incluido ajuste final',()=>{
 assert.equal(remainingPlanBalance(watch).remainingMonths,6);
 assert.equal(remainingPlanBalance(watch).amount,2874.52);
});
test('La disponibilidad resta los seis pagos pendientes y no duplica abonos vinculados',()=>{
 const s=fixture(), before=JSON.stringify(s);
 const calc=creditPortfolio(card,s,'2026-11-02');
 assert.equal(calc.msiPending,4374.52);
 assert.equal(calc.remainingInstallments,12);
 assert.equal(calc.purchases,1152.5);
 assert.equal(calc.msiLinkedPaid,729.08);
 assert.equal(calc.ordinaryPayments,953.45);
 assert.equal(calc.debt,4573.57);
 assert.equal(calc.available,4026.43);
 assert.equal(JSON.stringify(s),before);
});
test('Registrar un pago MSI incrementa mensualidades pagadas, reduciendo capital pero sin restar pago doble',()=>{
 const s=fixture();const before=creditPortfolio(card,s,'2026-11-02');
 const p=s.installments[0];p.installments_paid++;
 s.movements.push({id:'payment2',account_id:'mercado',transaction_date:'2026-11-02',kind:'payment',amount:479.08});
 s.msi_payment_links.push({installment_id:'watch',installment_number:7,payment_movement_id:'payment2',allocated_amount:479.08});
 const after=creditPortfolio(card,s,'2026-11-02');
 assert.equal(Math.round((before.debt-after.debt)*100),47908);
 assert.equal(Math.round((after.msiLinkedPaid-before.msiLinkedPaid)*100),47908);
 assert.equal(after.ordinaryPayments,before.ordinaryPayments);
});
test('Una compra MSI nueva enlazada no se vuelve a sumar al capital pendiente',()=>{
 const s=fixture();
 s.movements.push({id:'original',account_id:'mercado',transaction_date:'2026-10-20',kind:'purchase',amount:5749});
 s.installments[0].movement_id='original';
 const c=creditPortfolio(card,s,'2026-11-02');
 assert.equal(c.debt,4573.57);
 assert.equal(c.originalMsiExcluded,5749);
});
test('No incluye compras futuras y respeta el saldo inicial solo como punto de fecha',()=>{
 const s=fixture();
 s.movements.push({id:'later',account_id:'mercado',kind:'purchase',transaction_date:'2026-12-01',amount:100});
 assert.equal(creditPortfolio(card,s,'2026-11-02').debt,4573.57);
 s.accounts[0].opening_balance=10000;
 assert.equal(creditPortfolio(s.accounts[0],s,'2026-11-02').debt,4573.57);
});

test('Mercado Crédito: saldo real del periodo + seis MSI, excluyendo el pago previo sin borrarlo',()=>{
 const s=fixture();s.installments=s.installments.slice(0,1);
 const a={...card,period_debt_amount:1881.58,period_debt_date:'2026-11-02',period_debt_recorded_at:'2026-11-02T10:00:00Z'};
 const before=JSON.stringify(s),p=creditPortfolio(a,s,'2026-11-02');
 assert.equal(p.snapshot,true);
 assert.equal(p.periodDebt,1881.58);
 assert.equal(p.msiPending,2874.52);
 assert.equal(p.excludedPriorPayment,1682.53);
 assert.equal(p.ordinaryPayments,0);
 assert.equal(p.debt,4756.10);
 assert.equal(p.available,3843.90);
 assert.equal(JSON.stringify(s),before);
});
test('BBVA y DiDi solo usan MSI futuros al capturar saldo del periodo (sin duplicar sus saldos actuales)',()=>{
 for(const bank of ['BBVA','DiDi']){
  const a={...card,id:bank,name:bank,bank_name:bank,opening_balance:3000};
  assert.equal(msiPortfolioPilot(a),false);
  const snapshot={...a,period_debt_amount:1000,period_debt_date:'2026-11-02'};
  assert.equal(msiPortfolioPilot(snapshot),true);
  const s={installments:[{...watch,account_id:bank}],movements:[],msi_payment_links:[]};
  assert.equal(creditPortfolio(snapshot,s,'2026-11-02').debt,3874.52);
 }
});
test('El saldo de referencia solo suma compras y abonos posteriores, no modifica meses anteriores',()=>{
 const a={...card,period_debt_amount:1881.58,period_debt_date:'2026-11-02',period_debt_recorded_at:'2026-11-02T10:00:00Z'};
 const s=fixture();s.installments=s.installments.slice(0,1);
 s.movements.push({id:'new',account_id:'mercado',kind:'purchase',amount:90,transaction_date:'2026-11-03'});
 s.movements.push({id:'pay-new',account_id:'mercado',kind:'payment',amount:50,transaction_date:'2026-11-03'});
 assert.equal(creditPortfolio(a,s,'2026-11-03').debt,4796.10);
 assert.equal(creditPortfolio(a,s,'2026-11-02').debt,4756.10);
});
test('Los movimientos creados después del saldo en el mismo día se contabilizan una sola vez',()=>{
 const a={...card,period_debt_amount:1881.58,period_debt_date:'2026-11-02',period_debt_recorded_at:'2026-11-02T10:00:00Z'};
 const s={installments:[watch],movements:[
  {id:'old',account_id:'mercado',kind:'purchase',amount:90,transaction_date:'2026-11-02',created_at:'2026-11-02T09:00:00Z'},
  {id:'new',account_id:'mercado',kind:'purchase',amount:50,transaction_date:'2026-11-02',created_at:'2026-11-02T11:00:00Z'}
 ],msi_payment_links:[]};
 assert.equal(creditPortfolio(a,s,'2026-11-02').debt,4806.10);
});
