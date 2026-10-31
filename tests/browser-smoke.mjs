/* Smoke de arranque real en Chrome: detecta errores que node --check no ve.
 Ejecutar con: npm install --no-save playwright-core && node tests/browser-smoke.mjs */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
const root=process.cwd(),mapping={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const name=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!name.startsWith(root+path.sep)&&name!==path.join(root,'index.html')){res.writeHead(403);res.end();return}
 try{const bytes=fs.readFileSync(name);res.writeHead(200,{'Content-Type':mapping[path.extname(name)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes)}
 catch{res.writeHead(404);res.end('Not found')}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
const chromeCandidates=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/opt/google/chrome/chrome'];
const executablePath=chromeCandidates.find(fs.existsSync);
let browser;
try{
 if(!executablePath)throw Error('No se encontró Chrome instalado en el runner para la prueba real');
 browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage({viewport:{width:412,height:915}});
 const errors=[];
 const client=await page.context().newCDPSession(page);
 await client.send('Runtime.enable');
 client.on('Runtime.exceptionThrown',e=>{const v=e.exceptionDetails||{};errors.push('CDP '+(v.url||v.stackTrace?.callFrames?.[0]?.url||'unknown')+':'+(Number(v.lineNumber)+1)+':'+(Number(v.columnNumber)+1)+' '+v.text+' '+(v.exception?.description||''))});
 page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
 page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text()+' '+JSON.stringify(m.location()))});
 page.on('requestfailed',r=>{if(/\.mjs|\.js/.test(r.url())&&!r.url().includes('esm.sh'))errors.push('request: '+r.url()+' '+r.failure()?.errorText)});
 await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(1500);
 const forgot=page.locator('#forgot-password');
 await forgot.click();
 if(await page.locator('#recovery-request-panel').isHidden())throw Error('Olvidé mi contraseña: la pantalla no abrió. '+JSON.stringify(errors));
 await page.locator('#recovery-request-panel [data-recovery-back]').click();
 if(await page.locator('#auth-form').isHidden())throw Error('El enlace de volver al acceso no funciona.');
 await page.locator('[data-install-brujula]').first().click();
 if(await page.locator('#brujula-install-dialog').count()){
  await page.locator('#close-brujula-install').click();
 }
 await page.locator('#demo').click();
 if(await page.locator('#shell').isHidden())throw Error('Explorar demo no muestra la aplicación. '+JSON.stringify(errors));
 const clockLabel=page.locator('#finance-clock-label');
 if(await clockLabel.count()!==1||!await clockLabel.innerText().then(t=>t.includes('Reloj del dispositivo')||t.includes('servidor')))
  throw Error('Reloj interno no aparece al abrir la app.');
 const sequence=page.locator('#sequence-engine-panel');
 if(await sequence.count()!==1)throw Error('No existe el motor de secuencias en Resumen.');
 if(await sequence.locator('.sequence-card').count()!==2)throw Error('No se evaluaron ambas tarjetas de la demo.');
 if(!await sequence.innerText().then(t=>t.includes('Límite')&&t.includes('Deuda estimada')&&t.includes('Disponible estimado')&&t.includes('Vencimiento')))
  throw Error('El motor no presenta límites, deudas y cronograma.');
 const budgetPanel=page.locator('#paycheck-panel');
 if(await budgetPanel.count()!==1)throw Error('No aparece el nuevo panel de nómina quincenal.');
 if(!await budgetPanel.innerText().then(t=>t.includes('Próxima nómina')))throw Error('No aparece la próxima nómina.');
 await page.locator('[data-act="cash-week-next"]').click();
 if(!await budgetPanel.innerText().then(t=>t.includes('Semana siguiente')))throw Error('No cambia la semana de pagos.');
 await page.locator('[data-act="cash-cycle-next"]').click();
 if(!await budgetPanel.innerText().then(t=>t.includes('Próxima quincena')))throw Error('No cambia la quincena de nómina.');
 await page.locator('#mobile-nav [data-page="installments"]').click();
 const planButton=page.locator('[data-act="msi-link"]').first();
 if(await planButton.count()!==1)throw Error('No aparece el botón de vincular pagos MSI.');
 await planButton.click();
 if(await page.locator('#modal-form').getAttribute('data-table')!=='msi_link')throw Error('No abrió el formulario de vinculación MSI.');
 if(await page.locator('[name="payment_mode"]').inputValue()!=='new')throw Error('En demo sin pagos previos debe proponer un pago nuevo.');
 await page.locator('#modal-form [type="submit"]').click();
 await page.waitForTimeout(100);
 if(!await page.locator('#content').innerText().then(t=>t.includes('2 de 9 mensualidades pagadas')&&t.includes('Ver pagos MSI vinculados (1)')))throw Error('Vincular MSI no actualizó el historial y contador. Vista='+JSON.stringify((await page.locator('#content').innerText()).slice(0,2300))+'; modal='+await page.locator('#modal').getAttribute('class')+'; aviso='+await page.locator('#toast').innerText()+'; errors='+JSON.stringify(errors));
 await page.locator('#mobile-nav [data-page="dashboard"]').click();
 if(await page.locator('#condition-cycles .cycle-decision-card').count()<2)throw Error('No se muestran condiciones independientes por tarjeta en Resumen.');
 await page.locator('#quick-add').click();
 await page.locator('#modal-form [name="kind"]').selectOption('purchase');
 await page.locator('#modal-form [name="account_id"]').selectOption('demo-cc1');
 if(!await page.locator('#movement-condition').innerText().then(t=>t.includes('Compra del ciclo')))throw Error('El formulario no interpreta el ciclo de la tarjeta.');
 const currentDate=await page.locator('#modal-form [name="transaction_date"]').inputValue();
 await page.locator('#modal-form [name="transaction_date"]').fill('2099-01-01');
 if(!await page.locator('#movement-condition').innerText().then(t=>t.includes('futuro')))throw Error('No avisa que una operación futura no debe contabilizarse.');
 await page.locator('#modal-form [name="transaction_date"]').fill(currentDate);
 if(await page.locator('#modal').isHidden())throw Error('Registrar movimiento no abre formulario. '+JSON.stringify(errors));
 await page.locator('#close-modal').click();
 await page.locator('#mobile-nav [data-page="accounts"]').click();
 if(!await page.locator('#content').innerText().then(t=>t.includes('Cuentas y tarjetas')))throw Error('La navegación a tarjetas falló.');
 const cardBefore=await page.locator('.account-cards .bank-card').first().getAttribute('style');
 if(!cardBefore?.includes('--card-from:'))throw Error('Falta el fondo de color en las tarjetas.');
 await page.locator('.account-cards .bank-card [data-act="card-color"]').first().click();
 if(await page.locator('#modal-form').getAttribute('data-table')!=='card_color')throw Error('No se abre el editor de colores.');
 if(await page.locator('#modal-form [name="card_color"]').count()!==12)throw Error('Faltan colores en el editor.');
 await page.locator('#modal-form input[name="card_color"][value="red"]').check();
 if(!await page.locator('#card-color-preview').getAttribute('style').then(s=>s.includes('--card-from: #8f1e37')||s.includes('--card-from:#8f1e37')))throw Error('La vista previa no cambia de color.');
 await page.locator('#modal-form button[type="submit"]').click();
 if(!await page.locator('#modal').isHidden())throw Error('No se guardó el color.');
 if(!await page.locator('.account-cards .bank-card').first().getAttribute('style').then(s=>s.includes('--card-from:#8f1e37')))throw Error('El color no persiste al cerrar la ventana.');
 await page.locator('.account-cards .bank-card [data-act="view-account"]').first().click();
 if(!await page.locator('.account-color-banner').getAttribute('style').then(s=>s.includes('--card-from:#8f1e37')))throw Error('Color no aparece en expediente.');
 await page.locator('[data-act="account-back"]').click();
 await page.locator('#mobile-nav [data-page="dashboard"]').click();
 if(!await page.locator('.tile-icon-card').first().getAttribute('style').then(s=>s.includes('--card-from:#8f1e37')))throw Error('Resumen no refleja el color.');

 await page.locator('#mobile-nav [data-page="statements"]').click();
 if(!await page.locator('#content').innerText().then(t=>t.includes('Cortes y conciliación')))throw Error('Pagos no abre Cortes y conciliación en móvil.');
 const cycleConfigure=page.locator('#cycle-agenda [data-act="card-cycle"]').first();
 if(await cycleConfigure.count()!==1)throw Error('La agenda no ofrece configurar el mes de vencimiento.');
 await cycleConfigure.click();
 if(await page.locator('#modal-form').getAttribute('data-table')!=='card_cycle')throw Error('No abrió configurar ciclo bancario.');
 await page.locator('#modal-form [name="cutoff_day"]').fill('12');
 await page.locator('#modal-form [name="due_day"]').fill('4');
 await page.locator('#modal-form [name="due_month_offset"]').selectOption('1');
 await page.locator('#modal-form [name="due_window_days"]').selectOption('0');
 await page.locator('#modal-form button[type="submit"]').click();
 if(!await page.locator('#modal').isHidden())throw Error('No se guardó el calendario de tarjeta. Aviso: '+await page.locator('#toast').innerText());
 if(!await page.locator('#cycle-agenda').innerText().then(t=>t.includes('Importe por confirmar')))throw Error('No hay previsiones al configurar el ciclo bancario.');
 await page.locator('[data-act="new-statement"]').click();
 if(await page.locator('#modal-form').getAttribute('data-table')!=='statements')throw Error('Registrar estado de cuenta no abre el formulario.');
 await page.locator('#close-modal').click();
 if(errors.some(e=>/pageerror|request:/.test(e)))throw Error('Errores JavaScript: '+JSON.stringify(errors));
 console.log('BROWSER SMOKE OK: reloj, secuencias, límites, recuperar, instalar, demo, ciclos, colores y navegación');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
