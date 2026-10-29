/* Brújula v1.10 — MSI: conciliación de parcialidades sin doble pago */
export const cents=n=>Math.round((Number(n)||0)*100);
export function installmentAmount(plan,idx){
 const total=cents(plan.original_amount),months=Number(plan.months)||1,
 regular=plan.monthly_amount!=null?cents(plan.monthly_amount):Math.round(total/months);
 return (idx===months-1?total-regular*(months-1):regular)/100;
}
export function paymentRoom(state,payment){
 const allocated=(state.msi_payment_links||[]).filter(l=>l.payment_movement_id===payment.id)
 .reduce((n,l)=>n+cents(l.allocated_amount),0);
 return Math.max(0,(cents(payment.amount)-allocated)/100);
}
export function eligibleMsiPayments(state,plan){
 const amount=installmentAmount(plan,Number(plan.installments_paid)||0);
 const acc=state.accounts.find(a=>a.id===plan.account_id);
 return state.movements.filter(m=>m.account_id===plan.account_id&&m.kind==='payment'&&
 (!acc?.opening_balance_date||m.transaction_date>acc.opening_balance_date) &&
 paymentRoom(state,m)+0.001>=amount)
 .sort((a,b)=>b.transaction_date.localeCompare(a.transaction_date));
}
const money=n=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(n)||0);
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function msiLinkHistory(state,plan){
 const links=(state.msi_payment_links||[]).filter(x=>x.installment_id===plan.id)
   .sort((a,b)=>b.installment_number-a.installment_number);
 if(!links.length)return '<p class="tip">Las mensualidades marcadas anteriormente como pagadas permanecen como control histórico sin vínculo bancario. Las próximas se relacionarán con movimientos reales.</p>';
 return '<details class="msi-links"><summary>Ver pagos MSI vinculados ('+links.length+')</summary>'+
 links.map(l=>{
  const mov=state.movements.find(m=>m.id===l.payment_movement_id);
  return '<div class="feature-list-row"><div><b>Mensualidad '+l.installment_number+' de '+plan.months+'</b><small>'+
   safe(mov?.transaction_date||'')+' · '+(mov?'Pago a tarjeta '+money(mov.amount):'Movimiento no encontrado')+'</small></div><b>'+money(l.allocated_amount)+'</b></div>';
 }).join('')+'</details>';
}
function fieldOptions(list){return list.map(([v,title])=>'<option value="'+safe(v)+'">'+safe(title)+'</option>').join('')}
export function openMsiLink(ctx,planId){
 const plan=ctx.state.installments.find(p=>p.id===planId);
 if(!plan){ctx.toast('No se encontró el plan MSI.',true);return}
 const paid=Number(plan.installments_paid)||0;
 if(paid>=Number(plan.months)||plan.status!=='active'){ctx.toast('Este plan ya no tiene mensualidades pendientes.',true);return}
 const next=paid+1,part=installmentAmount(plan,paid),existing=eligibleMsiPayments(ctx.state,plan);
 const statementOptions=(ctx.state.statements||[]).filter(s=>s.account_id===plan.account_id).sort((a,b)=>b.close_date.localeCompare(a.close_date));
 const account=ctx.state.accounts.find(a=>a.id===plan.account_id);
 const type=existing.length?'existing':'new';
 const html='<div class="notice full-span">💳 <b>'+safe(plan.description)+'</b> · Tarjeta '+safe(account?.name||'Sin nombre')+
 ' · Mensualidad <b>'+next+' de '+plan.months+'</b> · Importe MSI <b>'+money(part)+'</b></div>'+
 ctx.choose('payment_mode','¿Cómo vas a relacionar esta mensualidad?',[['existing','Vincular con pago a tarjeta ya registrado'],['new','Registrar nuevo pago REAL a tarjeta']],type,true)+
 '<div class="msi-existing-fields full-span">'+
 '<label class="field">Selecciona el pago bancario<select name="payment_id">'+fieldOptions(existing.map(p=>[p.id,ctx.printDate(p.transaction_date)+' · '+money(p.amount)+' · disponible para MSI '+money(paymentRoom(ctx.state,p))]))+'</select></label>'+
 (existing.length?'':'<p class="notice warn">No hay pagos de esta tarjeta con importe suficiente sin vincular. Puedes elegir registrar un pago nuevo, pero solo si el banco ya lo recibió.</p>')+
 '</div>'+
 '<div class="msi-new-fields full-span">'+
 ctx.field('payment_date','Fecha REAL del pago al banco','date',ctx.dateToday(),'required',true)+
 ctx.field('payment_total','Total realmente pagado a la tarjeta (puede incluir otras compras)','number',part,'min="0.01" step="0.01" required',true)+
 ctx.choose('statement_id','Estado de cuenta al que corresponde el abono (opcional)',[['','Sin asociar'],...statementOptions.map(s=>[s.id,ctx.printDate(s.close_date)+' · '+money(s.no_interest_amount)])],'',true)+
 '</div>'+
 '<div class="notice warn full-span">⚠️ Solo vincula pagos que <b>realmente hiciste</b>. Si el pago a tarjeta ya está registrado, usa la primera opción: NO se vuelve a sumar un abono. Si el pago es nuevo, se registra una sola operación por el total bancario y se asigna <b>'+money(part)+'</b> de ella a este MSI. El saldo del MSI es un control informativo, no un segundo descuento.</div>'+
 '<input type="hidden" name="installment_id" value="'+safe(plan.id)+'">';
 ctx.modalOpen('Vincular mensualidad '+next+' de '+plan.months,'msi_link',html);
 updateMsiMode();
}
export function updateMsiMode(){
 const f=document.getElementById('modal-form');if(f?.dataset.table!=='msi_link')return;
 const mode=f.elements.payment_mode?.value;
 if(f.elements.payment_id)f.elements.payment_id.disabled=mode!=='existing';
 if(f.elements.statement_id)f.elements.statement_id.disabled=mode!=='new';
 f.querySelector('.msi-existing-fields')?.classList.toggle('hidden',mode!=='existing');
 f.querySelector('.msi-new-fields')?.classList.toggle('hidden',mode!=='new');
 for(const name of ['payment_date','payment_total'])if(f.elements[name])f.elements[name].required=mode==='new';
 if(mode==='existing'&&!f.elements.payment_id?.value){
   f.querySelector('[type=submit]').disabled=true;
 }else f.querySelector('[type=submit]').disabled=false;
}
export async function saveMsiLink(ctx,form){
 const fd=new FormData(form),id=String(fd.get('installment_id')||'');
 const p=ctx.state.installments.find(x=>x.id===id);
 if(!p||p.status!=='active'||p.installments_paid>=p.months)throw Error('El plan no tiene mensualidades pendientes.');
 const mode=String(fd.get('payment_mode')||'existing'),period=Number(p.installments_paid)+1;
 const part=installmentAmount(p,period-1),existing=eligibleMsiPayments(ctx.state,p);
 let movement,result;
 if(mode==='existing'){
  const paymentId=String(fd.get('payment_id')||'');
  movement=existing.find(x=>x.id===paymentId);
  if(!movement)throw Error('Selecciona un pago de esta tarjeta con importe disponible.');
  if(ctx.mode==='demo'){
   ctx.state.msi_payment_links.push({id:ctx.uid(),installment_id:p.id,installment_number:period,payment_movement_id:movement.id,allocated_amount:part});
   p.installments_paid=period;if(period===p.months)p.status='finished';
  }else{
   const {data,error}=await ctx.sb.rpc('link_msi_installment_payment',{p_installment_id:id,p_payment_id:paymentId});
   if(error)throw error;result=data;await ctx.loadData();
  }
 }else if(mode==='new'){
  const amount=Number(fd.get('payment_total')),date=String(fd.get('payment_date')||''),stmt=String(fd.get('statement_id')||'');
  if(!Number.isFinite(amount)||amount<part-0.001)throw Error('El abono total debe cubrir el importe de esta mensualidad.');
  if(!date||date>ctx.dateToday())throw Error('No puedes registrar un pago bancario futuro. Vincúlalo cuando se realice.');
  const card=ctx.state.accounts.find(a=>a.id===p.account_id);
  if(card?.opening_balance_date&&date<=card.opening_balance_date)throw Error('Este pago ya está incluido en la fecha inicial de la tarjeta.');
  if(ctx.state.movements.some(m=>m.account_id===p.account_id&&m.kind==='payment'&&m.transaction_date===date&&Math.round(m.amount*100)===Math.round(amount*100)))
   throw Error('Ya hay un pago de igual importe y fecha. Usa la opción Vincular pago existente.');
  if(ctx.mode==='demo'){
   const movementId=ctx.uid();
   ctx.state.movements.push({id:movementId,account_id:p.account_id,statement_id:stmt||null,kind:'payment',amount,transaction_date:date,category:'Otros',description:'Pago a tarjeta · MSI vinculado'});
   ctx.state.msi_payment_links.push({id:ctx.uid(),installment_id:id,installment_number:period,payment_movement_id:movementId,allocated_amount:part});
   p.installments_paid=period;if(period===p.months)p.status='finished';
  }else{
   const {data,error}=await ctx.sb.rpc('link_msi_installment_payment',{p_installment_id:id,p_new_payment_amount:amount,p_payment_date:date,p_statement_id:stmt||null});
   if(error)throw error;result=data;await ctx.loadData();
  }
 }else throw Error('Selecciona el tipo de registro.');
 return {period,part,mode,result};
}
