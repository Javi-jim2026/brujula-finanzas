/* Brújula v1.7 · Ayuda de instalación PWA en Android.
   El instalador del navegador es quien decide si crea WebAPK o acceso directo. */
let deferredInstall=null,installing=false;
export const installedDisplayMode=(displayMode,standaloneFlag=false)=>displayMode==='standalone'||displayMode==='fullscreen'||displayMode==='minimal-ui'||standaloneFlag;
export const installationMessage=({standalone,promptReady,android})=>{
 if(standalone)return 'Abierta como aplicación independiente (sin interfaz del navegador).';
 if(promptReady)return 'Chrome detectó Brújula como aplicación instalable. Toca Instalar aplicación.';
 if(android)return 'Está abierta en modo navegador. Usa Chrome y selecciona Instalar aplicación; evita crear solo un acceso directo.';
 return 'Está abierta en modo navegador. Abre el menú de tu navegador para instalarla como aplicación.';
};
function standalone(){
 return installedDisplayMode(
  ['standalone','fullscreen','minimal-ui'].find(mode=>window.matchMedia?.('(display-mode: '+mode+')').matches)||'browser',
  !!navigator.standalone
 );
}
function android(){return /Android/i.test(navigator.userAgent)}
function refreshInstallButtons(){
 const isInstalled=standalone();
 for(const button of document.querySelectorAll('[data-install-brujula]')){
  button.classList.toggle('hidden',isInstalled);
  button.textContent=deferredInstall?'⬇ Instalar Brújula':'⬇ Instalar como app';
 }
 for(const place of document.querySelectorAll('[data-install-status]')){
  place.textContent=installationMessage({standalone:isInstalled,promptReady:!!deferredInstall,android:android()});
 }
}
function showInstallGuide(){
 const previous=document.getElementById('brujula-install-dialog');
 previous?.remove();
 const modal=document.createElement('div');
 modal.id='brujula-install-dialog';
 modal.className='pwa-help-layer';
 modal.setAttribute('role','dialog');
 modal.setAttribute('aria-modal','true');
 modal.setAttribute('aria-labelledby','pwa-help-title');
 const steps=android()
  ? '1. Abre <b>Chrome</b> directamente, no el navegador integrado de ChatGPT, WhatsApp o Facebook.<br>2. En Chrome visita <b>javi-jim2026.github.io/brujula-finanzas/</b>.<br>3. Abre el menú de <b>tres puntos ⋮</b> y elige <b>Instalar aplicación</b> (el nombre puede variar).<br>4. Si solo aparece «Crear acceso directo», no equivale a instalar la PWA. Comprueba que el sitio se haya cargado por completo y vuelve a abrirlo desde Chrome.<br>5. Abre Brújula <b>desde su icono en la lista de aplicaciones</b>, no desde una pestaña del navegador.'
  : 'Abre Brújula en un navegador compatible y busca la opción «Instalar aplicación» en su menú.';
 modal.innerHTML='<section class="pwa-help-card"><h2 id="pwa-help-title">Instalar Brújula como aplicación</h2>'
 +'<p>'+steps+'</p><p class="pwa-help-hint">Una PWA instalada correctamente se abre sin la barra de direcciones ni las pestañas del navegador. Instalarla <b>no crea un APK descargable</b>, ni modifica tus tarjetas, movimientos o datos de Supabase.</p>'
 +'<p class="pwa-help-hint"><b>Si ya tienes un icono antiguo</b> que abre Chrome, primero elimina ese acceso directo de tu pantalla de inicio. No borres los datos de Chrome ni tu cuenta.</p>'
 +'<div class="pwa-help-footer"><button type="button" id="close-brujula-install" class="btn primary">Entendido</button></div></section>';
 modal.addEventListener('click',e=>{if(e.target===modal||e.target.id==='close-brujula-install')modal.remove()});
 document.body.append(modal);
 modal.querySelector('button')?.focus();
}
async function askInstall(){
 if(standalone()){refreshInstallButtons();return}
 if(installing)return;
 if(!deferredInstall){showInstallGuide();return}
 installing=true;
 const prompt=deferredInstall;
 deferredInstall=null;
 try{
  // Debe iniciarse directamente por la interacción del usuario.
  await prompt.prompt();
  const choice=await prompt.userChoice;
  if(choice?.outcome!=='accepted')showInstallGuide();
 }catch(err){
  showInstallGuide();
 }finally{installing=false;refreshInstallButtons()}
}
export function setupInstallSupport(){
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;refreshInstallButtons()});
 window.addEventListener('appinstalled',()=>{deferredInstall=null;refreshInstallButtons()});
 window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change',refreshInstallButtons);
 document.querySelectorAll('[data-install-brujula]').forEach(button=>button.addEventListener('click',askInstall));
 refreshInstallButtons();
}
