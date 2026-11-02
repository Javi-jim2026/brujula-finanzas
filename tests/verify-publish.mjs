/* Brújula: comprueba los archivos que realmente se envían a GitHub Pages.
 * Evita despliegues "exitosos" con módulos faltantes que inutilizan el acceso.
 */
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'_site');
const assertFile=(relative,from='sitio')=>{
 const normalized=relative.split('?')[0].split('#')[0].replace(/^\.\//,'').replace(/^\//,'');
 const full=path.resolve(root,normalized||'index.html');
 if(!full.startsWith(root+path.sep)||!fs.existsSync(full)||!fs.statSync(full).isFile()){
  throw Error('Falta en la publicación: '+relative+' (referenciado por '+from+')');
 }
 return full;
};
const html=fs.readFileSync(assertFile('index.html'),'utf8');
const scripts=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)].map(x=>x[1]).filter(s=>!/^https?:/.test(s));
if(!scripts.includes('app.js'))throw Error('index.html debe cargar app.js');
const queued=[...scripts],visited=new Set();
while(queued.length){
 const relative=queued.pop();
 if(visited.has(relative))continue;
 visited.add(relative);
 const source=fs.readFileSync(assertFile(relative,'index.html / import'),'utf8');
 if(!/\.(?:m?js)$/.test(relative))continue;
 const matcher=/(?:\bfrom\s*|\bimport\s*\(|\bimport\s*)["'](\.[^"']+)["']/g;
 for(const match of source.matchAll(matcher)){
  const imported=match[1];
  const target=path.posix.normalize(path.posix.join(path.posix.dirname(relative),imported));
  assertFile(target,relative);
  queued.push(target);
 }
}
const sw=fs.readFileSync(assertFile('sw.js'),'utf8');
const shell=sw.match(/\bconst SHELL\s*=\s*\[([\s\S]*?)\]/)?.[1];
if(!shell)throw Error('No se encontró la lista de precaché del service worker');
const cached=[...shell.matchAll(/['"]([^'"]+)['"]/g)].map(x=>x[1]);
for(const asset of cached)assertFile(asset,'sw.js SHELL');
for(const module of visited){
 if(module.endsWith('.mjs')&&!cached.some(x=>x.replace(/^\.\//,'')===module)){
  throw Error('Módulo usado por la app pero sin precaché PWA: '+module);
 }
}
console.log('PUBLICACIÓN VERIFICADA: '+visited.size+' scripts/módulos y '+cached.length+' archivos en caché; sin dependencias locales faltantes.');
