import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduledMsiEntries,ledgerEntries,msiPaymentAssignments,msiPaymentSummary} from '../msi-ledger.mjs';
import {getAccountLedgerEntries,getAccountMovements} from '../account-detail.mjs';
import {accountBalanceFrom,availableCreditFrom} from '../finance-rules.mjs';
import fs from 'node:fs';
const card={id:'st',kind:'credit',name:'Mercado crédito',credit_limit:12000,opening_balance:5749,opening_balance_date:'2026-10-01',cutoff_day:12};
const plan={id:'reloj',account_id:'st',description:'Reloj samsung',original_amount:5749,months:12,monthly_amount:479.08,first_charge_month:'2026-06-01',installments_paid:6,status:'active',entry_type:'historical',movement_id:null};
const data=()=>({accounts:[{...card}],movements:[{id:'realpayment',account_id:'st',kind:'payment',amount:600,transaction_date:'2026-11-01',description:'Abono real'}],installments:[{...plan}],msi_payment_links:[{id:'link',payment_movement_id:'realpayment',installment_id:'reloj',installment_number:6,allocated_amount:479.08}],statements:[]});
test('Reloj Samsung 6/12 muestra UN SOLO gasto: la mensualidad 6 que se vinculó',()=>{
 const state=data(),before=JSON.stringify(state);
 const rows=scheduledMsiEntries(state,'2026-11-02');
 assert.equal(rows.length,1);
 assert.equal(rows[0].installment_number,6);
 assert.equal(rows[0].amount,479.08);
 assert.equal(rows[0].transaction_date,'2026-11-01');
 assert.equal(rows[0].kind,'msi_expense');
 assert.match(rows[0].description,/Gasto MSI · Reloj samsung · mensualidad 6 de 12/);
 assert.equal(JSON.stringify(state),before); // no altera ni una compra ni un saldo guardado
});
test('Si NO se vinculó ningún pago, NO aparecen cargos aunque el plan marque 6 mensualidades pagadas',()=>{
 const state=data();state.msi_payment_links=[];
 assert.deepEqual(scheduledMsiEntries(state,'2026-11-02'),[]);
 assert.equal(ledgerEntries(state,'2026-11-02','st').length,1);
 assert.equal(getAccountLedgerEntries(state,'st','charges','2026-11-02').length,0);
});
test('Vincular un pago existente muestra un gasto MSI, conserva el abono sin duplicarlo',()=>{
 const state=data();
 const before=accountBalanceFrom(state.accounts[0],state.movements,'2026-11-02');
 const rows=ledgerEntries(state,'2026-11-02','st');
 const bank=rows.find(m=>m.id==='realpayment');
 const msi=rows.find(m=>m.virtual);
 assert.equal(rows.length,2);
 assert.equal(bank.kind,'payment');
 assert.equal(msi.kind,'msi_expense');
 assert.equal(msi.amount,479.08);
 assert.match(msiPaymentSummary(state,bank),/Reloj samsung · mensualidad 6 de 12/);
 assert.deepEqual(msiPaymentAssignments(state,'realpayment').map(x=>x.amount),[479.08]);
 assert.equal(accountBalanceFrom(state.accounts[0],state.movements,'2026-11-02'),before);
 assert.equal(availableCreditFrom(state.accounts[0],[],state.movements,'2026-11-02'),6851);
 assert.equal(state.movements.length,1);
});
test('Nunca genera gastos por fechas futuras, pasadas o por contador del plan',()=>{
 const state=data();
 assert.equal(scheduledMsiEntries(state,'2026-10-31').length,0);
 assert.equal(scheduledMsiEntries(state,'2026-11-02').length,1);
 assert.equal(scheduledMsiEntries(state,'2026-12-01').length,1);
 assert.equal(scheduledMsiEntries(state,'2027-06-15').length,1);
});
test('El registro mantiene solamente movimientos reales y el gasto MSI expresamente vinculado',()=>{
 const state=data();
 assert.equal(ledgerEntries(state,'2026-11-02','st','all').length,2);
 assert.equal(ledgerEntries(state,'2026-11-02','st','msi_schedule').length,1);
 assert.equal(ledgerEntries(state,'2026-11-02','st','payment').length,1);
 assert.equal(ledgerEntries(state,'2026-11-02','st','purchase').length,0);
 assert.equal(getAccountLedgerEntries(state,'st','all','2026-11-02').length,2);
 assert.equal(getAccountLedgerEntries(state,'st','charges','2026-11-02').length,1);
 assert.equal(getAccountLedgerEntries(state,'st','msi_schedule','2026-11-02').length,1);
 assert.equal(getAccountLedgerEntries(state,'st','payments','2026-11-02').length,1);
 assert.equal(getAccountMovements(state,'st').length,1);
});
test('Dos vínculos explícitos a un mismo abono producen dos gastos y ningún cargo extra',()=>{
 const state=data();state.installments.push({...plan,id:'otro',description:'Otro MSI',months:10,installments_paid:2});
 state.msi_payment_links.push({id:'link2',payment_movement_id:'realpayment',installment_id:'otro',installment_number:2,allocated_amount:100});
 const rows=scheduledMsiEntries(state,'2026-11-02');
 assert.equal(rows.length,2);
 assert.deepEqual(rows.map(x=>x.amount).sort((a,b)=>a-b),[100,479.08]);
 assert.equal(state.movements.length,1);
});
test('Vínculo sin pago real verificable jamás crea un gasto de muestra',()=>{
 const state=data();state.movements=[];assert.equal(scheduledMsiEntries(state,'2026-11-02').length,0);
 state.movements=[{id:'realpayment',account_id:'otro',kind:'payment',amount:600,transaction_date:'2026-11-01'}];
 assert.equal(scheduledMsiEntries(state,'2026-11-02').length,0);
});
test('Gasto MSI se ve en Registro y tarjeta sin conceptos incompletos de meses anteriores',()=>{
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const detail=fs.readFileSync(new URL('../account-detail.mjs',import.meta.url),'utf8');
 assert.match(app,/Gastos MSI vinculados/);
 assert.match(app,/Gasto MSI vinculado/);
 assert.match(detail,/Gasto MSI vinculado/);
 assert.match(app,/msi-ledger-row/);
 assert.match(detail,/getAccountLedgerEntries/);
});
