/* Brújula v1.16 · Desglose verificable de saldo comprometido por MSI. */
import {creditPortfolio,msiPortfolioPilot} from './credit-portfolio.mjs';
const money=n=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(n)||0);
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
function rows(p){
 const item=(label,value,negative=false)=>'<div class="summary-line"><span>'+label+'</span><b>'+(negative?'−':'')+money(value)+'</b></div>';
 return (p.snapshot?item('Deuda actual confirmada · '+p.referenceDate,p.periodDebt):'')+
  item('MSI futuros pendientes · '+p.remainingInstallments+' mensualidades',p.msiPending)+
  p.msiPlans.map(x=>'<div class="summary-line"><span>'+safe(x.description)+' · '+x.remainingMonths+' pagos restantes</span><b>'+money(x.amount)+'</b></div>').join('')+
  item('Compras normales registradas',p.purchases)+
  (p.otherCharges?item('Otros cargos',p.otherCharges):'')+
  (p.snapshot?(p.ordinaryPayments?item('Abonos posteriores al saldo de referencia',p.ordinaryPayments,true):'')+
   (p.excludedPriorPayment?item('Abonos anteriores ya conciliados (solo historial)',p.excludedPriorPayment):''):
   item('Abonos sin asignar a MSI',p.ordinaryPayments,true))+
  (p.refunds?item('Bonificaciones',p.refunds,true):'')+
  item('Deuda estimada que compromete el límite',p.debt)+
  item('Disponible estimado',p.available);
}
export function renderPortfolioOverview(state,asOf){
 const cards=(state.accounts||[]).filter(msiPortfolioPilot);
 if(!cards.length)return '';
 return cards.map(card=>{
  const p=creditPortfolio(card,state,asOf);
  return '<section class="panel section"><div class="section-title"><h3>💳 '+safe(card.name)+' · Saldo con MSI restantes</h3></div>'+
   '<div class="summary-table">'+rows(p)+'</div>'+
   '<p class="tip">'+(p.snapshot?'La deuda actual fue confirmada manualmente para el '+safe(p.referenceDate)+'. Los pagos anteriores se conservan como historial y no se vuelven a descontar. Solo se aplican movimientos posteriores.':'Sin saldo actual conciliado, se utiliza la estimación histórica. Establece una deuda actual de referencia para evitar descontar abonos de otro periodo.')+
   ' Evita incluir un mismo MSI tanto en deuda actual como en MSI futuros. El disponible del banco puede diferir.</p></section>';
 }).join('');
}
export function renderAccountPortfolio(state,card,asOf){
 if(!msiPortfolioPilot(card))return '';
 const p=creditPortfolio(card,state,asOf);
 return '<section class="panel section"><div class="section-title"><h3>Desglose de deuda con MSI pendientes</h3></div>'+
  '<div class="summary-table">'+rows(p)+'</div>'+
  '<p class="tip">Capital MSI futuro: '+money(p.msiPending)+
  '. '+(p.snapshot?'Saldo actual confirmado '+money(p.periodDebt)+' a '+safe(p.referenceDate)+'. Se excluyen pagos previos sin eliminarlos.':'No hay saldo de periodo confirmado: cálculo histórico provisional.')+
  ' No sumes mensualidades duplicadas entre el saldo actual y los MSI pendientes. Disponible estimado; no es consulta bancaria.</p></section>';
}
