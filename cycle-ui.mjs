/* Brújula Finanzas v1.11 · agenda de pagos por ciclos configurable */
import {upcomingCardPayments,cardPaymentPreview,cycleRule} from './card-cycle.mjs';
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mx=n=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(n)||0);
const dateFmt=x=>x?new Date(x+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'}):'—';
const spanDates=item=>item.latestDate&&item.latestDate!==item.date?
 dateFmt(item.date)+' al '+dateFmt(item.latestDate):dateFmt(item.date);
function entry(item){
 const official=item.source==='official';
 const important=item.severity==='danger'?'warn':item.severity==='warning'?'warn':'';
 return '<div class="cycle-payment-item '+important+'"><div class="cycle-payment-main"><div><strong>'+safe(item.accountName)+'</strong>'+
 '<small>Corte '+dateFmt(item.closeDate)+' · Vence '+spanDates(item)+'</small>'+
 '<small>'+safe(item.label)+'</small></div><div class="cycle-payment-amount"><strong>'+
 (official?mx(item.amount):'Importe por confirmar')+'</strong><span class="cycle-payment-tag '+(official?'cycle-official':'cycle-estimated')+'">'+
 (official?'Dato bancario registrado':'Fecha estimada')+'</span></div></div>'+
 '<button class="btn-mini" data-act="'+(official?'edit-statement':'cycle-statement')+'" data-id="'+safe(official?item.statementId:item.account_id)+'">'+
 (official?'Ver o corregir corte oficial':'Registrar importe y vencimiento real')+'</button></div>';
}
export function cycleAgenda(state,today,{limit=12}={}){
 const missing=(state.accounts||[]).filter(a=>a.kind==='credit'&&a.active!==false&&!cycleRule(a));
 const items=upcomingCardPayments(state,today).filter(x=>x.date<=
  (new Date(new Date(today+'T12:00:00Z').getTime()+76*86400000)).toISOString().slice(0,10)).slice(0,limit);
 const overdue=items.filter(i=>i.source==='official'&&i.key==='overdue');
 const totalKnown=items.filter(i=>i.source==='official'&&i.amount>0).reduce((n,i)=>n+i.amount,0);
 return '<section class="panel section card-cycle-agenda" id="cycle-agenda">'+
 '<div class="section-title"><div><h3>📆 Vencimientos por ciclo de tarjeta</h3>'+
 '<p class="muted small">Relaciona cada corte con el mes correcto de pago. Las fechas estimadas NO son obligaciones bancarias confirmadas.</p></div></div>'+
 (overdue.length?'<div class="notice warn">⚠️ Hay '+overdue.length+' corte(s) registrados con importes pendientes y vencimiento anterior a hoy. Revisa pagos no vinculados y confirma en el banco.</div>':'')+
 (missing.length?'<div class="notice warn">Configura en qué mes se paga cada corte para: '+
 missing.map(a=>'<button type="button" class="linkbtn" data-act="card-cycle" data-id="'+safe(a.id)+'">'+safe(a.name)+'</button>').join(' · ')+
 '. No se inventarán sus vencimientos.</div>':'')+
 '<div class="cycle-payment-list">'+(items.length?items.map(entry).join(''):'<p class="muted small">Todavía no hay vencimientos configurados o estados de cuenta registrados.</p>')+'</div>'+
 '<p class="tip">El importe de un corte oficial se reduce únicamente con los pagos que vinculaste a él. Para Stori (corte 12 → pago 4 del siguiente mes) y Plata (corte 5 → pago 5–6 del siguiente mes), configura sus días una sola vez. El banco siempre confirma la fecha exacta y la cantidad exigible.</p>'+
 '</section>';
}
export function cardCycleLabel(state,account,today){
 if(account.kind!=='credit')return '';
 const p=cardPaymentPreview(state,account,today);
 if(!p)return '<div class="notice warn">Falta configurar la relación entre corte y vencimiento.</div>';
 return '<div class="account-context"><b>Próximo pago de ciclo:</b> '+spanDates(p)+
 '<div><b>Origen:</b> '+(p.source==='official'?'Estado de cuenta registrado':'Fecha proyectada; verifica en el banco')+
 ' · <b>Importe:</b> '+(p.source==='official'?mx(p.amount):'Pendiente de registrar')+'</div></div>';
}
export function openCycleSettings(ctx,id){
 const account=ctx.state.accounts.find(a=>a.id===id&&a.kind==='credit');
 if(!account)return ctx.toast('Selecciona una tarjeta de crédito.',true);
 const needsOffset=account.due_month_offset===null||account.due_month_offset===undefined;
 const text='<div class="notice full-span">💳 <b>'+safe(account.name)+'</b>. Configura la regla de calendario <b>sin cambiar la deuda, el disponible o el último estado de cuenta</b>. El cálculo de las fechas es orientativo: el banco puede mover los días por su propio calendario.</div>'+
 ctx.field('cutoff_day','Día habitual del corte (1 a 28)','number',account.cutoff_day??'','min="1" max="28" required')+
 ctx.field('due_day','Primer día habitual de vencimiento (1 a 28)','number',account.due_day??'','min="1" max="28" required')+
 ctx.choose('due_month_offset','¿En qué mes corresponde pagar el corte?',[['0','En el mismo mes del corte'],['1','En el siguiente mes'],['2','Dos meses después']],needsOffset?'1':String(account.due_month_offset),true)+
 ctx.choose('due_window_days','Variación aproximada del vencimiento',[['0','Fecha habitual fija (0 días)'],['1','Puede cambiar 1 día después'],['2','Puede cambiar hasta 2 días después'],['3','Puede cambiar hasta 3 días después']],String(account.due_window_days??0),true)+
 '<p class="tip full-span">Ejemplos: 12 de octubre → 4 de noviembre = siguiente mes, día 4. Corte 5 de octubre → fecha 5 o 6 de noviembre = siguiente mes, día 5, variación de 1 día. No significa que el banco haya confirmado el pago o su importe.</p>'+
 '<input type="hidden" name="account_id" value="'+safe(account.id)+'">';
 ctx.modalOpen('Configurar corte y vencimiento · '+account.name,'card_cycle',text);
}
export async function saveCycleSettings(ctx,form){
 const fd=new FormData(form),id=String(fd.get('account_id')||''),
 card=ctx.state.accounts.find(a=>a.id===id&&a.kind==='credit');
 if(!card)throw Error('Tarjeta no encontrada.');
 const close=Number(fd.get('cutoff_day')),due=Number(fd.get('due_day')),
 offset=Number(fd.get('due_month_offset')),window=Number(fd.get('due_window_days'));
 if(!Number.isInteger(close)||close<1||close>28||!Number.isInteger(due)||due<1||due>28||
 ![0,1,2].includes(offset)||![0,1,2,3].includes(window)||offset===0&&due<close)
 throw Error('Comprueba el día del corte, la fecha habitual de pago y su mes correspondiente.');
 if(ctx.mode==='demo')Object.assign(card,{cutoff_day:close,due_day:due,due_month_offset:offset,due_window_days:window});
 else{
  const {error}=await ctx.sb.rpc('set_card_cycle',{p_account_id:id,p_cutoff_day:close,p_due_day:due,
    p_due_month_offset:offset,p_due_window_days:window});
  if(error)throw error;
  await ctx.loadData();
 }
}
