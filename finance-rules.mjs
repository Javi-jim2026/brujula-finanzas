/* Brújula Finanzas: reglas financieras puras v1.4.
 * Nunca sumar planes MSI al saldo; solo movimientos. El banco confirma el pago sin intereses.
 */
export const pesos = value => Math.round((Number(value) || 0) * 100) / 100;
export function movementDelta(m, a) {
 const x=pesos(m.amount);
 if(a.kind==='credit') return ['purchase','fee','interest','adjustment_plus','transfer_in'].includes(m.kind)?x:-x;
 return ['income','refund','adjustment_plus','transfer_in'].includes(m.kind)?x:-x;
}
export function eligibleMovements(a, movements) {
 return movements.filter(m => m.account_id===a.id && (!a.opening_balance_date || m.transaction_date>a.opening_balance_date));
}
export function accountBalanceFrom(a,movements) {
 return pesos(pesos(a.opening_balance)+eligibleMovements(a,movements).reduce((n,m)=>n+movementDelta(m,a),0));
}
export function paymentPending(s,movements) {
 const assigned=movements.filter(m=>m.statement_id===s.id&&m.kind==='payment').reduce((n,m)=>n+pesos(m.amount),0);
 return Math.max(0,pesos(pesos(s.no_interest_amount)-pesos(s.paid_before_baseline)-assigned));
}
export function availableCreditFrom(a, statements, movements, today) {
 const snap=statements.filter(s=>s.account_id===a.id && s.bank_available!=null &&
   (s.available_at||s.close_date)<=today).sort((x,y)=>
    (y.available_at||y.close_date).localeCompare(x.available_at||x.close_date))[0];
 if(snap){
   const snapDate=snap.available_at||snap.close_date;
   const changes=movements.filter(m=>m.account_id===a.id && (m.posting_date||m.transaction_date)>snapDate)
     .reduce((n,m)=>n+movementDelta(m,a),0);
   return Math.max(0,Math.min(pesos(a.credit_limit),pesos(pesos(snap.bank_available)-changes)));
 }
 return Math.max(0,pesos(pesos(a.credit_limit)-accountBalanceFrom(a,movements)));
}
export function assertMovementAfterBaseline(account, movement){
 if(account?.opening_balance_date && movement.transaction_date<=account.opening_balance_date)
  throw Error('Esta operación es anterior o igual al saldo inicial ('+account.opening_balance_date+'). Ya está incluida en la deuda inicial; no se vuelve a sumar.');
}
export function assertBaselineSafe(a, movements, date) {
 if(!date)return;
 const count=movements.filter(m=>m.account_id===a.id && m.transaction_date<=date).length;
 if(count)throw Error('La tarjeta tiene '+count+' movimiento(s) hasta el día del saldo inicial. Cambiar la fecha duplicaría o excluiría registros; primero concilia el historial.');
}
export function paymentApplied(s,movements) {
 return pesos(pesos(s.paid_before_baseline)+movements.filter(m=>m.statement_id===s.id&&m.kind==='payment').reduce((n,m)=>n+pesos(m.amount),0));
}
