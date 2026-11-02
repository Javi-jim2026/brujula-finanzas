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
 assert.equal(before.debt-after.debt,479.08);
 assert.equal(after.msiLinkedPaid-before.msiLinkedPaid,479.08);
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
