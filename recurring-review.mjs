/* Brújula v1.6 · Recurrentes con autorización humana.
 * La agenda se deriva de reglas; NO escribe saldos hasta confirmar en el formulario.
 */
import {dueEvents,addDays} from './planning-rules.mjs';
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pesos=n=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(n)||0);
const dateText=d=>d?new Date(d+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}):'—';
function scheduledEntries(ctx){
 const today=ctx.dateToday(),end=addDays(today,21),start=addDays(today,-62);
 return dueEvents(ctx.state,start,end).filter(e=>e.type==='recurring').map(e=>{
  const posting=(ctx.state.recurring_postings||[]).find(p=>p.bill_id===e.id&&p.occurrence_date===e.date);
  const legacy=(ctx.state.recurring_checks||[]).some(c=>c.bill_id===e.id&&c.occurrence_date===e.date);
  return {...e,posting,legacy,due:e.date<=today};
 });
}
export function pendingRecurringCount(ctx){
 return scheduledEntries(ctx).filter(e=>e.due&&!e.posting&&e.direction==='expense').length;
}
export function recurringReviewPanel(ctx){
 const entries=scheduledEntries(ctx),pending=entries.filter(e=>e.due&&!e.posting),posted=entries.filter(e=>e.posting?.status==='posted'),upcoming=entries.filter(e=>!e.due),skipped=entries.filter(e=>e.posting?.status==='skipped');
 const section=(label,group)=>'<h3>'+label+'</h3>'+(group.length?group.map(e=>{
 const p=e.posting,symbol=p?.status==='posted'?'✅':p?.status==='skipped'?'—':e.due?'⏳':'📅';
 const stateLabel=p?.status==='posted'?'Registrado en movimientos':p?.status==='skipped'?'No se cobró':e.due?'Pendiente de revisar':'Próximo cargo';
 return '<div class="feature-list-row"><div><strong>'+symbol+' '+safe(e.label)+'</strong><small>'+dateText(e.date)+' · '+safe(stateLabel)+
 (e.legacy&&!p?' · Revisado antes, sin movimiento bancario':'')+'</small></div><div class="feature-actions"><b>'+pesos(p?.confirmed_amount??e.amount)+'</b>'+
 (!p&&e.due?'<div class="inline-actions"><button class="btn-mini" data-act="bill-review" data-id="'+safe(e.id)+'" data-date="'+e.date+'">Revisar y registrar</button><button class="btn-mini" data-act="bill-skip" data-id="'+safe(e.id)+'" data-date="'+e.date+'">No se cobró</button></div>':
 p?.status==='posted'?'<small>Impacto en saldo confirmado</small>':'')+'</div></div>'
 }).join(''):'<p class="muted small">Sin registros en esta sección.</p>');
 return '<div class="grid stats">'+
 '<div class="panel stat"><label>Pendientes de revisar</label><strong>'+pending.length+'</strong><span class="hint">Ocurrencias vencidas o de hoy</span></div>'+
 '<div class="panel stat"><label>Confirmados</label><strong>'+posted.length+'</strong><span class="hint">Con movimiento registrado</span></div>'+
 '<div class="panel stat"><label>No cobrados</label><strong>'+skipped.length+'</strong><span class="hint">Sin afectar saldos</span></div>'+
 '<div class="panel stat"><label>Próximos</label><strong>'+upcoming.length+'</strong><span class="hint">Agenda, sin movimientos</span></div></div>'+
 '<section class="panel section"><div class="section-title"><h3>Movimientos recurrentes pendientes de tu aprobación</h3></div>'+
 '<div class="notice">🔐 <b>Opción A:</b> las fechas se generan como pendientes. <b>Solo “Revisar y registrar”</b> y la confirmación del formulario crean un movimiento. “No se cobró” descarta esa ocurrencia sin modificar el saldo. Si ya capturaste el cargo manualmente, no lo registres otra vez.</div>'+
 section('Por revisar',pending)+section('Próximas fechas',upcoming)+section('Ya revisados',posted.concat(skipped))+'</section>';
}
function chosenAccounts(ctx,bill){
 return (ctx.state.accounts||[]).filter(a=>bill.direction==='expense'||a.kind!=='credit').map(a=>[a.id,a.name+(a.last4?' · •••• '+a.last4:'')]);
}
export function openRecurringReview(ctx,id,date){
 const bill=(ctx.state.recurring_bills||[]).find(x=>x.id===id);
 if(!bill){ctx.toast('No existe este gasto recurrente.',true);return}
 if(date>ctx.dateToday()){ctx.toast('Aún no corresponde confirmar este cargo.',true);return}
 if((ctx.state.recurring_postings||[]).some(p=>p.bill_id===id&&p.occurrence_date===date)){
  ctx.toast('Este cargo ya fue revisado.',true);return;
 }
 const acc=chosenAccounts(ctx,bill);
 if(!acc.length){ctx.toast('Agrega una cuenta compatible antes de confirmar.',true);return}
 const fields=ctx.choose('account_id','¿En qué tarjeta o cuenta ocurrió?',acc,acc.some(x=>x[0]===bill.account_id)?bill.account_id:acc[0][0],true)
 +ctx.field('transaction_date','Fecha REAL del cargo o abono','date',date,'required',true)
 +ctx.field('amount','Importe REAL cobrado (puedes corregir el programado)','number',bill.amount,'required min="0.01" step="0.01"',true)
 +ctx.field('description','Descripción','text',bill.name,'required maxlength="350"',true)
 +'<p class="notice warn full-span">Comprueba el cargo en tu banco antes de guardar. Esta confirmación <b>sí</b> creará un movimiento financiero en la cuenta elegida y modificará su saldo estimado. No genera un pago bancario real.</p>'
 +'<input type="hidden" name="bill_id" value="'+safe(id)+'"><input type="hidden" name="occurrence_date" value="'+safe(date)+'">';
 ctx.modalOpen('Confirmar movimiento recurrente','recurring_review',fields);
}
export async function saveRecurringReview(ctx,form){
 const fd=new FormData(form),id=String(fd.get('bill_id')||''),date=String(fd.get('occurrence_date')||''),
  accountId=String(fd.get('account_id')||''),transactionDate=String(fd.get('transaction_date')||''),
  desc=String(fd.get('description')||'').trim(),amount=Number(fd.get('amount'));
 const bill=ctx.state.recurring_bills.find(x=>x.id===id),
  account=ctx.state.accounts.find(a=>a.id===accountId);
 if(!bill||!account||!desc||!Number.isFinite(amount)||amount<=0)throw Error('Revisa cuenta, concepto e importe real.');
 if(date>ctx.dateToday()||transactionDate>ctx.dateToday())throw Error('No se pueden confirmar cobros futuros.');
 if(account.opening_balance_date&&transactionDate<=account.opening_balance_date)throw Error('El cargo ya estaría dentro del saldo inicial de esta tarjeta.');
 if((ctx.state.recurring_postings||[]).some(p=>p.bill_id===id&&p.occurrence_date===date))throw Error('Este periodo ya está confirmado.');
 const kind=bill.direction==='income'?'income':account.kind==='credit'?'purchase':'expense';
 if(kind==='income'&&account.kind==='credit')throw Error('No registres un ingreso como compra en tarjeta de crédito.');
 const match=ctx.state.movements.some(m=>m.account_id===accountId&&m.transaction_date===transactionDate&&
 m.kind===kind&&Math.abs(Number(m.amount)-amount)<0.001&&m.description?.trim().toLowerCase()===desc.toLowerCase());
 if(match)throw Error('Ya existe un movimiento igual en esa fecha y tarjeta. Revisa antes de duplicarlo.');
 if(ctx.mode==='demo'){
  const movementId='demo-'+Math.random().toString(36).slice(2);
  ctx.state.movements.push({id:movementId,account_id:accountId,kind,transaction_date:transactionDate,amount,description:desc,category:bill.category,merchant:'',statement_id:null});
  ctx.state.recurring_postings.push({id:'demo-'+Math.random(),bill_id:id,occurrence_date:date,status:'posted',movement_id:movementId,confirmed_amount:amount,confirmed_date:transactionDate});
 }else{
  const {error}=await ctx.sb.rpc('confirm_recurring_posting',{p_bill_id:id,p_occurrence_date:date,p_account_id:accountId,p_transaction_date:transactionDate,p_amount:amount,p_description:desc});
  if(error)throw error;
  await ctx.loadData();
 }
}
export async function recurringAction(b,ctx){
 const act=b.dataset.act,id=b.dataset.id,date=b.dataset.date;
 if(act==='bill-review'){openRecurringReview(ctx,id,date);return true}
 if(act==='bill-skip'){
  if(!confirm('¿Marcar este cargo como NO cobrado? No cambiará el saldo.'))return true;
  try{
   if(ctx.mode==='demo'){
    if(ctx.state.recurring_postings.some(p=>p.bill_id===id&&p.occurrence_date===date))throw Error('Periodo ya revisado.');
    ctx.state.recurring_postings.push({id:'demo-'+Math.random(),bill_id:id,occurrence_date:date,status:'skipped'});
   }else{const {error}=await ctx.sb.rpc('skip_recurring_posting',{p_bill_id:id,p_occurrence_date:date});if(error)throw error;await ctx.loadData()}
   ctx.render();ctx.toast('Marcado como no cobrado. No afectó tus saldos.');
  }catch(e){ctx.toast(e.message,true)}
  return true;
 }
 return false;
}
