/* Brújula v1.5: pantallas de planificación. No hay cargos bancarios automáticos. */
import {monthlyFixedBills,monthEquivalent,dueEvents,addDays,addMonths,monthlyDate,budgetSpent,amortization,cash} from './planning-rules.mjs';
import {recurringReviewPanel,recurringAction} from './recurring-review.mjs';

let calendarMonth=null,budgetMonth=null,selectedLoan=null;
const esc = x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(n)||0);
const xdate = d=>d?new Date(d+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}):'—';
function box(title,body,foot=''){return '<section class="panel section feature-panel"><h3>'+title+'</h3>'+body+(foot?'<p class="tip">'+foot+'</p>':'')+'</section>'}
function line(left,right){return '<div class="summary-line"><span>'+left+'</span><b>'+right+'</b></div>'}
function details(b,ctx){const st=ctx.state, id=b.id,date=nextBillDate(b,ctx.dateToday(),st.recurring_checks||[]);const checked=(st.recurring_checks||[]).some(x=>x.bill_id===id&&x.occurrence_date===date);
return '<div class="feature-list-row"><div><strong>'+esc(b.name)+'</strong><small>'+esc(b.category)+' · '+esc(({weekly:'Semanal',biweekly:'Quincenal',monthly:'Mensual',yearly:'Anual'})[b.frequency]||b.frequency)+' · Próximo '+xdate(date)+'</small><small>Equivalente mensual '+money(monthEquivalent(b))+' · '+(b.account_id?esc(st.accounts.find(a=>a.id===b.account_id)?.name||'Cuenta'):'Sin cuenta asignada')+'</small></div><div class="feature-actions"><b>'+money(b.amount)+'</b><div class="inline-actions"><button class="btn-mini" data-act="bill-edit" data-id="'+id+'">Editar</button><button class="btn-mini" data-act="bill-pending">Ver pendientes</button><button class="btn-mini" data-act="bill-delete" data-id="'+id+'">Eliminar</button></div></div></div>'}
function nextBillDate(b,today,checks=[]){const from=today.slice(0,7)+'-01';const list=dueEvents({recurring_bills:[b]},from,addDays(today,400)).filter(x=>x.type==='recurring');const unconfirmed=list.find(x=>!checks.some(c=>c.bill_id===b.id&&c.occurrence_date===x.date));return unconfirmed?.date||list.at(-1)?.date||b.next_date||today}
function renderBills(ctx){const bills=ctx.state.recurring_bills||[],active=bills.filter(b=>b.active),expenses=active.filter(b=>b.direction!=='income'),income=active.filter(b=>b.direction==='income');
const total=monthlyFixedBills(bills),monthlyIncome=cash(income.reduce((s,b)=>s+monthEquivalent(b),0));
return '<div class="page-head"><div><h1>Gastos fijos</h1><p class="muted">Todos tus compromisos recurrentes, en un solo lugar.</p></div><button class="btn primary" data-act="bill-new">+ Nuevo cargo fijo</button></div>'
+'<div class="grid stats">'+stat('Gastos fijos / mes',money(total),'Equivalente mensual')+stat('Ingresos recurrentes',money(monthlyIncome),'Solo previstos')+stat('Compromisos activos',active.length,'Sin registrar cargos automáticos')+stat('Balance comprometido',money(monthlyIncome-total),'Sin incluir compras variables')+'</div>'
+'<div class="notice warn">⚠️ Un gasto fijo programado NO modifica tu deuda ni crea un movimiento bancario. Ahora debes verificar el cobro y presionar <b>Revisar y registrar</b> para confirmar un movimiento en la tarjeta elegida. Una fecha pendiente nunca cambia tus saldos por sí sola.</div>'
+'<div id="recurring-pending"></div>'+recurringReviewPanel(ctx)
+box('Pagos y suscripciones',expenses.length?expenses.map(b=>details(b,ctx)).join(''):'<p class="muted">No tienes pagos recurrentes aún. Puedes agregar renta, servicios, internet, streaming o mensualidades.</p>')
+(income.length?box('Ingresos fijos previstos',income.map(b=>details(b,ctx)).join('')):'')
+box('¿Qué cuenta como gasto fijo?','<p class="muted small">Servicios, renta, internet, suscripciones o cualquier compromiso periódico. Si agregas aquí la mensualidad de un préstamo que ya está registrado en Créditos, recuerda que aparecerá en ambas listas; no la sumes dos veces al planear tus pagos.</p>');
}
function stat(t,v,s){return '<div class="panel stat"><label>'+t+'</label><strong>'+v+'</strong><span class="hint">'+s+'</span></div>'}
function renderBudgets(ctx){
 const ym=budgetMonth||ctx.thisMonth(),budgets=(ctx.state.budgets||[]).filter(b=>b.month?.startsWith(ym));const mov=ctx.state.movements||[];
 let planned=0,spent=0;
 const rows=budgets.map(b=>{const amount=cash(b.amount),actual=budgetSpent(mov,ym,b.category);planned+=amount;spent+=actual;const pct=Math.max(0,Math.min(100,amount?100*actual/amount:0));
 return '<div class="budget-row"><div class="row-title"><b>'+esc(b.category)+'</b><span>'+money(actual)+' / '+money(amount)+'</span></div><div class="budget-meter"><i style="width:'+pct+'%;background:'+(actual>amount?'#d15b67':'#635ddb')+'"></i></div><div class="inline-actions"><span class="muted small">'+(actual>amount?'⚠️ Excedido por '+money(actual-amount):'Restante '+money(amount-actual))+'</span><button class="btn-mini" data-act="budget-edit" data-id="'+b.id+'">Editar</button><button class="btn-mini" data-act="budget-delete" data-id="'+b.id+'">Eliminar</button></div></div>'}).join('');
 return '<div class="page-head"><div><h1>Presupuestos</h1><p class="muted">Límites mensuales por categoría, sin considerar pagos a tarjetas como un gasto nuevo.</p></div><button class="btn primary" data-act="budget-new">+ Definir límite</button></div>'
 +'<div class="feature-cal-title"><button class="btn outline small-btn" data-act="budget-back">←</button><strong>Presupuestos · '+esc(ym)+'</strong><button class="btn outline small-btn" data-act="budget-next">→</button></div>'
 +'<div class="grid stats">'+stat('Presupuesto asignado',money(planned),'Mes '+ym)+stat('Gasto registrado',money(spent),'Categorías presupuestadas')+stat('Disponible para gastar',money(planned-spent),'Puede ser negativo')+stat('Categorías',budgets.length,'Con límite este mes')+'</div>'
 +box('Categorías con límite · '+esc(ym),rows||'<p class="muted">Todavía no has establecido presupuestos para este mes.</p>',
 'Los presupuestos se calculan con las compras y gastos registrados; no suman pagos a tarjetas, transferencias ni mensualidades MSI por segunda vez.');
}
function calendarHTML(ctx,events){
 const ym=calendarMonth||ctx.thisMonth(),start=ym+'-01', [yy,mm]=ym.split('-').map(Number), startDay=(new Date(start+'T12:00:00Z').getUTCDay()+6)%7, gridStart=addDays(start,-startDay);
 const buckets={};for(const e of events)(buckets[e.date]??=[]).push(e);
 let cells='';for(let i=0;i<42;i++){const day=addDays(gridStart,i),items=buckets[day]||[],inMonth=day.slice(0,7)===ym,cls=items.length?' has-bill':'';
 cells+='<div class="calendar-day'+cls+(inMonth?'':' is-outside')+'"><b>'+Number(day.slice(-2))+'</b>'+
 items.slice(0,2).map(x=>'<small title="'+esc(x.label)+'">'+(x.type==='statement'?'💳':x.type==='loan'?'🚗':'🔁')+esc(x.label)+'</small>').join('')+(items.length>2?'<small>+'+(items.length-2)+' más</small>':'')+'</div>'}
 return '<div class="feature-cal-title"><button class="btn outline small-btn" data-act="cal-back">←</button><strong>'+new Date(start+'T12:00:00').toLocaleDateString('es-MX',{month:'long',year:'numeric'})+'</strong><button class="btn outline small-btn" data-act="cal-next">→</button></div>'
 +'<div class="feature-calendar">'+['L','M','M','J','V','S','D'].map(d=>'<span class="weekday">'+d+'</span>').join('')+cells+'</div>';
}
function renderCalendar(ctx){
 const today=ctx.dateToday(),ym=calendarMonth||ctx.thisMonth(),from=addDays(ym+'-01',-7),to=addDays(addMonths(ym,1)+'-01',14);
 const events=dueEvents(ctx.state,from,to),items=events.filter(e=>e.date.startsWith(ym)),plannedExpense=items.filter(e=>e.direction!=='income').reduce((n,e)=>n+cash(e.amount),0),income=items.filter(e=>e.direction==='income').reduce((n,e)=>n+cash(e.amount),0);
 const liquid=(ctx.state.accounts||[]).filter(a=>a.kind!=='credit').reduce((n,a)=>n+ctx.accountBalance(a),0);
 const outstanding=(ctx.state.statements||[]).reduce((n,s)=>n+ctx.pendingStatement(s),0);
 const list=items.map(e=>'<div class="feature-list-row"><div><b>'+xdate(e.date)+' · '+esc(e.label||'Pago')+'</b><small>'+(e.type==='recurring'?'Recurrente previsto':e.type==='loan'?'Crédito declarado':'Pago oficial pendiente')+'</small></div><b>'+money(e.amount)+'</b></div>').join('');
 return '<div class="page-head"><div><h1>Calendario financiero</h1><p class="muted">Vencimientos, cargos fijos y obligaciones previstas.</p></div></div>'
 +'<div class="grid stats">'+stat('Obligaciones del mes',money(plannedExpense),'Sumatoria prevista')+stat('Ingresos fijos previstos',money(income),'No garantiza su cobro')+stat('Efectivo y débito actual',money(liquid),'Saldo estimado actual')+stat('Pago de cortes pendientes',money(outstanding),'Según estados bancarios')+'</div>'
 +'<div class="notice warn">🔎 Proyección orientativa, no bancaria: las obligaciones se muestran sin descontarlas automáticamente del saldo actual. Si registras un préstamo también como gasto fijo, podría aparecer dos veces. No se anticipan ingresos ni se infiere el día de su acreditación fuera de lo configurado.</div>'
 +box('Vista mensual',calendarHTML(ctx,events))
 +box('Compromisos detallados · '+esc(ym),list||'<p class="muted">No hay compromisos programados para este mes.</p>');
}
function renderAmortization(ctx){
 const loans=(ctx.state.loans||[]).filter(x=>x.status==='active'),sel=loans.find(x=>x.id===selectedLoan)||loans[0];
 if(!sel)return '<h1>Amortización de créditos</h1>'+box('Sin financiamientos','<p class="muted">Registra primero tu crédito automotriz en Créditos.</p>');
 const payments=(ctx.state.loan_payments||[]).filter(x=>x.loan_id===sel.id);
 const broken=payments.length>0&&!payments.every(p=>p.principal_part!=null);
 const paid=payments.reduce((n,p)=>n+cash(p.principal_part),0);
 const principal=cash(Math.max(0,cash(sel.financed_amount)-paid));
 const hasRate=sel.annual_rate!=null&&sel.monthly_payment!=null;
 const projected=hasRate&&!broken?amortization(principal,sel.annual_rate,sel.monthly_payment,480):null;
 let table='';
 if(projected?.rows.length)table='<div class="table-wrap"><table class="data-table"><thead><tr><th>Pago</th><th>Mensualidad</th><th>Interés</th><th>Capital</th><th>Saldo estimado</th></tr></thead><tbody>'+projected.rows.slice(0,24).map(p=>'<tr><td>'+p.number+'</td><td>'+money(p.payment)+'</td><td>'+money(p.interest)+'</td><td>'+money(p.principal)+'</td><td>'+money(p.balance)+'</td></tr>').join('')+'</tbody></table></div>';
 return '<div class="page-head"><div><h1>Amortización</h1><p class="muted">Simulación de financiamientos con tasa fija.</p></div></div>'
 +'<label class="field" style="max-width:440px">Crédito<select id="amort-loan">'+loans.map(l=>'<option value="'+l.id+'" '+(l.id===sel.id?'selected':'')+'>'+esc(l.name)+'</option>').join('')+'</select></label>'
 +'<div class="grid stats">'+stat('Monto financiado',money(sel.financed_amount),'Contrato')+stat('Saldo estimado',broken?'Por confirmar':money(principal),broken?'Pagos sin desglose capital':'Descontando capital confirmado')+stat('Mensualidad',money(sel.monthly_payment),'Pago acordado')+stat('Tasa anual',sel.annual_rate==null?'Pendiente':sel.annual_rate+'%','Tasa nominal; verificar contrato')+'</div>'
 +box('Tabla de amortización',!hasRate?'<p class="notice warn">Completa en Créditos la tasa anual y mensualidad para simular.</p>':broken?'<p class="notice warn">Tienes pagos sin desglose entre capital e intereses; no sería confiable calcular el capital actual. Completa esos desgloses primero.</p>':
 '<div class="summary-table">'+line('Meses por liquidar (estimados)',projected.rows.length)+line('Intereses futuros estimados',money(projected.totalInterest))+line('Saldo al final del horizonte',money(projected.remaining))+'</div>'+table+(projected.warning?'<p class="notice warn">'+esc(projected.warning)+'</p>':''),
 'Solo simulación matemática de tasa fija. La tabla oficial puede incluir CAT, seguros, IVA, comisiones, periodos irregulares y pagos anticipados. No se crean pagos de manera automática.');
}
function renderReminders(ctx){
 const today=ctx.dateToday(),until=addDays(today,7),events=dueEvents(ctx.state,today,until).filter(e=>e.direction!=='income');
 const permission=typeof Notification==='undefined'?'unsupported':Notification.permission;
 const rows=events.map(e=>'<div class="feature-list-row"><b>'+xdate(e.date)+' · '+esc(e.label)+'</b><strong>'+money(e.amount)+'</strong></div>').join('');
 return '<div class="page-head"><div><h1>Recordatorios</h1><p class="muted">Revisa vencimientos y compromisos próximos.</p></div><button data-act="notification-enable" class="btn primary">Activar avisos</button></div>'
 +box('Estado de permisos','<p class="muted">Permiso del navegador: <b>'+esc(permission)+'</b></p><p class="tip">Los avisos dentro de Brújula y las notificaciones del navegador funcionan cuando la aplicación está abierta o la vuelves a abrir. Para recibir avisos con la aplicación completamente cerrada falta instalar notificaciones push de servidor.</p>')
 +box('Próximos siete días',rows||'<p class="muted">No aparecen vencimientos previstos para los próximos siete días.</p>');
}
export function renderExtra(page,ctx){
 switch(page){case 'bills':return renderBills(ctx);case 'budgets':return renderBudgets(ctx);case 'calendar':return renderCalendar(ctx);case 'amortization':return renderAmortization(ctx);case 'reminders':return renderReminders(ctx);default:return null}
}
export function openBillForm(ctx,id=null){
 const b=id?ctx.state.recurring_bills.find(x=>x.id===id):null;
 const f=ctx.field,c=ctx.choose,now=ctx.dateToday();
 const html=f('name','Nombre del gasto fijo o ingreso','text',b?.name||'','required maxlength="120"',true)
 +f('amount','Importe habitual MXN','number',b?.amount??'','required min="0.01" step="0.01"')
 +c('frequency','Frecuencia',[['monthly','Mensual'],['weekly','Semanal'],['biweekly','Cada 14 días'],['yearly','Anual']],b?.frequency||'monthly')
 +f('next_date','Fecha de primera ocurrencia prevista','date',b?.next_date||now,'required')
 +f('due_day','Día mensual o anual de vencimiento (1–31)','number',b?.due_day||Number(now.slice(-2)),'min="1" max="31" required')
 +c('direction','Tipo',[['expense','Pago / gasto'],['income','Ingreso previsto']],b?.direction||'expense')
 +c('category','Categoría',ctx.categories.map(x=>[x,x]),b?.category||'Servicios')
 +c('account_id','Cuenta de referencia (opcional)',[['','Sin asignar'],...ctx.state.accounts.map(a=>[a.id,a.name])],b?.account_id||'',true)
 +c('active','Estado',[['true','Activo'],['false','Pausado']],String(b?.active??true))
 +f('notes','Notas','text',b?.notes||'','',true)
 +'<div class="notice warn full-span">El compromiso no afecta saldos. Tras verificar un cobro en el banco, utiliza “Revisar y registrar” para contabilizarlo una sola vez.</div>';
 ctx.modalOpen(b?'Editar gasto fijo':'Nuevo gasto fijo','recurring_bills',html,id);
}
export function openBudgetForm(ctx,id=null){
 const b=id?ctx.state.budgets.find(x=>x.id===id):null;
 const html=ctx.choose('category','Categoría',ctx.categories.map(x=>[x,x]),b?.category||'Alimentos')
 +ctx.field('month','Mes del presupuesto','month',b?.month?.slice(0,7)||budgetMonth||ctx.thisMonth(),'required')
 +ctx.field('amount','Límite del mes (MXN)','number',b?.amount??'','min="0.01" step="0.01" required',true);
 ctx.modalOpen(b?'Editar límite':'Nuevo presupuesto','budgets',html,id);
}
export async function extraAction(b,ctx){
 if(await recurringAction(b,ctx))return true;
 const act=b.dataset.act,id=b.dataset.id;
 if(act==='bill-pending'){document.getElementById('recurring-pending')?.scrollIntoView({behavior:'smooth'});return true}
 if(act==='bill-new'){openBillForm(ctx);return true}
 if(act==='bill-edit'){openBillForm(ctx,id);return true}
 if(act==='budget-new'){openBudgetForm(ctx);return true}
 if(act==='budget-edit'){openBudgetForm(ctx,id);return true}
 if(act==='cal-next'||act==='cal-back'){calendarMonth=addMonths(calendarMonth||ctx.thisMonth(),act==='cal-next'?1:-1);ctx.render();return true}
 if(act==='budget-next'||act==='budget-back'){budgetMonth=addMonths(budgetMonth||ctx.thisMonth(),act==='budget-next'?1:-1);ctx.render();return true}
 if(act==='loan-amort'){selectedLoan=id;ctx.setPage('amortization');return true}
 if(act==='bill-delete'||act==='budget-delete'){if(!confirm('¿Eliminar este registro programado? No afecta movimientos bancarios.'))return true;try{await ctx.remove(act==='bill-delete'?'recurring_bills':'budgets',id);ctx.render();ctx.toast('Registro eliminado.')}catch(e){ctx.toast(e.message,true)}return true}
 
 await ctx.persist('recurring_checks',{bill_id:id,occurrence_date:b.dataset.date,note:'Confirmación manual, sin alterar saldos'});ctx.render();ctx.toast('Marcado como realizado. Para actualizar el saldo, registra el movimiento real.')}catch(e){ctx.toast(e.message,true)}return true}
 if(act==='notification-enable'){
  if(!('Notification' in window)){ctx.toast('Este navegador no admite notificaciones web.',true);return true}
  try{const p=await Notification.requestPermission();ctx.toast(p==='granted'?'Avisos permitidos al abrir Brújula.':'No se habilitaron avisos.');ctx.render()}catch(e){ctx.toast('No se pudo activar: '+e.message,true)}return true
 }
 return false;
}
export function extraChange(ev,ctx){
 if(ev.target.id==='amort-loan'){selectedLoan=ev.target.value;ctx.render();return true}
 return false;
}
export async function notifyWhenOpened(ctx){
 if(typeof Notification==='undefined'||Notification.permission!=='granted'||ctx.mode!=='live')return;
 const today=ctx.dateToday(),events=dueEvents(ctx.state,today,addDays(today,2))
  .filter(e=>e.direction!=='income'&&e.amount>0);
 for(const evt of events.slice(0,3)){
  const key='brujula-alert-v15-'+today+'-'+evt.type+'-'+evt.id;
  try{if(localStorage.getItem(key))continue;
   if('serviceWorker'in navigator){const reg=await navigator.serviceWorker.ready;await reg.showNotification('Brújula · vencimiento por revisar',{body:'Tienes un pago o compromiso próximo. Abre Brújula para confirmarlo.',tag:key});}
   else new Notification('Brújula · compromiso próximo',{body:'Revisa los pagos de tus cuentas.'});
   localStorage.setItem(key,'1');
  }catch(e){break}
 }
}
