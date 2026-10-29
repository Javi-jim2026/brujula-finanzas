import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Manifiesto PWA abre dentro del ámbito como aplicación independiente',()=>{
 const m=JSON.parse(read('manifest.webmanifest'));
 assert.equal(m.display,'standalone');
 const base='https://javi-jim2026.github.io/brujula-finanzas/';
 const start=new URL(m.start_url,base),scope=new URL(m.scope,base);
 assert.ok(start.href.startsWith(scope.href));
 assert.ok(m.icons.some(i=>i.sizes==='192x192'));
 assert.ok(m.icons.some(i=>i.sizes==='512x512'));
});
test('Android registra Service Worker temprano y muestra instalador verificado',()=>{
 const html=read('index.html');
 assert.match(html,/rel="manifest"/);
 assert.match(html,/navigator\.serviceWorker\.register\("\.\/sw\.js"\)/);
 assert.match(html,/src="install-helper\.mjs"/);
 const helper=read('install-helper.mjs');
 assert.match(helper,/beforeinstallprompt/);
 assert.match(helper,/display-mode: standalone/);
 assert.match(helper,/appinstalled/);
 assert.match(helper,/Instalar Brújula/);
 assert.match(helper,/Crear acceso directo/);
});
test('Cache incluye archivo instalador y script de manifest, sin cachear Supabase',()=>{
 const sw=read('sw.js');
 assert.ok(sw.includes("'./install-helper.mjs'"));
 assert.ok(sw.includes("'install-helper.mjs'"));
 assert.ok(sw.includes('url.origin !== self.location.origin'));
});
