/* Brújula: ayuda de instalación Android/PWA.
   Distingue instalación real de un acceso directo que abre el navegador.
   Nunca fuerza instalaciones ni cambia datos privados. */
let deferredInstallPrompt=null;
const standaloneQuery=window.matchMedia?.('(display-mode: standalone)');
const launchedAsApp=()=>!!(standaloneQuery?.matches||navigator.standalone===true||
  document.referrer?.startsWith('android-app://'));
let installHelpVisible=false;

function ensureInstallUI(){
  const signIn=document.querySelector('.signin');
  if(signIn&&!document.querySelector('#brujula-install-info')){
    const wrapper=document.createElement('div');
    wrapper.id='brujula-install-info';
    wrapper.className='install-panel';
    wrapper.innerHTML='<div class="install-info-row"><span id="install-mode-icon">📱</span><div><strong id="install-mode-heading"></strong><p id="install-mode-message"></p></div></div>'+
      '<div class="install-info-actions"><button id="install-brujula" type="button" class="btn outline">Ver cómo instalar</button></div>'+
      '<p id="install-manual-help" class="install-manual-help hidden">Abre <b>https://javi-jim2026.github.io/brujula-finanzas/</b> directamente en <b>Google Chrome</b> (no dentro de ChatGPT, WhatsApp o Facebook). En el menú ⋮ de Chrome selecciona <b>Instalar aplicación</b> o <b>Instalar y crear acceso directo → Instalar</b>. Si solamente aparece <b>Crear acceso directo</b>, el acceso directo abrirá Chrome, no la app sin barras. Asegúrate de usar Chrome actualizado y vuelve a cargar la página.</p>';
    signIn.append(wrapper);
    wrapper.querySelector('#install-brujula').addEventListener('click',requestInstall);
  }
  const actions=document.querySelector('.top-actions');
  if(actions&&!document.querySelector('#brujula-install-action')){
    const button=document.createElement('button');
    button.id='brujula-install-action';
    button.type='button';
    button.className='btn outline small-btn';
    button.addEventListener('click',requestInstall);
    actions.prepend(button);
  }
  updateInstallUI();
}
function updateInstallUI(){
  const app=launchedAsApp();
  const heading=document.querySelector('#install-mode-heading');
  const message=document.querySelector('#install-mode-message');
  const icon=document.querySelector('#install-mode-icon');
  const btn=document.querySelector('#install-brujula');
  const action=document.querySelector('#brujula-install-action');
  const help=document.querySelector('#install-manual-help');
  if(heading)heading.textContent=app?'✅ Brújula está abierta como aplicación':'🌐 Brújula está abierta en el navegador';
  if(icon)icon.textContent=app?'✓':'📱';
  if(message)message.textContent=app?'Modo independiente, sin barra de direcciones.':'Para abrir sin barra de Chrome necesitas instalar la PWA, no solo crear un acceso directo.';
  if(btn){btn.classList.toggle('hidden',app);btn.textContent=deferredInstallPrompt?'Instalar Brújula':'Cómo instalar Brújula';}
  if(action){action.textContent=app?'✓ App instalada':deferredInstallPrompt?'⬇ Instalar app':'📱 Instalar app';action.disabled=app;action.classList.toggle('hidden',app);}
  if(help)help.classList.toggle('hidden',app||!installHelpVisible);
  const wrapper=document.querySelector('#brujula-install-info');
  if(wrapper)wrapper.classList.toggle('install-installed',app);
}
async function requestInstall(){
  if(launchedAsApp()){updateInstallUI();return}
  if(!deferredInstallPrompt){
    installHelpVisible=!installHelpVisible;
    updateInstallUI();
    const help=document.querySelector('#install-manual-help');
    if(!help||help.closest('.hidden'))window.alert('Abre Brújula directamente desde Google Chrome. Ve al menú ⋮ y elige "Instalar aplicación" (no "Crear acceso directo"). Si no aparece la opción, recarga y vuelve a revisar.');
    else help.scrollIntoView({behavior:'smooth',block:'nearest'});
    return;
  }
  const prompt=deferredInstallPrompt;deferredInstallPrompt=null;
  try{
    await prompt.prompt();
    const choice=await prompt.userChoice;
    if(choice?.outcome!=='accepted')installHelpVisible=true;
  }catch(err){
    console.warn('Brújula: no se pudo mostrar la instalación PWA',err);
    installHelpVisible=true;
  }
  updateInstallUI();
}
window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  deferredInstallPrompt=event;
  updateInstallUI();
});
window.addEventListener('appinstalled',()=>{
  deferredInstallPrompt=null;
  installHelpVisible=false;
  updateInstallUI();
});
standaloneQuery?.addEventListener?.('change',updateInstallUI);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureInstallUI);
else ensureInstallUI();
