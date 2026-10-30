/* Brújula v1.11 · Expediente de cuenta con calendario por ciclo. */
import {cardCycleLabel} from './cycle-ui.mjs';
import {cardGradientStyle} from './card-colors.mjs';
let selectedAccountId=null,filter='all',pageNumber=0;
const PAGE_SIZE=20;
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mx=n=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(n)||0);
const fmt=d=>d?new Date(d+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}):'—';
export function getAccountMovements(state,id,kind='all'){
 const filtered=(state.movements||[]).filter(m=>m.account_id===id&&(
 kind==='all'||kind==='payments'&&m.kind==='payment'||
 kind==='charges'&&['purchase','expense','fee','interest'].includes(m.kind)||
 kind==='other'&&!['purchase','expense','fee','interest','payment'].includes(m.kind)));
 return filtered.sort((a,b)=>b.transaction_date.localeCompare(a.transaction_date)||
 (b.created_at||'').localeCompare(a.created_at||''));
}
export function selectedAccount(){return selectedAccountId}
export function renderAccountDetails(ctx){
 const a=ctx.state.accounts.find(a=>a.id===selectedAccountId);
 if(!a)return '<div class="page-head"><h1>Cuenta no encontrada</h1><button class="btn outline" data-act="account-back">Volver a mis cuentas</button></div>';
 const entries=getAccountMovements(ctx.state,a.id,filter),pages=Math.max(1,Math.ceil(entries.length/PAGE_SIZE));
 pageNumber=Math.max(0,Math.min(pageNumber,pages-1));
 const movements=entries.slice(pageNumber*PAGE_SIZE,(pageNumber+1)*PAGE_SIZE),all=getAccountMovements(ctx.state,a.id);
 const charges=all.filter(m=>['purchase','expense','fee','interest'].includes(m.kind)).reduce((n,m)=>n+Number(m.amount),0);
 const payments=all.filter(m=>m.kind==='payment').reduce((n,m)=>n+Number(m.amount),0);
 const stmt=(ctx.state.statements||[]).filter(s=>s.account_id===a.id).sort((x,y)=>y.close_date.localeCompare(x.close_date))[0];
 const credit=a.kind==='credit',available=credit?ctx.shownAvailable(a):ctx.accountBalance(a);
 const summary='<div class="grid stats">'+
  '<div class="panel stat"><label>'+(credit?'Deuda estimada':'Saldo estimado')+'</label><strong>'+mx(ctx.accountBalance(a))+'</strong><span class="hint">Saldo inicial + movimientos registrados</span></div>'+
  '<div class="panel stat"><label>'+(credit?'Crédito disponible estimado':'Saldo actual estimado')+'</label><strong>'+mx(available)+'</strong><span class="hint">Verifica el dato oficial en el banco</span></div>'+
  '<div class="panel stat"><label>'+(credit?'Compras y cargos':'Gastos registrados')+'</label><strong>'+mx(charges)+'</strong><span class="hint">'+all.filter(m=>['purchase','expense','fee','interest'].includes(m.kind)).length+' movimientos de esta cuenta</span></div>'+
  '<div class="panel stat"><label>'+(credit?'Pagos a esta tarjeta':'Ingresos y abonos')+'</label><strong>'+mx(credit?payments:all.filter(m=>['income','transfer_in','refund'].includes(m.kind)).reduce((n,m)=>n+Number(m.amount),0))+'</strong><span class="hint">Solo movimientos de esta cuenta</span></div></div>';
 const extra=credit?'<div class="account-context">'+
  '<div><b>Límite:</b> '+mx(a.credit_limit)+' · <b>Inicio:</b> '+(a.opening_balance_date?fmt(a.opening_balance_date):'Fecha pendiente')+' · <b>Corte habitual:</b> '+(a.cutoff_day||'Por confirmar')+'</div>'+
  (stmt?'<div><b>Último corte:</b> '+fmt(stmt.close_date)+' · <b>Límite de pago:</b> '+fmt(stmt.due_date)+' · <b>Pago oficial pendiente:</b> '+mx(ctx.pendingStatement(stmt))+'</div>':'<div>Sin estado de cuenta registrado; el pago para no generar intereses no puede inferirse.</div>')+
  '</div>':'';
 const cycle=credit?cardCycleLabel(ctx.state,a,ctx.dateToday()):'';
 const rows=movements.length?movements.map(m=>
   '<tr><td>'+fmt(m.transaction_date)+'</td><td><b>'+safe(m.description||m.merchant||ctx.kinds[m.kind]||'Movimiento')+'</b>'+
   (m.statement_id?'<small class="muted"> · Vinculado al corte</small>':'')+'</td><td>'+safe(ctx.kinds[m.kind]||m.kind)+'</td>'+
   '<td><b class="'+(m.kind==='payment'||['refund','income'].includes(m.kind)?'positive':'')+'">'+mx(m.amount)+'</b></td>'+
   '<td><button class="btn-mini" data-act="edit-movement" data-id="'+safe(m.id)+'">Editar</button></td></tr>'
 ).join(''):'<tr><td colspan="5"><p class="muted">No hay movimientos de este tipo en esta cuenta.</p></td></tr>';
 return '<div class="page-head"><div><button class="linkbtn" data-act="account-back">← Mis cuentas y tarjetas</button><h1>'+safe(a.name)+'</h1><p class="muted">'+safe(a.bank_name||'')+(a.last4?' · •••• '+safe(a.last4):'')+' · '+(credit?'Tarjeta de crédito':a.kind==='debit'?'Cuenta de débito':'Efectivo')+'</p></div>'+
 '<div class="inline-actions"><button class="btn primary" data-act="account-charge" data-id="'+safe(a.id)+'">+ '+(credit?'Compra':'Gasto')+'</button>'+
 (credit?'<button class="btn soft" data-act="account-pay" data-id="'+safe(a.id)+'">+ Pago a tarjeta</button>':'')+
 '<button class="btn outline" data-act="edit-account" data-id="'+safe(a.id)+'">Editar cuenta</button>'+
 '<button class="btn outline" data-act="card-color" data-id="'+safe(a.id)+'">🎨 Cambiar color</button>'+
 (credit?'<button class="btn outline" data-act="card-cycle" data-id="'+safe(a.id)+'">Configurar fechas de pago</button>':'')+'</div></div>'+
 '<div class="account-color-banner" style="'+cardGradientStyle(a)+'"><span>💳 '+safe(a.name)+'</span><span>'+(a.last4?'•••• '+safe(a.last4):'Mi cuenta')+'</span></div>'+
 summary+extra+cycle+
 '<section class="panel section"><div class="section-title"><h3>Movimientos de '+safe(a.name)+' · '+entries.length+' registros</h3></div>'+
 '<div class="filterbar"><label class="field">Mostrar<select id="account-detail-kind">'+
 [['all','Todos'],['charges','Compras y cargos'],['payments','Pagos a tarjeta'],['other','Abonos y otros']].map(([v,l])=>'<option value="'+v+'" '+(filter===v?'selected':'')+'>'+l+'</option>').join('')+
 '</select></label></div>'+
 '<div class="table-wrap"><table class="data-table"><thead><tr><th>Fecha</th><th>Concepto</th><th>Tipo</th><th>Importe</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
 '<div class="account-pagination"><span class="muted small">Página '+(pageNumber+1)+' de '+pages+' · '+entries.length+' movimientos de esta cuenta</span>'+
 '<div class="inline-actions"><button class="btn-mini" data-act="account-prev" '+(pageNumber===0?'disabled':'')+'>← Anteriores</button><button class="btn-mini" data-act="account-next" '+(pageNumber+1>=pages?'disabled':'')+'>Siguientes →</button></div></div>'+
 '<p class="tip">Se muestran únicamente movimientos de esta cuenta. Los pagos vinculados a un estado de cuenta también reducen el pago oficial pendiente, mientras que todos los pagos disminuyen la deuda estimada.</p></section>';
}
export function accountDetailAction(btn,ctx){
 const act=btn.dataset.act,id=btn.dataset.id;
 if(act==='view-account'){
  if(!ctx.state.accounts.some(a=>a.id===id)){ctx.toast('No se encontró la tarjeta.',true);return true}
  selectedAccountId=id;filter='all';pageNumber=0;ctx.setPage('account-detail');return true;
 }
 if(act==='account-back'){ctx.setPage('accounts');return true}
 if(act==='account-prev'){pageNumber=Math.max(0,pageNumber-1);ctx.render();return true}
 if(act==='account-next'){pageNumber++;ctx.render();return true}
 if(act==='account-pay'){ctx.openMovement(null,id,'payment');return true}
 if(act==='account-charge'){const a=ctx.state.accounts.find(a=>a.id===id);ctx.openMovement(null,id,a?.kind==='credit'?'purchase':'expense');return true}
 return false;
}
export function accountDetailChange(event,ctx){
 if(event.target.id==='account-detail-kind'){filter=event.target.value;pageNumber=0;ctx.render();return true}
 return false;
}
