/* Brújula v1.13: cache only public UI resources; never cache Supabase responses. */
const CACHE = 'brujula-shell-v1.13';
const SHELL = ['./', './index.html', './styles.css', './app.js', './finance-rules.mjs', './planning-rules.mjs', './planning-ui.mjs', './statement-import.mjs', './recurring-review.mjs', './account-detail.mjs', './install-app.mjs', './install-helper.mjs', './password-recovery.mjs', './payday-planning.mjs', './payday-panel.mjs', './msi-payment-link.mjs', './card-cycle.mjs', './cycle-ui.mjs', './card-colors.mjs', './conditional-engine.mjs', './conditional-ui.mjs', './config.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(names => Promise.all(names.filter(n=>n!==CACHE).map(n=>caches.delete(n)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin || e.request.method !== 'GET') return;
  // Exclude all API/data requests, and only cache the exact application assets.
  const path = url.pathname.split('/').pop() || 'index.html';
  const allowed = new Set(['index.html','styles.css','app.js','finance-rules.mjs','planning-rules.mjs','planning-ui.mjs','statement-import.mjs','recurring-review.mjs','account-detail.mjs', 'install-app.mjs','install-helper.mjs','password-recovery.mjs','payday-planning.mjs','payday-panel.mjs','msi-payment-link.mjs','card-cycle.mjs','cycle-ui.mjs','card-colors.mjs','conditional-engine.mjs','conditional-ui.mjs','config.js','manifest.webmanifest','icon-192.png','icon-512.png']);
  if (!allowed.has(path)) return;
  e.respondWith(fetch(e.request).then(resp=>{
    if(resp.ok && resp.type==='basic') {const copy=resp.clone(); caches.open(CACHE).then(cache=>cache.put(e.request,copy));}
    return resp;
  }).catch(()=>caches.match(e.request)));
});
