/* Brújula v1.9. Panel de nómina 15/30, consulta solamente. */
import {salaryPeriod,weekPeriod,paymentPlan,treasurySummary} from './payday-planning.mjs';
let cycleOffset=0,weekOffset=0;
const fmt=n=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(n)||0);
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateStr=iso=>new Date(iso+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short'});
const periodRange=p=>dateStr(p.start)+' – '+dateStr(p.end);
const stat=(label,val,helper,emphasis=false)=>'<div class="panel stat'+(emphasis?' featured':'')+'"><label>'+safe(label)+'</label><strong>'+fmt(val)+'</strong><span class="hint">'+safe(helper)+'</span></div>';
const heading=(title,start,end,next=null)=>'<div class="section-title"><div><h3>'+safe(title)+'</h3><p class="muted small">'+safe(periodRange({start,end}))+(next?' · Próxima nómina '+safe(dateStr(next)):'')+'</p></div></div>';
const totals=(plan,liquid)=>'<div class="grid stats">'+
 stat('Pagos por cubrir',plan.required,'Solo compromisos pendientes registrados',true)+
 stat('Dinero líquido estimado',liquid,'Débito y efectivo; no crédito bancario')+
 stat('Margen después de pagar',liquid-plan.required,liquid>=plan.required?'Alcanza según los datos registrados':'Faltante estimado para estos compromisos')+
 stat('Ingresos previstos',plan.incomePlanned,'No sumados al dinero líquido')+'</div>';
function details(items){
 const rows=items.filter(e=>e.flow==='outflow');
 const informational=items.filter(e=>e.flow!=='outflow');
 const itemRow=e=>'<div class="feature-list-row"><div><strong>'+safe(e.label||'Compromiso')+'</strong><small>'+dateStr(e.date)+' · '+safe(e.note||'')+'</small></div><b>'+fmt(e.amount)+'</b></div>';
 const payable=rows.length?rows.map(itemRow).join(''):'<p class="muted small">No hay vencimientos de pago registrados en este periodo. Confirma que capturaste todos tus compromisos.</p>';
 const extra=informational.length?'<details class="cash-extra"><summary>Otros movimientos previstos (no se restan como pagos)</summary>'+informational.map(itemRow).join('')+'</details>':'';
 return payable+extra;
}
function caveats(plan){
 let notes=[];
 if(plan.creditCharges>0)notes.push('Cargos automáticos a tarjetas programados: '+fmt(plan.creditCharges)+'; son compras previstas, no pagos inmediatos en efectivo.');
 if(plan.payrollDeductions>0)notes.push('Descuentos de nómina declarados: '+fmt(plan.payrollDeductions)+'; no se descuentan otra vez de tu saldo de débito.');
 if(plan.duplicates.length)notes.push(plan.duplicates.length+' posible(s) gasto(s) fijo(s) duplicado(s) con préstamos; revisa su registro.');
 return notes.length?'<div class="notice warn">'+notes.map(safe).join(' ')+'</div>':'';
}
function selector(kind,offset,allowBack=true){
 const prefix=kind==='week'?'cash-week':'cash-cycle';
 const label=kind==='week'?'semana':'quincena';
 return '<div class="inline-actions cash-controls"><button class="btn outline small-btn" data-act="'+prefix+'-previous" '+(offset<=0?'disabled':'')+'>← Anterior</button>'+
 '<b>'+safe(label==='semana'?(offset===0?'Esta semana':'Semana siguiente'):(offset===0?'Quincena actual':'Próxima quincena'))+'</b>'+
 '<button class="btn outline small-btn" data-act="'+prefix+'-next" '+(offset>=1?'disabled':'')+'>Siguiente →</button></div>';
}
export function renderPaydayPanel(ctx){
 const current=ctx.dateToday(),summary=treasurySummary(ctx.state,ctx.accountBalance,ctx.shownAvailable,current);
 const cycle=salaryPeriod(current,cycleOffset),week=weekPeriod(current,weekOffset);
 const cycleFrom=cycleOffset===0?current:cycle.start;
 const planCycle=paymentPlan(ctx.state,cycleFrom,cycle.end,{today:current});
 const planWeek=paymentPlan(ctx.state,week.start,week.end,{today:current});
 const {liquid,cards,credit}=summary;
 const creditCount=ctx.state.accounts.filter(a=>a.kind==='credit'&&a.active!==false).length;
 const missing=ctx.state.accounts.filter(a=>a.kind==='credit'&&!a.opening_balance_date).length;
 return '<section class="panel section paycheck-panel" id="paycheck-panel">'+
  heading('💰 Mi dinero entre nóminas',cycle.start,cycle.end,cycle.nextPayday)+
  '<p class="muted small">Nómina programada para los días <b>15 y 30</b>; febrero se ajusta al último día. Fines de semana y días festivos pueden adelantar o retrasar depósitos.</p>'+
  '<div class="grid stats">'+
   stat('Deuda de tarjetas',cards,creditCount+' tarjeta(s), saldo estimado')+
   stat('Crédito disponible total',credit,'No disponible para cubrir pagos en efectivo')+
   stat('Efectivo y débito',liquid,'Dinero líquido estimado, sin depósitos futuros')+
   stat('Por pagar antes de nómina',summary.upcoming.required,'Desde hoy hasta '+dateStr(summary.period.end))+
  '</div>'+
  '<div class="notice '+(summary.beforePayDifference<0?'warn':'')+'"><b>Para llegar a la próxima nómina:</b> '+(summary.beforePayDifference<0?
   'te faltarían '+fmt(-summary.beforePayDifference)+' para los pagos registrados.':'te quedarían '+fmt(summary.beforePayDifference)+' después de los pagos registrados.')+
   ' No considera ingresos futuros, gastos ocasionales ni movimientos no capturados.</div>'+
  '<div class="cash-section">'+selector('cycle',cycleOffset)+heading(cycleOffset===0?'Pagos hasta la próxima nómina':'Pagos de la siguiente quincena',cycleFrom,cycle.end,cycle.nextPayday)+
    totals(planCycle,liquid)+details(planCycle.items)+caveats(planCycle)+'</div>'+
  '<div class="cash-section">'+selector('week',weekOffset)+heading(weekOffset===0?'Pagos de los próximos siete días':'Pagos de los siguientes siete días',week.start,week.end)+
    totals(planWeek,liquid)+details(planWeek.items)+caveats(planWeek)+'</div>'+
  (missing?'<div class="notice warn">'+missing+' tarjeta(s) todavía sin fecha de saldo inicial; revisa sus saldos para mejorar la estimación.</div>':'')+
  '<p class="tip">Los MSI históricos no se suman otra vez: la obligación de tarjeta se basa en el estado de cuenta oficial. Los gastos fijos cargados a crédito se muestran aparte porque no salen de tu dinero líquido al momento de la compra. Los pagos de préstamos descontados de nómina tampoco se restan dos veces. El total solo será confiable si capturas tus compromisos y marcas sus pagos realizados.</p>'+
 '</section>';
}
export function paydayAction(button,render){
 const act=button.dataset.act;
 if(!['cash-week-next','cash-week-previous','cash-cycle-next','cash-cycle-previous'].includes(act))return false;
 if(act.startsWith('cash-week'))weekOffset=act.endsWith('next')?1:0;
 else cycleOffset=act.endsWith('next')?1:0;
 render();
 return true;
}
