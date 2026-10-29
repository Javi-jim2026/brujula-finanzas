import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {installedDisplayMode,installationMessage} from '../install-app.mjs';

test('Standalone de Android no equivale a pestaña del navegador',()=>{
 assert.equal(installedDisplayMode('standalone'),true);
 assert.equal(installedDisplayMode('fullscreen'),true);
 assert.equal(installedDisplayMode('minimal-ui'),true);
 assert.equal(installedDisplayMode('browser'),false);
 assert.equal(installedDisplayMode('browser',true),true);
});
test('Mensajes distintos para navegador, instalación disponible y app independiente',()=>{
 assert.match(installationMessage({standalone:false,promptReady:false,android:true}),/Instalar aplicación/);
 assert.match(installationMessage({standalone:false,promptReady:true,android:true}),/detectó/);
 assert.match(installationMessage({standalone:true,promptReady:false,android:true}),/independiente/);
});
test('Manifiesto PWA conserva identidad estable, modo independiente y tamaños reales de iconos',()=>{
 const m=JSON.parse(fs.readFileSync(new URL('../manifest.webmanifest',import.meta.url),'utf8'));
 assert.equal(m.display,'standalone');
 assert.equal(m.id,'./');
 assert.equal(m.start_url,'./');
 assert.equal(m.scope,'./');
 for(const pixels of [192,512]){
  assert.ok(m.icons.some(icon=>icon.sizes===pixels+'x'+pixels));
  const binary=fs.readFileSync(new URL('../icon-'+pixels+'.png',import.meta.url));
  assert.equal(binary.toString('hex',0,8),'89504e470d0a1a0a');
  assert.equal(binary.readUInt32BE(16),pixels);
  assert.equal(binary.readUInt32BE(20),pixels);
 }
});
test('Pantalla incluye botones de instalación e instala un único asistente',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const js=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const worker=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.ok((html.match(/data-install-brujula/g)||[]).length>=2);
 assert.ok(!html.includes('src="install-helper.mjs"'));
 assert.ok(js.includes('setupInstallSupport();bind();authConnect();'));
 assert.ok(worker.includes("'./install-app.mjs'"));
 assert.ok(worker.includes("'install-app.mjs'"));
 assert.ok(!worker.includes('supabase.co'));
});
