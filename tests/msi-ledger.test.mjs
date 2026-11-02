import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduledMsiEntries,ledgerEntries,msiPaymentAssignments,msiPaymentSummary,monthLabel} from '../msi-ledger.mjs';
import {getAccountLedgerEntries,getAccountMovements} from '../account-detail.mjs';
import {accountBalanceFrom,availableCreditFrom} from '../finance-rules.mjs';
import {installmentAmount} from '../msi-payment-link.mjs';
import fs from 'node:fs';
const card={id:'st',kind:'credit',name:'Mercado crédito',credit_limit:12000,opening_balance:5749,opening_balance_date:'2026-10-01',cutoff_day:12};
const plan={id:'reloj',account_id:'st',description:'Reloj samsung',original_amount:5749,months:12,monthly_amount:479.08,first_charge_month:'2026-06-01',installments_paid:6,status:'active',entry_type:'historical',movement_id:null};
const data=()=>({accounts:[{...card}],movements:[{id:'realpayment',account_id:'st',kind:'payment',amount:600,transaction_date:'2026-11-01',description:'Abono real'}],installments:[{...plan}],msi_payment_links:[{id:'link',payment_movement_id:'realpayment',installment_id:'reloj',installment_number:6,allocated_amount:479.08}],statements:[]});
test('Reloj Samsung 6/12 muestra mensualidad informativa de noviembre y no inventa cargo bancario',()=>{
 const s=data(),before=JSON.stringify(s);
 const virtual=scheduledMsiEntries(s,'2026-11-02');
 assert.equal(virtual.length,6);
 const sixth=virtual.find(m=>m.installment_number===6);
 assert.equal(sixth.cycle_month,'2026-11');assert.equal(sixth.amount,479.08);
 assert.equal(sixth.virtual,true);assert.equal(sixth.linked,true);
 assert.equal(sixth.status,'Pago vinculado');
 assert.match(sixth.description,/Reloj samsung/);
 assert.equal(JSON.stringify(s),before);
 assert.equal(s.movements.length,1);
});
test('Vincular pago existente no genera nuevo movimiento y anotación aparece sobre el mismo abono',()=>{
 const s=data();
 const before=accountBalanceFrom(s.accounts[0],s.movements,'2026-11-02');
 const rows=ledgerEntries(s,'2026-11-02','st');
 const payment=rows.find(m=>m.id==='realpayment');
 assert.equal(payment.kind,'payment');
 assert.match(msiPaymentSummary(s,payment),/Reloj samsung · mensualidad 6 de 12/);
 assert.deepEqual(msiPaymentAssignments(s,'realpayment').map(x=>x.amount),[479.08]);
 assert.equal(accountBalanceFrom(s.accounts[0],s.movements,'2026-11-02'),before);
 assert.equal(availableCreditFrom(s.accounts[0],[],s.movements,'2026-11-02'),6851);
});
test('Próximas mensualidades se muestran solo en MSI hasta llegar a su mes programado',()=>{
 const s=data();
 assert.equal(scheduledMsiEntries(s,'2026-10-31').length,5);
 assert.equal(scheduledMsiEntries(s,'2026-11-02').length,6);
 assert.equal(scheduledMsiEntries(s,'2026-12-01').length,7);
 assert.equal(scheduledMsiEntries(s,'2027-06-15').length,12);
});
test('Filtrar mensuales y pagos en Registro no duplica compras ni abonos',()=>{
 const s=data();
 assert.equal(ledgerEntries(s,'2026-11-02','st','all').length,7);
 assert.equal(ledgerEntries(s,'2026-11-02','st','msi_schedule').length,6);
 assert.equal(ledgerEntries(s,'2026-11-02','st','payment').length,1);
 assert.equal(ledgerEntries(s,'2026-11-02','st','purchase').length,0);
});
test('Detalle de tarjeta muestra virtuales en Cargos y MSI, pero resumen real no los suma',()=>{
 const s=data();
 assert.equal(getAccountLedgerEntries(s,'st','all','2026-11-02').length,7);
 assert.equal(getAccountLedgerEntries(s,'st','charges','2026-11-02').length,6);
 assert.equal(getAccountLedgerEntries(s,'st','msi_schedule','2026-11-02').length,6);
 assert.equal(getAccountLedgerEntries(s,'st','payments','2026-11-02').length,1);
 assert.equal(getAccountMovements(s,'st').length,1);
});
test('Última parcialidad ajusta centavos y el extracto mantiene el importe correcto',()=>{
 const s=data();s.installments[0]={...plan,original_amount:5749,monthly_amount:479.08};
 assert.equal(installmentAmount(s.installments[0],11),479.12);
 const final=scheduledMsiEntries(s,'2027-05-01').find(m=>m.installment_number===12);
 assert.equal(final.amount,479.12);
});
test('Control seguro: planes cancelados, otras tarjetas y fechas malformadas no aparecen',()=>{
 const s=data();s.installments.push({...plan,id:'other',status:'cancelled'});
 assert.equal(scheduledMsiEntries(s,'2026-11-02','other').length,0);
 assert.equal(scheduledMsiEntries(s,'nonsense').length,0);
 assert.equal(scheduledMsiEntries(s,'2026-11-02','st').length,6);
});
test('Etiquetas de mes y controles instalados en app móvil sin alterar movimientos financieros',()=>{
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const details=fs.readFileSync(new URL('../account-detail.mjs',import.meta.url),'utf8');
 assert.match(monthLabel('2026-11'),/nov/i);
 assert.match(app,/Cargo MSI \\(informativo\\)/);
 assert.match(app,/msi-ledger-row/);
 assert.match(details,/getAccountLedgerEntries/);
 assert.match(details,/msi-linked-payment/);
});
