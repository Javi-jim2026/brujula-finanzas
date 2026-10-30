import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CARD_COLORS,suggestedCardColor,resolvedCardColor,cardGradientStyle,openCardColors,saveCardColor} from '../card-colors.mjs';
test('Paleta consistente y tonos con contraste para tarjetas',()=>{
 assert.equal(CARD_COLORS.length,12);
 assert.equal(new Set(CARD_COLORS.map(c=>c.id)).size,12);
 for(const color of CARD_COLORS){
  assert.match(color.start,/^#[0-9a-f]{6}$/);
  assert.match(color.end,/^#[0-9a-f]{6}$/);
 }
});
test('Las tarjetas existentes reciben color orientativo sin alterar sus datos',()=>{
 assert.equal(suggestedCardColor({name:'Nu Crédito'}),'violet');
 assert.equal(suggestedCardColor({name:'Stori'}),'orange');
 assert.equal(suggestedCardColor({name:'HSBC Zero'}),'red');
 assert.equal(suggestedCardColor({name:'Plata Card'}),'black');
 assert.equal(suggestedCardColor({name:'BBVA Azul'}),'blue');
 const card={id:'a',name:'Nu',card_color:null,opening_balance:9000};
 const before=JSON.stringify(card);
 assert.equal(resolvedCardColor(card).id,'violet');
 assert.equal(JSON.stringify(card),before);
});
test('Color personalizado prevalece sin permitir CSS arbitrario',()=>{
 assert.equal(resolvedCardColor({name:'Nu',card_color:'green'}).id,'green');
 assert.equal(resolvedCardColor({name:'Nu',card_color:'url(javascript:alert(1))'}).id,'violet');
 const style=cardGradientStyle({name:'Nu',card_color:'blue'});
 assert.equal(style,'--card-from:#06468f;--card-to:#2473c5');
 assert.ok(!style.includes('url('));
});
test('Editor ofrece vista previa y 12 colores sin campos de dinero',()=>{
 let html='',table='';
 const ctx={state:{accounts:[{id:'tarjeta',name:'Nu',kind:'credit',opening_balance:2000}]},
  modalOpen:(title,t,body)=>{table=t;html=body},toast:()=>{}};
 openCardColors(ctx,'tarjeta');
 assert.equal(table,'card_color');
 assert.match(html,/name="account_id" value="tarjeta"/);
 assert.match(html,/name="card_color"/);
 assert.match(html,/card-color-preview/);
 assert.equal((html.match(/class="card-color-choice"/g)||[]).length,12);
 assert.ok(!html.includes('name="opening_balance"'));
});
test('Guardar color en demo modifica solamente aspecto, no saldos',async()=>{
 const account={id:'a',name:'Nu',opening_balance:5000,credit_limit:20000,card_color:null};
 const data={accounts:[account],movements:[{id:'m',account_id:'a',kind:'payment',amount:500}]};
 const beforeBalance=account.opening_balance,beforeMovements=JSON.stringify(data.movements);
 const fd=new Map([['account_id','a'],['card_color','orange']]);
 const previous=globalThis.FormData;
 globalThis.FormData=class{constructor(){return {get:k=>fd.get(k)}}};
 try{
  const x=await saveCardColor({state:data,mode:'demo'},{});
  assert.equal(x,'orange');
  assert.equal(account.card_color,'orange');
  assert.equal(account.opening_balance,beforeBalance);
  assert.equal(JSON.stringify(data.movements),beforeMovements);
  fd.set('card_color','<script>');await assert.rejects(()=>saveCardColor({state:data,mode:'demo'},{}),/paleta/);
 }finally{globalThis.FormData=previous}
});
test('Editor integrado a Resumen, Tarjetas y expediente, cacheado en PWA',()=>{
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const detail=fs.readFileSync(new URL('../account-detail.mjs',import.meta.url),'utf8');
 const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.ok(app.includes('cardGradientStyle(a)'));
 assert.ok(app.includes('data-act="card-color"'));
 assert.ok(app.includes("table==='card_color'"));
 assert.ok(app.includes("cardColorChange(e)"));
 assert.ok(detail.includes('account-color-banner'));
 assert.ok(detail.includes('data-act="card-color"'));
 assert.ok(sw.includes("'./card-colors.mjs'"));
 assert.ok(sw.includes("'card-colors.mjs'"));
});
