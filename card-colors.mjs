/* Brújula v1.12 · colores personales por tarjeta, sin tocar datos financieros.
   Paleta cerrada: evita guardar CSS no confiable en el banco. */
export const CARD_COLORS=Object.freeze([
 {id:'navy',name:'Azul noche',start:'#172640',end:'#344c73'},
 {id:'violet',name:'Morado',start:'#443098',end:'#8061d5'},
 {id:'blue',name:'Azul intenso',start:'#06468f',end:'#2473c5'},
 {id:'sky',name:'Azul claro',start:'#12628f',end:'#319bc1'},
 {id:'teal',name:'Turquesa',start:'#075a5d',end:'#078885'},
 {id:'green',name:'Verde',start:'#17593c',end:'#278153'},
 {id:'orange',name:'Naranja',start:'#a83b1d',end:'#db7130'},
 {id:'red',name:'Rojo',start:'#8f1e37',end:'#c53c4d'},
 {id:'rose',name:'Rosa oscuro',start:'#8b244c',end:'#c54879'},
 {id:'slate',name:'Gris acero',start:'#29384d',end:'#647089'},
 {id:'gold',name:'Dorado',start:'#70451e',end:'#bd8837'},
 {id:'black',name:'Negro',start:'#15171b',end:'#41444c'}
]);
const byId=new Map(CARD_COLORS.map(c=>[c.id,c]));
const bankHint=[
 [/stori/i,'orange'],[/nu\b|nubank/i,'violet'],[/hsbc/i,'red'],
 [/plata/i,'black'],[/bbva|bancomer/i,'blue'],[/santander/i,'red'],
 [/banorte/i,'red'],[/mercado\s*pago/i,'sky'],[/rappi/i,'orange'],
 [/klar/i,'gold'],[/uala|ualá/i,'teal'],[/vexi/i,'slate'],
 [/banco\s*azteca/i,'green']
];
export function suggestedCardColor(account){
 const name=(String(account?.name||'')+' '+String(account?.bank_name||'')).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 for(const [expr,id] of bankHint)if(expr.test(name))return id;
 const neutral=['navy','teal','blue','slate','green','violet'];
 let h=0;for(let i=0;i<name.length;i++)h=(h*31+name.charCodeAt(i))>>>0;
 return neutral[h%neutral.length];
}
export function resolvedCardColor(account){
 const chosen=String(account?.card_color||'');
 return byId.get(chosen)||byId.get(suggestedCardColor(account));
}
export function cardGradientStyle(account){
 const color=resolvedCardColor(account);
 // Only literals from the trusted, fixed palette become CSS.
 return '--card-from:'+color.start+';--card-to:'+color.end;
}
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function previewHtml(color,account){
 return '<div class="card-color-preview" id="card-color-preview" style="'+cardGradientStyle({...account,card_color:color})+'">'+
  '<span>💳 '+safe(account.name)+'</span>'+
  '<strong>•••• '+safe(account.last4||'0000')+'</strong>'+
  '<small>Vista previa · solo apariencia</small></div>';
}
export function openCardColors(ctx,id){
 const account=ctx.state.accounts.find(a=>a.id===id);
 if(!account){ctx.toast('No se encontró la cuenta.',true);return}
 const current=resolvedCardColor(account).id;
 const inputs='<fieldset class="card-color-options"><legend>Elige un color</legend>'+
 CARD_COLORS.map(c=>'<label class="card-color-choice" title="'+safe(c.name)+'">'+
 '<input type="radio" name="card_color" value="'+c.id+'" '+(current===c.id?'checked':'')+' required>'+
 '<span class="card-color-chip" style="background:linear-gradient(135deg,'+c.start+','+c.end+')"></span>'+
 '<span>'+safe(c.name)+'</span></label>').join('')+'</fieldset>';
 const html='<p class="tip full-span">Puedes diferenciar visualmente cada tarjeta. No cambiará el saldo, el crédito disponible ni las fechas de pago.</p>'+
 previewHtml(current,account)+inputs+
 '<input type="hidden" name="account_id" value="'+safe(account.id)+'">';
 ctx.modalOpen('Personalizar color · '+account.name,'card_color',html);
}
export function cardColorChange(event){
 if(event.target?.name!=='card_color')return false;
 const preview=document.querySelector('#card-color-preview'),radio=event.target;
 const selected=byId.get(radio.value);
 if(!preview||!selected)return false;
 preview.style.setProperty('--card-from',selected.start);
 preview.style.setProperty('--card-to',selected.end);
 return true;
}
export async function saveCardColor(ctx,form){
 const fd=new FormData(form),id=String(fd.get('account_id')||''),
 color=String(fd.get('card_color')||'');
 if(!byId.has(color))throw Error('Selecciona un color de la paleta.');
 const account=ctx.state.accounts.find(a=>a.id===id);
 if(!account)throw Error('Cuenta no encontrada.');
 if(ctx.mode==='demo')account.card_color=color;
 else{
  const {error}=await ctx.sb.rpc('set_account_color',{p_account_id:id,p_card_color:color});
  if(error)throw error;
  await ctx.loadData();
 }
 return color;
}
