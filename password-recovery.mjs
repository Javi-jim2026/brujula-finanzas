/* Brújula Finanzas · recuperación de acceso segura.
 * El enlace se gestiona con Supabase Auth: ningún correo ni contraseña va a GitHub.
 */
export const PASSWORD_RECOVERY_RETURN_URL='https://javi-jim2026.github.io/brujula-finanzas/';
export function hasRecoveryIntent(url){
 const u=new URL(url);
 const query=u.searchParams,fragment=new URLSearchParams(u.hash.slice(1));
 return query.get('type')==='recovery'||fragment.get('type')==='recovery'||
 query.get('recovery')==='1'||fragment.get('recovery')==='1';
}
export function validNewPassword(password,repeat){
 if(typeof password!=='string'||password.length<8)return 'La contraseña debe tener al menos ocho caracteres.';
 if(password.length>72)return 'Utiliza una contraseña de máximo 72 caracteres.';
 if(password!==repeat)return 'Las contraseñas no coinciden.';
 return '';
}
export function createPasswordRecovery({getClient,toast}){
 let recoveryLink=hasRecoveryIntent(window.location.href);
 let recoveryVerified=false;
 let updating=false;
 const $=s=>document.querySelector(s);
 const visible=(el,on)=>el?.classList.toggle('hidden',!on);
 const status=(text)=>{if($('#recovery-notice'))$('#recovery-notice').textContent=text};
 function screen(kind){
  visible($('#gate'),true);visible($('#shell'),false);
  visible($('#auth-form'),kind==='login');
  visible($('#forgot-password'),kind==='login');
  visible($('#recovery-request-panel'),kind==='request');
  visible($('#recovery-update-panel'),kind==='update');
  visible($('#recovery-sent-panel'),kind==='sent');
  visible($('#recovery-error-panel'),kind==='error');
  visible($('#recovery-complete-panel'),kind==='complete');
  visible($('#demo-border'),kind==='login');
  // La instalación sigue disponible si el usuario lo necesita.
 }
 function clearAuthParams(){
  // Evita dejar códigos o tokens de recuperación en la barra de direcciones o historial.
  if(window.history?.replaceState)window.history.replaceState(null,'',window.location.pathname);
 }
 function openUpdate(){
  if(!recoveryVerified)return;
  recoveryLink=true;screen('update');status('');
  clearAuthParams();
  $('#recovery-new-password')?.focus();
 }
 function bindClient(sb){
  sb.auth.onAuthStateChange((event,session)=>{
   if(event==='PASSWORD_RECOVERY'&&session){
    recoveryLink=true;recoveryVerified=true;
    // Supabase recomienda no usar awaits dentro del callback.
    setTimeout(openUpdate,0);
   }
  });
 }
 function handleInitialSession(session){
  if(!recoveryLink)return false;
  if(session){recoveryVerified=true;openUpdate();}
  else{
   screen('error');status('El enlace no pudo validarse o ya expiró. Solicita uno nuevo desde la pantalla de acceso.');
  }
  return true;
 }
 function setup(){
  const hash=new URLSearchParams(window.location.hash.slice(1));
  if(recoveryLink){
   screen('error');status('Validando tu enlace de recuperación…');
  }else if(hash.has('error')||hash.has('error_code')){
   // No mostrar errores de tokens en consola ni repetir enlaces expirados.
   screen('error');status('El enlace de recuperación venció o ya fue utilizado. Solicita uno nuevo.');
  }
  $('#forgot-password')?.addEventListener('click',()=>{
   const current=$('#auth-email')?.value?.trim();
   if(current)$('#recovery-email').value=current;
   status('');screen('request');
  });
  document.querySelectorAll('[data-recovery-back]').forEach(btn=>btn.addEventListener('click',()=>{
   if(updating)return;
   recoveryLink=false;recoveryVerified=false;status('');screen('login');clearAuthParams();
  }));
  $('#recovery-request-form')?.addEventListener('submit',async event=>{
   event.preventDefault();
   const sb=getClient(),email=$('#recovery-email')?.value?.trim();
   if(!sb){status('Todavía se está conectando el servicio. Inténtalo nuevamente en unos segundos.');return;}
   if(!email){status('Escribe tu correo electrónico.');return;}
   const btn=$('#recovery-send-btn');if(btn?.disabled)return;
   if(btn){btn.disabled=true;btn.textContent='Solicitando enlace…'}
   try{
    const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:PASSWORD_RECOVERY_RETURN_URL});
    if(error)throw error;
    // Respuesta neutra: no revelar si un correo existe o no.
    screen('sent');status('');
   }catch(error){
    status(error?.message||'No se pudo solicitar el correo. Revisa tu conexión e inténtalo de nuevo.');
    toast?.('No se pudo solicitar la recuperación.',true);
   }finally{if(btn){btn.disabled=false;btn.textContent='Enviar enlace de recuperación'}}
  });
  $('#recovery-update-form')?.addEventListener('submit',async event=>{
   event.preventDefault();
   const sb=getClient();
   if(updating)return;
   if(!sb||!recoveryVerified){status('Tu enlace no está validado. Solicita uno nuevo.');return;}
   const pass=$('#recovery-new-password').value;
   const repeat=$('#recovery-repeat-password').value;
   const problem=validNewPassword(pass,repeat);
   if(problem){status(problem);return;}
   const btn=$('#recovery-update-btn');if(btn){btn.disabled=true;btn.textContent='Actualizando…'}
   updating=true;status('');
   try{
    const {error}=await sb.auth.updateUser({password:pass});
    if(error)throw error;
    // Por privacidad, limpiar inmediatamente el texto capturado.
    $('#recovery-update-form').reset();
    recoveryVerified=false;recoveryLink=false;
    await sb.auth.signOut({scope:'local'}).catch(()=>{});
    clearAuthParams();screen('complete');
   }catch(error){
    status(error?.message||'No se pudo cambiar la contraseña. Solicita un enlace nuevo si expiró.');
    toast?.('No se pudo actualizar la contraseña.',true);
   }finally{updating=false;if(btn){btn.disabled=false;btn.textContent='Guardar nueva contraseña'}}
  });
 }
 return {setup,bindClient,handleInitialSession,isRecovering:()=>recoveryLink};
}
