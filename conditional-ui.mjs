/* Brújula v1.13 · semáforo de reglas por tarjeta */
import {cycleSpendSummary,accountCycleDecisions} from './conditional-engine.mjs';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=x=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(x)||0);
const date=x=>x?new Date(x+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short'}):'—';
export function conditionCard(d){
 if(!d.configured)return '<div class="cycle-decision-card"><strong>'+esc(d.accountName)+'</strong><p class="muted small">Falta configurar el día de corte. No se puede asignar la compra a un ciclo.</p><button class="btn-mini" data-act="card-cycle" data-id="'+esc(d.accountId)+'">Configurar ciclo</button></div>';
 const p=d.payment;
 const state=d.cutoffToday?'Corte habitual hoy':d.cutoffPassed?'Corte habitual ya pasó':'Antes del corte';
 const tag=d.cutoffToday?'cycle-decision-today':d.cutoffPassed?'cycle-decision-past':'';
 const pay=p?.source==='official'?
  '<b>'+money(p.amount)+' pendientes</b> · Fecha oficial '+date(p.date):
  p?'<b>Importe aún desconocido</b> · Pago previsto '+date(p.date)+(p.latestDate!==p.date?' al '+date(p.latestDate):''):
  '<b>Pago pendiente de confirmar</b> · Falta configurar vencimiento';
 const closeRemark=d.cutoffToday||d.cutoffPassed?
  '<p class="muted small">El cierre previsto no fija automáticamente cuánto debes pagar. Verifica el estado de cuenta emitido por el banco.</p>':'';
 return '<div class="cycle-decision-card '+tag+'">'+
 '<div class="cycle-decision-header"><strong>💳 '+esc(d.accountName)+'</strong><span>'+esc(state)+'</span></div>'+
 '<div class="cycle-decision-line"><span>Ciclo actual: corte '+date(d.currentClose)+'</span><b>'+money(d.cycleSpend)+'</b></div>'+
 '<small>'+d.purchaseCount+' compra(s) nuevas capturadas en este ciclo. No equivalen al pago oficial.</small>'+
 (d.historicalSpend>0?'<small>Gastos históricos informativos: '+money(d.historicalSpend)+' (sin impacto en saldo).</small>':'')+
 '<div class="cycle-decision-due">'+pay+'</div>'+closeRemark+
 '<div class="inline-actions"><button class="btn-mini" data-act="view-account" data-id="'+esc(d.accountId)+'">Ver tarjeta</button>'+
 '<button class="btn-mini" data-act="cycle-statement" data-id="'+esc(d.accountId)+'">Registrar pago oficial</button></div></div>';
}
export function renderConditionsByCard(state,today){
 const list=cycleSpendSummary(state,state.accounts,today);
 if(!list.length)return '';
 return '<section class="panel section" id="condition-cycles"><div class="section-title">'+
 '<div><h3>🧠 Decisiones por fecha y corte</h3><p class="muted small">Cada tarjeta evalúa si hoy está antes, en el día o después de su corte, qué compras pertenecen al ciclo y qué pago ya confirmó el banco.</p></div></div>'+
 '<div class="cycle-decision-grid">'+list.map(conditionCard).join('')+'</div>'+
 '<p class="tip">Un importe de compras registradas no es automáticamente el pago para no generar intereses; ese pago solo aparece confirmado después de capturar el corte del banco. Registros históricos anteriores al saldo inicial no incrementan la deuda.</p></section>';
}
export function renderAccountCycleCondition(state,account,today){
 const d=accountCycleDecisions(state,account,today);
 if(!d)return '';
 return '<section class="panel section"><div class="section-title"><h3>Reglas de corte de esta tarjeta</h3></div>'+conditionCard(d)+'</section>';
}
