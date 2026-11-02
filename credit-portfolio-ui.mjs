/* Brújula v1.16 · Desglose verificable de saldo comprometido por MSI. */
import {creditPortfolio,msiPortfolioPilot} from './credit-portfolio.mjs';
const money=n=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(n)||0);
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
function rows(p){
 const item=(label,value,negative=false)=>'<div class="summary-line"><span>'+label+'</span><b>'+(negative?'−':'')+money(value)+'</b></div>';
 return item('MSI pendientes · '+p.remainingInstallments+' mensualidades',p.msiPending)+
  p.msiPlans.map(x=>'<div class="summary-line"><span>'+safe(x.description)+' · '+x.remainingMonths+' pagos restantes</span><b>'+money(x.amount)+'</b></div>').join('')+
  item('Compras normales registradas',p.purchases)+
  (p.otherCharges?item('Otros cargos',p.otherCharges):'')+
  item('Abonos sin asignar a MSI',p.ordinaryPayments,true)+
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
   '<p class="tip">Se incluyen todas las mensualidades pendientes, no solo la del corte. Los '+money(p.msiLinkedPaid)+
   ' de pagos vinculados ya redujeron las mensualidades pendientes y no se descuentan por segunda vez. '+
   'Este cálculo no utiliza la antigua deuda inicial; el disponible real del banco puede diferir por operaciones faltantes o retenciones.</p></section>';
 }).join('');
}
export function renderAccountPortfolio(state,card,asOf){
 if(!msiPortfolioPilot(card))return '';
 const p=creditPortfolio(card,state,asOf);
 return '<section class="panel section"><div class="section-title"><h3>Desglose de deuda con MSI pendientes</h3></div>'+
  '<div class="summary-table">'+rows(p)+'</div>'+
  '<p class="tip">Capital total pendiente de MSI: '+money(p.msiPending)+
  '. Pagos ya vinculados a MSI: '+money(p.msiLinkedPaid)+
  ' (no se restan de nuevo). La deuda del periodo de corte es un cálculo separado. '+
  'Disponible estimado: no es una consulta directa al banco.</p></section>';
}
