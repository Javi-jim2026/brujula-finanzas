import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {getAccountMovements,renderAccountDetails,accountDetailAction} from '../account-detail.mjs';
import {recurringReviewPanel,pendingRecurringCount} from '../recurring-review.mjs';
const state={
 accounts:[{id:'nu',name:'Nu',kind:'credit',opening_balance:500,credit_limit:3000,opening_balance_date:'2026-10-01',last4:'1234'},
 {id:'bbva',name:'BBVA',kind:'credit',opening_balance:700,credit_limit:4000}],
 movements:[{id:'nu1',account_id:'nu',transaction_date:'2026-10-02',kind:'purchase',amount:120,description:'Compra Nu'},
 {id:'nu2',account_id:'nu',transaction_date:'2026-10-03',kind:'payment',amount:70,description:'Pago Nu'},
 {id:'bbva1',account_id:'bbva',transaction_date:'2026-10-04',kind:'payment',amount:999,description:'Pago BBVA'}],
 statements:[],recurring_bills:[],recurring_checks:[],recurring_postings:[]
};
const ctx={state,dateToday:()=> '2026-10-29',accountBalance:a=>a.opening_balance,
 shownAvailable:a=>a.credit_limit-a.opening_balance,pendingStatement:()=>0,
 kinds:{purchase:'Compra',payment:'Pago'} ,render:()=>{},setPage:p=>{ctx.current=p},toast:()=>{}};
test('Historial de una tarjeta nunca mezcla pagos de otra',()=>{
 assert.deepEqual(getAccountMovements(state,'nu').map(x=>x.id),['nu2','nu1']);
 assert.deepEqual(getAccountMovements(state,'nu','payments').map(x=>x.id),['nu2']);
 assert.deepEqual(getAccountMovements(state,'bbva','payments').map(x=>x.id),['bbva1']);
});
test('Abrir una cuenta muestra su historial exclusivo',()=>{
 assert.equal(accountDetailAction({dataset:{act:'view-account',id:'nu'}},ctx),true);
 assert.equal(ctx.current,'account-detail');
 const html=renderAccountDetails(ctx);
 assert.ok(html.includes('Compra Nu')&&html.includes('Pago Nu'));
 assert.ok(!html.includes('Pago BBVA'));
 assert.ok(html.includes('account-pay'));
});
test('Recurrente genera pendientes sin insertar movimientos ni abonarlos',()=>{
 const recurring={id:'plan1',name:'Netflix',category:'Suscripciones',direction:'expense',amount:249,
  frequency:'monthly',due_day:25,next_date:'2026-10-25',active:true,account_id:'nu'};
 const x={...state,recurring_bills:[recurring]};
 const before=JSON.stringify(x.movements);
 const panel=recurringReviewPanel({...ctx,state:x});
 assert.ok(panel.includes('Netflix')&&panel.includes('Revisar y registrar'));
 assert.equal(pendingRecurringCount({...ctx,state:x}),1);
 assert.equal(JSON.stringify(x.movements),before);
});
test('Recurrente confirmado o descartado no vuelve a figurar pendiente',()=>{
 const bill={id:'plan2',name:'Internet',direction:'expense',amount:550,frequency:'monthly',
  due_day:25,next_date:'2026-10-25',active:true};
 const x={...state,recurring_bills:[bill],recurring_postings:[{
  bill_id:'plan2',occurrence_date:'2026-10-25',status:'posted',confirmed_amount:550
 }]};
 assert.equal(pendingRecurringCount({...ctx,state:x}),0);
 assert.ok(recurringReviewPanel({...ctx,state:x}).includes('Registrado en movimientos'));
});
test('Formulario permite seleccionar pago y oculta campos innecesarios',()=>{
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.ok(app.includes("type==='payment'"));
 assert.ok(app.includes("form.elements[name]?.closest('label')?.classList.toggle('hidden',payment)"));
 assert.ok(app.includes("row.description='Pago a tarjeta'"));
 assert.ok(app.includes("if(table==='recurring_review')await saveRecurringReview"));
});
