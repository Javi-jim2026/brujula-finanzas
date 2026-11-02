/* Brújula v1.15 · compras de cada periodo, estilo control por corte de Excel */
import {cycleEstimates,cycleReconciliationSummary} from './cycle-estimator.mjs';
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=x=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(x)||0);
const date=x=>x?new Date(x+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'}):'—';
const statuses={
 official:'Corte bancario confirmado',
 'closed-unverified':'Corte estimado alcanzado · verificar',
 open:'Periodo abierto / próximo'
};
export function cycleEstimateCard(c){
 const official=c.status==='official', past=c.status==='closed-unverified';
 const statusLabel=official?'Dato oficial registrado':past?'Falta conciliación del banco':'Estimación en construcción';
 const hasAmount=c.lines.length>0;
 const dueText=c.dueDate?' · vence '+date(c.dueDate)+(c.dueEnd!==c.dueDate?' al '+date(c.dueEnd):''):'';
 return '<article class="cycle-ledger-card'+(past?' needs-check':'')+'">'+
 '<div class="cycle-ledger-head"><div><b>'+safe(c.accountName)+'</b><small>'+
 safe(statuses[c.status])+'</small></div><span class="cycle-ledger-state">'+safe(statusLabel)+'</span></div>'+
 '<div class="cycle-ledger-period"><span>'+
 (c.window.startInclusive?'Desde '+date(c.window.startInclusive):'Después del '+date(c.window.startExclusive))+
 ' · hasta '+date(c.closeDate)+'</span><small>Corte '+date(c.closeDate)+dueText+'</small></div>'+
 '<div class="cycle-ledger-totals"><div><small>Compras registradas</small><strong>'+money(c.purchaseTotal)+'</strong></div>'+
 '<div><small>MSI del corte</small><strong>'+money(c.msiTotal)+'</strong></div>'+
 '<div><small>Comisiones / intereses / ajustes</small><strong>'+money(c.extrasTotal)+'</strong></div>'+
 '<div><small>Devoluciones / bonificaciones</small><strong>−'+money(c.creditsTotal)+'</strong></div></div>'+
 '<div class="cycle-ledger-result"><span>Total calculado<small>Solo con tus registros</small></span><b>'+money(c.projectedTotal)+'</b></div>'+
 (official?'<div class="cycle-ledger-official"><div><span>Pago para no generar intereses (banco)</span><b>'+money(c.officialAmount)+'</b></div>'+
 '<div><span>Diferencia banco − cálculo</span><b>'+money(c.difference)+'</b></div>'+
 '<div><span>Pago oficial aún pendiente</span><b>'+money(c.pending)+'</b></div>'+
 '<p>La diferencia puede reflejar compras no registradas, saldo anterior, promociones, ajustes o fechas de contabilización. No se modifica el importe del banco.</p></div>':
 '<p class="cycle-ledger-advisory">'+(c.finished?'El corte estimado pasó. Confirma el estado de cuenta; no lo consideramos pagado automáticamente.':'Este periodo sigue abierto: las nuevas compras irán aumentando el total calculado.')+'</p>')+
 (c.partial?'<p class="cycle-ledger-warning">⚠️ Periodo posiblemente incompleto: se registraron saldos iniciales durante este ciclo o falta la fecha inicial. No es el total exigible del banco.</p>':'')+
 '<details class="cycle-ledger-details"><summary>Ver movimientos del periodo ('+c.lines.length+')</summary>'+
 (c.lines.length?c.lines.map(line=>'<div class="cycle-ledger-line"><span>'+date(line.date)+' · '+safe(line.label)+'</span><b>'+
  (line.amount<0?'−':'')+money(Math.abs(line.amount))+'</b></div>').join(''):'<p class="muted small">No hay compras capturadas en este periodo.</p>')+
 (c.skipped.length?'<p class="muted small">'+c.skipped.length+' compra(s) originales MSI excluidas del total para evitar duplicados.</p>':'')+
 '</details>'+
 '<div class="inline-actions cycle-ledger-actions"><button class="btn-mini" data-act="cycle-add-purchase" data-id="'+safe(c.accountId)+'">+ Registrar compra</button>'+
 (official?'<button class="btn-mini" data-act="edit-statement" data-id="'+safe(c.officialId)+'">Ver corte oficial</button>':
 '<button class="btn-mini" data-act="cycle-statement" data-id="'+safe(c.accountId)+'">Confirmar corte del banco</button>')+
 '</div></article>';
}
export function renderCycleLedger(state,asOf,{compact=false}={}){
 const list=cycleEstimates(state,asOf,{back:compact?1:2,ahead:compact?0:1});
 if(!list.length)return '<section class="panel section" id="cycle-ledger"><h3>🧮 Compras acumuladas por corte</h3><p class="muted">Configura las fechas de corte de tus tarjetas para calcular sus periodos.</p></section>';
 const grouped=new Map();
 for(const c of list){if(!grouped.has(c.accountId))grouped.set(c.accountId,[]);grouped.get(c.accountId).push(c)}
 const accounts=[...grouped].map(([accountId,items])=>{
  items.sort((a,b)=>b.closeDate.localeCompare(a.closeDate));
  return '<div class="cycle-ledger-account"><h4>💳 '+safe(items[0].accountName)+'</h4>'+
   '<div class="cycle-ledger-card-list">'+items.map(cycleEstimateCard).join('')+'</div></div>';
 }).join('');
 return '<section class="panel section cycle-ledger" id="cycle-ledger">'+
  '<div class="section-title"><div><h3>🧮 Compras acumuladas por periodo de corte</h3>'+
  '<p class="muted small">Como tu control en Excel: sumamos compras, mensualidades MSI, cargos y bonificaciones del periodo de cada tarjeta. Se actualiza al registrar o editar movimientos.</p></div></div>'+
  '<p class="tip">El total calculado es una estimación, no reemplaza el pago para no generar intereses del estado de cuenta. Un pago al banco no es una compra nueva y no se suma dos veces.</p>'+
  '<div class="cycle-ledger-accounts">'+accounts+'</div></section>';
}
export function cycleLedgerAttention(state,asOf){
 const rows=cycleReconciliationSummary(state,asOf);
 if(!rows.length)return '';
 return '<section class="panel section"><h3>📌 Cortes que necesitan seguimiento</h3><p class="muted small">'+
 rows.length+' ciclo(s) con pago oficial pendiente o corte estimado sin conciliar. Los cálculos nunca registran un pago automáticamente.</p>'+
 '<div class="cycle-ledger-attention">'+rows.map(r=>'<div><b>'+safe(r.accountName)+'</b>'+
 '<span>Corte '+date(r.closeDate)+' · '+(r.status==='official'?'Pendiente oficial '+money(r.pending):'Calculado '+money(r.projectedTotal)+' · verificar con banco')+'</span></div>').join('')+'</div></section>';
}
