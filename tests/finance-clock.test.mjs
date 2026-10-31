import test from 'node:test';
import assert from 'node:assert/strict';
import {financeClock,localDay,localTime,timeStatus} from '../finance-clock.mjs';
test('El reloj captura la fecha local del día, sin confundirla con UTC',()=>{
 const date=new Date(2026,9,30,23,57,0);
 assert.equal(localDay(date),'2026-10-30');
 assert.equal(localTime(date),'23:57');
});
test('Reloj detecta automáticamente día siguiente y cambio de mes',()=>{
 let milliseconds=new Date(2026,9,31,23,59,0).getTime();
 const clk=financeClock({now:()=>milliseconds,timeZone:()=> 'America/Mexico_City'});
 assert.equal(clk.today(),'2026-10-31');
 milliseconds+=120000;
 assert.equal(clk.today(),'2026-11-01');
 assert.equal(clk.snapshot().timeZone,'America/Mexico_City');
 assert.equal(clk.snapshot().verified,false);
});
test('Sincroniza con la hora del servidor con corrección de latencia',()=>{
 const start=Date.UTC(2026,9,30,3,0,0);
 let now=start+500;
 const clk=financeClock({now:()=>now,timeZone:()=> 'America/Mexico_City'});
 assert.equal(clk.compareServer(new Date(start+60000).toISOString(),start,start+1000),true);
 const snap=clk.snapshot();
 assert.equal(snap.verified,true);
 assert.equal(snap.driftMs,59500);
 assert.equal(timeStatus(snap).key,'verified');
 assert.equal(clk.needsCheck(),false);
 now+=6*60000;
 assert.equal(clk.needsCheck(),true);
});
test('Un desfase grande genera advertencia pero mantiene fecha corregida',()=>{
 let now=Date.UTC(2026,9,30,12,0,0);
 const clk=financeClock({now:()=>now});
 assert.equal(clk.compareServer(new Date(now+10*60000).toISOString(),now,now),true);
 assert.equal(timeStatus(clk.snapshot()).key,'adjusted');
 assert.match(timeStatus(clk.snapshot()).label,/servidor/);
});
test('Respuesta inválida, demasiado lenta o conexión caída no se considera verificada',()=>{
 const now=Date.UTC(2026,9,30,12,0,0);
 const clk=financeClock({now:()=>now});
 assert.equal(clk.compareServer('error',now,now),false);
 assert.equal(clk.compareServer(new Date(now).toISOString(),now,now+90000),false);
 assert.equal(timeStatus(clk.snapshot()).key,'unverified');
 clk.compareServer(new Date(now).toISOString(),now,now);
 clk.offline();
 assert.equal(clk.snapshot().verified,false);
});
