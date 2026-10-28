import test from 'node:test';
import assert from 'node:assert/strict';
import {
 accountBalanceFrom,paymentPending,availableCreditFrom,assertMovementAfterBaseline,
 assertBaselineSafe,paymentApplied
} from '../finance-rules.mjs';

const a={id:'cc',kind:'credit',opening_balance:1000,opening_balance_date:'2026-10-24',credit_limit:5000};
const purchases=[
 {id:'old',account_id:'cc',transaction_date:'2026-10-24',kind:'purchase',amount:300},
 {id:'new',account_id:'cc',transaction_date:'2026-10-25',kind:'purchase',amount:100},
 {id:'pay',account_id:'cc',transaction_date:'2026-10-26',kind:'payment',amount:50}
];
test('El saldo inicial contiene todo lo anterior: no duplica compras antiguas',()=>{
 assert.equal(accountBalanceFrom(a,purchases),1050);
 assert.equal(accountBalanceFrom({...a,opening_balance_date:null},purchases),1350);
});
test('Los MSI anteriores solo son plan informativo y no suben la deuda',()=>{
 const plan={id:'x',account_id:'cc',original_amount:2400,months:12,installments_paid:5,entry_type:'historical'};
 assert.equal(accountBalanceFrom(a,purchases.concat([])),1050);
 assert.equal(plan.entry_type,'historical');
});
test('Los pagos previos y posteriores del estado se aplican una sola vez',()=>{
 const stmt={id:'st1',no_interest_amount:2000,paid_before_baseline:200};
 const mov=[{statement_id:'st1',kind:'payment',amount:350},{statement_id:'st1',kind:'purchase',amount:120}];
 assert.equal(paymentApplied(stmt,mov),550);
 assert.equal(paymentPending(stmt,mov),1450);
 assert.equal(paymentPending({...stmt,paid_before_baseline:0},[]),2000);
});
test('Disponible proyectado desde fecha exacta de instantánea, no desde corte anterior',()=>{
 const statement={id:'s',account_id:'cc',close_date:'2026-10-20',available_at:'2026-10-24',bank_available:2000};
 const movements=[{account_id:'cc',transaction_date:'2026-10-24',kind:'purchase',amount:300},
 {account_id:'cc',transaction_date:'2026-10-25',kind:'purchase',amount:100},
 {account_id:'cc',transaction_date:'2026-10-26',kind:'payment',amount:50}];
 assert.equal(availableCreditFrom(a,[statement],movements,'2026-10-27'),1950);
});
test('No se puede volver a cargar una operación ya incluida en el saldo inicial',()=>{
 assert.throws(()=>assertMovementAfterBaseline(a,purchases[0]),/anterior o igual/);
 assert.doesNotThrow(()=>assertMovementAfterBaseline(a,purchases[1]));
 assert.throws(()=>assertBaselineSafe(a,purchases,'2026-10-24'),/duplicaría o excluiría/);
 assert.doesNotThrow(()=>assertBaselineSafe(a,purchases,'2026-10-23'));
});
