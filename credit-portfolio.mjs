/* Brújula v1.16 · Piloto de cartera MSI para Mercado Crédito.
 * El saldo del periodo es distinto a la deuda completa que compromete el límite.
 * La deuda estimada incluye TODO el capital MSI pendiente, no solo la parcialidad del mes.
 * Los abonos relacionados con MSI NO vuelven a reducir ese capital: installments_paid ya lo hizo.
 * Funciones genéricas; el encendido inicial está limitado a Mercado Crédito.
 */
import {installmentAmount} from './msi-payment-link.mjs';
import {eligibleMovements,movementDelta,pesos} from './finance-rules.mjs';
export function msiPortfolioPilot(card){
 return Boolean(card?.kind==='credit'&&/mercado/i.test(String(card.name||'')+' '+String(card.bank_name||'')));
}
const cents=n=>Math.round((Number(n)||0)*100);
export function remainingPlanBalance(plan){
 const total=Math.min(120,Math.max(0,Math.trunc(Number(plan.months)||0)));
 const paid=Math.max(0,Math.min(total,Math.trunc(Number(plan.installments_paid)||0)));
 let remaining=0;
 for(let i=paid;i<total;i++)remaining+=cents(installmentAmount(plan,i));
 return {paid,remainingMonths:total-paid,amount:pesos(remaining/100)};
}
export function creditPortfolio(card,state,asOf){
 const plans=(state.installments||[]).filter(p=>p.account_id===card.id&&p.status!=='cancelled');
 const linkedPurchaseIds=new Set(plans.filter(p=>p.movement_id).map(p=>String(p.movement_id)));
 const msiPlans=plans.map(p=>{
  const x=remainingPlanBalance(p);
  return {id:p.id,description:p.description||'Plan MSI',...x};
 });
 const msiPending=pesos(msiPlans.reduce((n,p)=>n+p.amount,0));
 const movements=eligibleMovements(card,state.movements||[],asOf);
 const linkAllocations=new Map();
 for(const link of state.msi_payment_links||[]){
  if(!plans.some(p=>p.id===link.installment_id))continue;
  const key=String(link.payment_movement_id);
  linkAllocations.set(key,(linkAllocations.get(key)||0)+cents(link.allocated_amount));
 }
 let purchases=0,extraCharges=0,payments=0,refunds=0,msiLinkedPaid=0,ignoredOriginal=0;
 const ledger=[];
 for(const m of movements){
  if(m.kind==='purchase'&&linkedPurchaseIds.has(String(m.id))){
   ignoredOriginal+=cents(m.amount);
   continue; // capital MSI ya contado en remainingPlanBalance
  }
  if(m.kind==='payment'){
   const amount=cents(m.amount), linked=Math.max(0,Math.min(amount,linkAllocations.get(String(m.id))||0));
   const ordinary=amount-linked;
   payments+=ordinary;msiLinkedPaid+=linked;
   ledger.push({id:m.id,kind:'payment',date:m.transaction_date,nonMsiPayment:pesos(ordinary/100),linkedMsiPaid:pesos(linked/100)});
   continue;
  }
  const change=cents(movementDelta(m,card));
  if(['purchase','adjustment_plus','fee','interest','transfer_in'].includes(m.kind)){
   if(m.kind==='purchase')purchases+=change;else extraCharges+=change;
  }else if(change<0){refunds+=-change}
 }
 const regular=pesos((purchases+extraCharges-payments-refunds)/100);
 const debt=pesos(Math.max(0,msiPending+regular));
 const limit=Math.max(0,pesos(card.credit_limit));
 return {accountId:card.id,msiPlans,msiPending,remainingInstallments:msiPlans.reduce((n,p)=>n+p.remainingMonths,0),
  purchases:pesos(purchases/100),otherCharges:pesos(extraCharges/100),
  ordinaryPayments:pesos(payments/100),msiLinkedPaid:pesos(msiLinkedPaid/100),
  refunds:pesos(refunds/100),originalMsiExcluded:pesos(ignoredOriginal/100),
  regularDebt:regular,debt,available:pesos(Math.max(0,limit-debt)),limit,
  warning:'Estimación basada en los MSI y movimientos registrados. Saldos o retenciones no capturados por el banco pueden causar diferencias.'};
}
