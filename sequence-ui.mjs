/* Brújula v1.14 · Secuencia visible por cada tarjeta */
import {sequenceForAll} from './sequence-engine.mjs';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=x=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(x)||0);
const date=x=>x?new Date(x+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'}):'—';
const phases={before:'Antes del corte', 'cutoff-day':'Hoy es el corte habitual',after:'Después del corte',unconfigured:'Sin día de corte configurado'};
const limitNotes={'needs-limit':'Falta límite de crédito','over-limit':'Deuda estimada superior al límite','exhausted':'Sin disponible estimado','low':'Disponible estimado bajo','available':'Disponible estimado dentro del límite'};
export function renderSequencePanel(state,asOf){
 const rows=sequenceForAll(state,asOf);
 if(!rows.length)return '';
 const cards=rows.map(s=>{
  const next=s.nextDue;
  const dueLabel=!next?'Sin pago programado':next.source==='official'?
   'Pago oficial pendiente '+money(next.amount)+' · vence '+date(next.date):
   'Posible vencimiento '+date(next.date)+(next.windowEnd&&next.windowEnd!==next.date?' a '+date(next.windowEnd):'')+' · importe desconocido';
  const events=s.events.filter(e=>(e.kind==='cutoff'||e.kind==='due')&&e.date>=asOf).slice(0,4);
  return '<div class="sequence-card">'+
   '<div class="sequence-card-title"><b>'+esc(s.name)+'</b><span>'+esc(phases[s.cyclePhase])+'</span></div>'+
   '<div class="sequence-metrics"><div><small>Límite</small><b>'+money(s.limit)+'</b></div>'+
   '<div><small>Deuda estimada</small><b>'+money(s.debt)+'</b></div>'+
   '<div><small>Disponible estimado</small><b>'+money(s.available)+'</b></div></div>'+
   '<p class="sequence-limit '+(s.limitState==='over-limit'||s.limitState==='low'||s.limitState==='exhausted'?'warn':'')+'">'+
   esc(limitNotes[s.limitState])+(s.utilization!==null?' · Uso estimado '+s.utilization+'%':'')+'</p>'+
   '<p class="sequence-payment">'+(next?.source==='official'?'✅ ':'◷ ')+esc(dueLabel)+'</p>'+
   '<div class="sequence-events">'+events.map(e=>'<div><span>'+date(e.date)+
    (e.windowEnd&&e.windowEnd!==e.date?'–'+date(e.windowEnd):'')+'</span><b>'+
    (e.kind==='cutoff'?'Corte':'Vencimiento')+'</b><small>'+
    (e.source==='official'?'Confirmado en estado de cuenta':'Estimado')+'</small></div>').join('')+'</div>'+
   '<div class="inline-actions"><button class="btn-mini" data-act="view-account" data-id="'+esc(s.accountId)+'">Abrir tarjeta</button>'+
   '<button class="btn-mini" data-act="cycle-statement" data-id="'+esc(s.accountId)+'">Registrar corte real</button></div></div>';
 }).join('');
 return '<section class="panel section" id="sequence-engine-panel"><div class="section-title"><div>'+
 '<h3>⏱️ Motor de secuencias y límites</h3>'+
 '<p class="muted small">Evaluación '+date(asOf)+'. Cada tarjeta recorre corte → vencimiento → siguiente corte. Los eventos futuros no afectan los saldos.</p></div></div>'+
 '<div class="sequence-grid">'+cards+'</div><p class="tip">El reloj es una referencia de la aplicación. Las fechas estimadas no confirman un corte ni sustituyen el importe del banco. El límite y la deuda son estimaciones basadas en registros capturados.</p></section>';
}
