import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {renderExtra} from '../planning-ui.mjs';
import {renderImport} from '../statement-import.mjs';

const state={
 accounts:[{id:'a1',name:'Tarjeta ficticia',kind:'credit',opening_balance:1000,credit_limit:2000}],
 movements:[],installments:[],loan_payments:[],recurring_checks:[],
 statements:[{id:'s1',account_id:'a1',close_date:'2026-10-15',due_date:'2026-11-05',no_interest_amount:800,paid_before_baseline:0}],
 loans:[{id:'l1',name:'Auto ficticio',status:'active',financed_amount:100000,monthly_payment:3000,annual_rate:12,next_due_date:'2026-11-08'}],
 recurring_bills:[{id:'b1',name:'Internet de prueba',amount:500,frequency:'monthly',due_day:30,next_date:'2026-10-30',direction:'expense',active:true}],
 budgets:[{id:'p1',month:'2026-10-01',category:'Servicios',amount:1500}]
};
const ctx={state,mode:'demo',dateToday:()=> '2026-10-29',thisMonth:()=> '2026-10',
 money:n=>String(n),accountBalance:a=>a.opening_balance,pendingStatement:s=>s.no_interest_amount};
test('Todas las nuevas pantallas producen contenido útil sin alterar los datos',()=>{
 const before=JSON.stringify(state);
 for(const name of ['bills','calendar','budgets','amortization','reminders']){
  const html=renderExtra(name,ctx);
  assert.equal(typeof html,'string');
  assert.ok(html.length>100,name+' vacía');
  assert.ok(html.includes('panel'),name+' sin estructura');
 }
 assert.ok(renderImport(ctx).includes('Importar estado de cuenta'));
 assert.equal(JSON.stringify(state),before);
});
test('El controlador principal mantiene navegación para todos los módulos',()=>{
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.ok(app.includes("$$('[data-page]').forEach"),'La navegación debe iterar nodos, no un solo elemento');
 for(const m of ['planning-ui.mjs','statement-import.mjs','finance-rules.mjs'])assert.ok(app.includes(m));
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 for(const page of ['bills','calendar','budgets','import','reminders'])assert.ok(html.includes('data-page="'+page+'"'));
 const mobile=html.match(/<nav class="bottom-nav" id="mobile-nav">([\s\S]*?)<\/nav>/)?.[1]||'';
 assert.ok(mobile.includes('data-page="statements"'),'Pagos debe estar en el menú móvil');
 assert.ok(mobile.indexOf('data-page="statements"')<mobile.indexOf('data-page="movements"'),'Pagos debe ser accesible al inicio del menú');
});
