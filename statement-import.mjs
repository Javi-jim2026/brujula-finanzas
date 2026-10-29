/* Brújula v1.5: extracción local y vista previa; jamás sube el archivo bancario. */
let rows=[],sourceHash='',currentFile='';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cash=n=>Math.round((Number(n)||0)*100)/100;
function amountVal(v){
 if(typeof v==='number')return Math.abs(v);
 let s=String(v??'').replace(/[$\s\u00a0]/g,'').replace(/[()]/g,'-').replace(/[^0-9.,+\-]/g,'');
 if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replaceAll('.','').replace(',','.'):s.replaceAll(',','');
 else if(s.includes(',')){const parts=s.split(',');s=parts.length===2&&parts[1].length<=2?s.replace(',','.'):s.replaceAll(',','')}
 return Math.abs(Number(s));
}
function signVal(v){return String(v??'').includes('(')||String(v??'').trim().startsWith('-')?-1:1}
export function cleanDate(v){
 if(v instanceof Date&&!Number.isNaN(v.getTime()))return v.toISOString().slice(0,10);
 const x=String(v??'').trim();let m=x.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
 if(m){const s=[m[1],m[2].padStart(2,'0'),m[3].padStart(2,'0')].join('-');return s}
 m=x.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
 if(m){let y=m[3];if(y.length===2)y=(Number(y)>60?'19':'20')+y;return y+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0')}
 return null;
}
function isValidDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return false;const d=new Date(s+'T12:00:00Z');return !isNaN(d.getTime())&&d.toISOString().slice(0,10)===s}
function csvSplitLine(s,delim){let row=[],field='',quoted=false;
 for(let i=0;i<s.length;i++){const c=s[i];if(c==='"'){if(quoted&&s[i+1]==='"'){field+='"';i++}else quoted=!quoted}
 else if(c===delim&&!quoted){row.push(field.trim());field=''}
 else field+=c}
 row.push(field.trim());return row;
}
export function csvMatrix(text){
 const first=text.split(/\r?\n/).slice(0,8),delims=[';',',','\t','|'],d=delims.map(x=>({x,n:first.map(l=>csvSplitLine(l,x).length-1).reduce((s,v)=>s+v,0)})).sort((a,b)=>b.n-a.n)[0].x;
 return text.replace(/^\uFEFF/,'').split(/\r?\n/).map(s=>csvSplitLine(s,d)).filter(r=>r.some(c=>c!==''));
}
export function detectTable(matrix,acc){
 let headerIdx=-1, map={},heads=[];
 const keywords={date:/\b(fecha|date|f\.?\s*operaci[oó]n)\b/i,
 desc:/concepto|descripci[oó]n|comercio|merchant|detalle|movimiento|referencia/i,
 amount:/importe|monto|amount|cantidad|total/i,
 charge:/cargo|retiro|d[eé]bito|egreso|charge/i,
 credit:/abono|dep[oó]sito|cr[eé]dito|ingreso|payment|credit/i};
 for(let i=0;i<Math.min(22,matrix.length);i++){
  const row=matrix[i].map(x=>String(x??''));
  const dateIndex=row.findIndex(x=>keywords.date.test(x)),descIndex=row.findIndex(x=>keywords.desc.test(x));
  if(dateIndex>=0&&descIndex>=0){headerIdx=i;heads=row;break}
 }
 if(headerIdx>=0){
  for(const [k,re]of Object.entries(keywords)){let p=heads.findIndex(x=>re.test(x));if(p>=0)map[k]=p;}
 }else{
  map={date:0,desc:1,amount:2};
 }
 const parsed=[];
 for(let i=headerIdx+1;i<matrix.length&&parsed.length<200;i++){
  const r=matrix[i],date=cleanDate(r[map.date]),desc=String(r[map.desc]??'').trim();
  if(!isValidDate(date)||!desc)continue;
  const charges=map.charge!=null?amountVal(r[map.charge]):0,credits=map.credit!=null?amountVal(r[map.credit]):0;
  let amount=0,negative=false;
  if(charges>0||credits>0){amount=charges||credits;negative=credits>0}
  else{amount=amountVal(r[map.amount]);negative=signVal(r[map.amount])<0;}
  if(!Number.isFinite(amount)||amount<=0||amount>1e9)continue;
  const kind=acc.kind==='credit'?(negative?'payment':'purchase'):(negative?'income':'expense');
  parsed.push({date,description:desc.slice(0,350),amount:cash(amount),kind,selected:true,sourceLine:i+1});
 }
 return parsed;
}
function pdfRows(text,acc){
 const lines=text.split(/\r?\n/),matrix=[];
 const pat=/^(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{4}[-\/]\d{1,2}[-\/]\d{1,2})\s+(.+?)\s+(-?[$]?\s*[\d,.]+)(?:\s+(?:MXN|M\.N\.))?\s*$/i;
 for(const line of lines){const m=line.trim().match(pat);if(m)matrix.push([m[1],m[2],m[3]])}
 return detectTable(matrix,acc);
}
async function pdfText(buffer){
 const p=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
 p.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
 const doc=await p.getDocument({data:new Uint8Array(buffer)}).promise,lines=[];
 for(let i=1;i<=Math.min(doc.numPages,40);i++){
  const page=await doc.getPage(i),content=await page.getTextContent(),groups=new Map();
  for(const it of content.items){const y=Math.round(it.transform?.[5]||0),x=it.transform?.[4]||0;if(!groups.has(y))groups.set(y,[]);groups.get(y).push({x,t:it.str||''})}
  for(const row of [...groups.entries()].sort((a,b)=>b[0]-a[0]))lines.push(row[1].sort((a,b)=>a.x-b.x).map(x=>x.t).join(' '));
 }
 return lines.join('\n');
}
function existingDuplicate(row,accountId,state){
 const normalize=x=>String(x??'').toLowerCase().replace(/[^a-z0-9áéíóúñ]/g,'');
 return (state.movements||[]).some(m=>m.account_id===accountId&&m.transaction_date===row.date&&cash(m.amount)===cash(row.amount)&&
 normalize(m.description||m.merchant).slice(0,30)===normalize(row.description).slice(0,30));
}
export function renderImport(ctx){
 const accounts=ctx.state.accounts||[];
 return '<div class="page-head"><div><h1>Importar estado de cuenta</h1><p class="muted">Extrae movimientos de CSV, Excel o PDF con texto seleccionable; revisa antes de guardar.</p></div></div>'
 +'<div class="notice warn">🔒 El archivo se procesa en tu navegador; no se envía ni almacena en Supabase. Solo los movimientos que confirmes se guardarán. No se importan pagos para no generar intereses automáticamente: captura el importe oficial en <b>Cortes y conciliación</b>. PDF escaneados o formatos no reconocidos requieren revisión manual.</div>'
 +'<section class="panel section"><div class="import-controls"><label class="field">Cuenta o tarjeta<select id="import-account">'+accounts.map(a=>'<option value="'+a.id+'">'+esc(a.name)+' · '+(a.kind==='credit'?'Crédito':'Débito/efectivo')+'</option>').join('')+'</select></label>'
 +'<label class="field">Estado de cuenta (máximo 8 MB)<input id="import-file" type="file" accept=".csv,.txt,.xlsx,.xls,.pdf,application/pdf,text/csv"></label></div>'
 +'<p class="tip">Se interpretan fechas DD/MM/AAAA y YYYY-MM-DD. Los cargos positivos se interpretan como compras, y los importes negativos o la columna de abonos como pagos/ingresos. Comprueba siempre los signos: cada banco usa su propio formato.</p>'
 +'<div id="import-preview"><p class="muted">Selecciona primero un archivo para ver y editar las operaciones detectadas.</p></div></section>';
}
function preview(ctx){
 const host=document.querySelector('#import-preview');if(!host)return;
 const accountId=document.querySelector('#import-account')?.value,acc=ctx.state.accounts.find(a=>a.id===accountId);
 if(!acc){host.innerHTML='<p class="notice warn">Registra una cuenta antes de importar.</p>';return}
 const invalid=rows.filter(r=>!r.selected).length;
 const input=rows.map((r,i)=>{
  const old=existingDuplicate(r,accountId,ctx.state),before=acc.opening_balance_date&&r.date<=acc.opening_balance_date;
  const valid=isValidDate(r.date)&&r.amount>0&&!before;
  const disabled=!valid;
  const opts=(acc.kind==='credit'?[['purchase','Compra/cargo'],['payment','Pago/abono'],['refund','Devolución'],['fee','Comisión'],['interest','Intereses']]:[['expense','Gasto'],['income','Ingreso'],['transfer_out','Salida transferencia'],['transfer_in','Entrada transferencia']]);
  const note=before?'Anterior al saldo inicial':old?'Coincide con movimiento existente':!valid?'Fecha/importe inválido':'Revisar antes de importar';
  if(old||disabled)r.selected=false;
  return '<tr><td><input type="checkbox" class="import-select" data-index="'+i+'" '+(r.selected?'checked':'')+' '+(disabled?'disabled':'')+'><small>'+esc(note)+'</small></td>'
  +'<td><input class="import-date" data-index="'+i+'" type="date" value="'+esc(r.date||'')+'"></td>'
  +'<td><input class="import-desc" data-index="'+i+'" type="text" maxlength="350" value="'+esc(r.description)+'"></td>'
  +'<td><select class="import-kind" data-index="'+i+'">'+opts.map(([val,label])=>'<option value="'+val+'" '+(r.kind===val?'selected':'')+'>'+label+'</option>').join('')+'</select></td>'
  +'<td><input class="import-amount" data-index="'+i+'" type="number" min="0.01" step="0.01" value="'+r.amount+'"></td></tr>';
 }).join('');
 host.innerHTML=rows.length?
 '<h3>Revisión: '+esc(currentFile)+' · '+rows.length+' movimientos detectados</h3>'
 +'<p class="tip">Desmarca cualquier duplicado o movimiento que no reconozcas. Puedes corregir fecha, concepto, tipo e importe. Lo confirmado quedará registrado sin asociarse automáticamente a un corte bancario.</p>'
 +'<div class="table-wrap"><table class="data-table import-table"><thead><tr><th>Guardar</th><th>Fecha</th><th>Concepto</th><th>Tipo</th><th>Importe</th></tr></thead><tbody>'+input+'</tbody></table></div>'
 +'<div class="import-actions"><span id="import-summary">'+rows.filter(x=>x.selected).length+' seleccionados</span><button class="btn primary" data-act="import-confirm">Guardar operaciones seleccionadas</button></div>'
 :'<p class="notice warn">No detecté operaciones con fecha, concepto e importe. Si es PDF escaneado o el formato difiere, exporta el historial bancario como CSV/Excel para importarlo.</p>';
}
export async function importFileChanged(file,ctx){
 if(!file)return;
 const status=document.querySelector('#import-preview');if(!status)return;
 if(file.size>8_000_000){ctx.toast('El archivo supera 8 MB. Usa uno más pequeño.',true);return}
 status.innerHTML='<p class="muted">Procesando el archivo localmente…</p>';
 try{
  const accountId=document.querySelector('#import-account')?.value,acc=ctx.state.accounts.find(a=>a.id===accountId);
  if(!acc)throw Error('Primero registra una cuenta.');
  const data=await file.arrayBuffer(),hash=new Uint8Array(await crypto.subtle.digest('SHA-256',data));
  sourceHash=[...hash].map(n=>n.toString(16).padStart(2,'0')).join('');
  const name=file.name.toLowerCase();let matrix;
  if(name.endsWith('.pdf')){const txt=await pdfText(data);rows=pdfRows(txt,acc)}
  else if(name.endsWith('.xlsx')||name.endsWith('.xls')){
   const x=await import('https://esm.sh/xlsx@0.18.5?bundle'),xlsx=x.default||x;
   const book=xlsx.read(data,{type:'array',cellDates:true});
   if(!book.SheetNames?.length)throw Error('El libro Excel no contiene hojas.');
   matrix=xlsx.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1,defval:'',raw:false});
   rows=detectTable(matrix,acc);
  }else{
   let text=new TextDecoder('utf-8').decode(data);
   if(text.includes('\uFFFD'))text=new TextDecoder('windows-1252').decode(data);
   matrix=csvMatrix(text);rows=detectTable(matrix,acc);
  }
  currentFile=file.name;preview(ctx);
 }catch(e){rows=[];status.innerHTML='<div class="notice warn">No se pudo extraer el archivo: '+esc(e.message)+'. Exporta CSV/Excel o captura los movimientos manualmente.</div>'}
}
export function importChange(event,ctx){
 const el=event.target;
 if(el.id==='import-file'){importFileChanged(el.files?.[0],ctx);return true}
 if(el.id==='import-account'){rows=[];document.querySelector('#import-preview').innerHTML='<p class="muted">Selecciona el archivo de la cuenta elegida.</p>';return true}
 if(el.matches('.import-select,.import-date,.import-desc,.import-amount,.import-kind')){
  const i=Number(el.dataset.index),r=rows[i];if(!r)return true;
  if(el.classList.contains('import-select'))r.selected=el.checked;
  else if(el.classList.contains('import-date'))r.date=el.value;
  else if(el.classList.contains('import-desc'))r.description=el.value;
  else if(el.classList.contains('import-amount'))r.amount=cash(el.value);
  else r.kind=el.value;
  const summary=document.querySelector('#import-summary');if(summary)summary.textContent=rows.filter(x=>x.selected).length+' seleccionados';
  return true;
 }
 return false;
}
async function sha256(s){const raw=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(raw)].map(v=>v.toString(16).padStart(2,'0')).join('')}
export async function importClick(b,ctx){
 if(b.dataset.act!=='import-confirm')return false;
 if(ctx.mode==='demo'){ctx.toast('Importar solo está disponible tras iniciar sesión, para no perder datos de demostración.',true);return true}
 const id=document.querySelector('#import-account')?.value,acc=ctx.state.accounts.find(a=>a.id===id);
 if(!acc){ctx.toast('Selecciona una cuenta.',true);return true}
 const picked=rows.filter(r=>r.selected);if(!picked.length){ctx.toast('No seleccionaste movimientos.',true);return true}
 if(picked.length>200){ctx.toast('Se permiten máximo 200 por archivo.',true);return true}
 const category=acc.kind==='credit'?'Compras':'Otros';
 try{
  const data=[];
  for(const row of picked){
   if(!isValidDate(row.date)||row.amount<=0||!row.description.trim())throw Error('Hay fechas, conceptos o importes inválidos.');
   if(acc.opening_balance_date && row.date<=acc.opening_balance_date)throw Error('Un cargo seleccionado es anterior al saldo inicial; ya está incorporado en tu deuda.');
   if(existingDuplicate(row,id,ctx.state))throw Error('Hay operaciones que coinciden con tu historial. Desmárcalas para evitar duplicaciones.');
   const hash=await sha256(sourceHash+'|'+row.sourceLine+'|'+row.description+'|'+row.amount);
   data.push({transaction_date:row.date,kind:row.kind,amount:row.amount,description:row.description,
    category,merchant:'',reference:'Importación revisada',import_hash:hash});
  }
  if(!confirm('¿Guardar '+data.length+' movimientos revisados? Esto modificará los saldos de tu cuenta.'))return true;
  b.disabled=true;b.textContent='Importando…';
  const {data:result,error}=await ctx.sb.rpc('import_statement_movements',{p_account:id,p_rows:data});
  if(error)throw error;
  await ctx.loadData();ctx.toast('Importados '+result.inserted+' movimientos. Repetidos del mismo archivo: '+result.skipped+'.');
  rows=[];ctx.render();
 }catch(e){ctx.toast('No se importó: '+e.message,true)}finally{b.disabled=false;b.textContent='Guardar operaciones seleccionadas'}
 return true;
}
