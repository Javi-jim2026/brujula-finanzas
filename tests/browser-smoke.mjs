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
 await page.locator('#quick-add').click();
 if(await page.locator('#modal').isHidden())throw Error('Registrar movimiento no abre formulario. '+JSON.stringify(errors));
 await page.locator('#close-modal').click();
 await page.locator('[data-page="accounts"]').first().click();
 if(!await page.locator('#content').innerText().then(t=>t.includes('Cuentas y tarjetas')))throw Error('La navegación a tarjetas falló.');
 if(errors.some(e=>/pageerror|request:/.test(e)))throw Error('Errores JavaScript: '+JSON.stringify(errors));
 console.log('BROWSER SMOKE OK: recuperar, instalar, demo, registrar, navegación');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
