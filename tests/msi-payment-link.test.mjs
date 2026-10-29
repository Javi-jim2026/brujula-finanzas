import test from 'node:test';
import assert from 'node:assert/strict';
import {installmentAmount,eligibleMsiPayments,paymentRoom,msiLinkHistory,openMsiLink,saveMsiLink} from '../msi-payment-link.mjs';
import {accountBalanceFrom} from '../finance-rules.mjs';
function fixture(){
 return {accounts:[{id:'cc',kind:'credit',name:'Nu',opening_balance:6000,credit_limit:12000,opening_balance_date:'2026-01-01'}],
  movements:[{id:'pay1',kind:'payment',account_id:'cc',transaction_date:'2026-10-19',amount:1700,description:'Pago completo del corte'}],
  installments:[{id:'plan1',account_id:'cc',description:'Teléfono',months:18,installments_paid:13,original_amount:9000,monthly_amount:500,status:'active',first_charge_month:'2025-09-01'}],
  msi_payment_links:[],statements:[]};
}
test('Importe MSI de pago 14 de 18 conserva mensualidad y cálculo de último mes',()=>{
 const p=fixture().installments[0];
 assert.equal(installmentAmount(p,13),500);
 assert.equal(installmentAmount(p,17),500);
 assert.equal(installmentAmount({original_amount:1000,months:3,monthly_amount:null},2),333.34);
});
test('Pago total de 1700 puede respaldar MSI de 500 sin dividirlo ni duplicarlo',()=>{
 const data=fixture();assert.equal(paymentRoom(data,data.movements[0]),1700);
 assert.deepEqual(eligibleMsiPayments(data,data.installments[0]).map(m=>m.id),['pay1']);
 data.msi_payment_links.push({installment_id:'plan1',installment_number:14,payment_movement_id:'pay1',allocated_amount:500});
 assert.equal(paymentRoom(data,data.movements[0]),1200);
 assert.equal(data.movements.length,1);
 assert.equal(accountBalanceFrom(data.accounts[0],data.movements),4300);
});
test('Un pago solo se ofrece si alcanza para la mensualidad y pertenece a esa tarjeta',()=>{
 const data=fixture();
 data.movements.push({id:'small',kind:'payment',account_id:'cc',transaction_date:'2026-10-20',amount:400});
 data.movements.push({id:'other',kind:'payment',account_id:'another',transaction_date:'2026-10-20',amount:6000});
 data.msi_payment_links.push({payment_movement_id:'pay1',installment_id:'old',installment_number:1,allocated_amount:1300});
 assert.deepEqual(eligibleMsiPayments(data,data.installments[0]).map(m=>m.id),[]);
});
test('En modo demo: vinculando pago existente solo incrementa MSI sin tocar movimientos bancarios',async()=>{
 const state=fixture();
 const ctx={state,mode:'demo',uid:()=> 'demo-link',dateToday:()=> '2026-10-29'};
 const fd=new Map([['installment_id','plan1'],['payment_mode','existing'],['payment_id','pay1']]);
 const prior=globalThis.FormData;
 globalThis.FormData=class {constructor(){return {get:k=>fd.get(k)}}};
 try{
  const result=await saveMsiLink(ctx,{});
  assert.equal(result.period,14);
  assert.equal(result.part,500);
  assert.equal(state.installments[0].installments_paid,14);
  assert.equal(state.movements.length,1);
  assert.equal(state.msi_payment_links.length,1);
  assert.match(msiLinkHistory(state,state.installments[0]),/Mensualidad 14 de 18/);
 }finally{globalThis.FormData=prior}
});
test('Pago futuro y pagos duplicados deben rechazarse en demo antes de crear movimientos',async()=>{
 const state=fixture();
 const fd=new Map([['installment_id','plan1'],['payment_mode','new'],['payment_total','500'],['payment_date','2026-11-01'],['statement_id','']]);
 const prior=globalThis.FormData;
 globalThis.FormData=class {constructor(){return {get:k=>fd.get(k)}}};
 try{
  await assert.rejects(()=>saveMsiLink({state,mode:'demo',dateToday:()=> '2026-10-29',uid:()=> 'x'},{}),/futuro/);
  assert.equal(state.movements.length,1);
 }finally{globalThis.FormData=prior}
});
test('Confirmar pago nuevo en demo crea exactamente un abono y lo liga al avance',async()=>{
 const state=fixture();
 const fd=new Map([['installment_id','plan1'],['payment_mode','new'],['payment_total','1700'],['payment_date','2026-10-29'],['statement_id','']]);
 const prior=globalThis.FormData;
 globalThis.FormData=class {constructor(){return {get:k=>fd.get(k)}}};
 let count=0;
 try{
  const before=accountBalanceFrom(state.accounts[0],state.movements);
  await saveMsiLink({state,mode:'demo',dateToday:()=> '2026-10-29',uid:()=> 'demo-'+(++count)}, {});
  const after=accountBalanceFrom(state.accounts[0],state.movements);
  assert.equal(before-after,1700);
  assert.equal(state.movements.length,2);
  assert.equal(state.msi_payment_links[0].allocated_amount,500);
  assert.equal(state.installments[0].installments_paid,14);
 }finally{globalThis.FormData=prior}
});
