import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanDate,csvMatrix,detectTable} from '../statement-import.mjs';
test('Parsea fechas mexicanas sin convertirlas a formato estadounidense',()=>{
 assert.equal(cleanDate('29/10/2026'),'2026-10-29');
 assert.equal(cleanDate('2026-10-29'),'2026-10-29');
 assert.equal(cleanDate('05/11/26'),'2026-11-05');
});
test('Reconoce CSV con campos entrecomillados, cargos y abonos',()=>{
 const csv='Fecha,Descripción,Cargo,Abono\n28/10/2026,"Gasolina, zona norte","1,200.00",\n29/10/2026,Pago de tarjeta,,"500.00"';
 const matrix=csvMatrix(csv),items=detectTable(matrix,{kind:'credit'});
 assert.equal(items.length,2);
 assert.deepEqual(items.map(x=>[x.date,x.amount,x.kind]),[
 ['2026-10-28',1200,'purchase'],['2026-10-29',500,'payment']]);
 assert.equal(items[0].description,'Gasolina, zona norte');
});
test('Los gastos de débito usan tipo gasto e ingreso',()=>{
 const items=detectTable(csvMatrix('Fecha;Concepto;Cargo;Abono\n21/10/2026;Despensa;200;\n22/10/2026;Nómina;;1000'),{kind:'debit'});
 assert.deepEqual(items.map(x=>x.kind),['expense','income']);
});
test('No inventa movimientos de filas incompletas',()=>{
 const items=detectTable(csvMatrix('Fecha,Concepto,Importe\nNo es fecha,ABC,200\n23/10/2026,Abono,'''),{kind:'credit'});
 assert.equal(items.length,0);
});
