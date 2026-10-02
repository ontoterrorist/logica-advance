/* Lógica Advance — service worker: deja la app guardada en el teléfono para jugar sin conexión. */
const PREFIX = 'logica-advance-';
const CACHE = PREFIX + 'v2-89cbe2acde';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'];
/* al instalar se baja todo de la red, sin pasar por la copia HTTP del navegador */
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => {
    const old = ks.filter(k => k.startsWith(PREFIX) && k !== CACHE);
    /* las copias sin «v2-» son del guardado antiguo, que mostraba la página vieja: esas pestañas se recargan una vez */
    const legacy = old.some(k => !k.startsWith(PREFIX + 'v2-'));
    return Promise.all(old.map(k => caches.delete(k))).then(() => self.clients.claim()).then(() => {
      /* sin esperar a la recarga: la página nueva no puede pedirse hasta que termine la activación */
      if (legacy) self.clients.matchAll({ type: 'window' }).then(cs => cs.forEach(c => c.navigate(c.url).catch(() => null)));
    });
  }));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.registration.scope)) return;
  e.respondWith(caches.open(CACHE).then(c => {
    const hit = () => c.match(req, { ignoreSearch: true });
    const net = opt => fetch(req.url, opt).then(res => { if (res && res.ok) c.put(req, res.clone()); return res; });
    /* la página: primero la red, para ver siempre la última versión; sin conexión o con red lenta, la copia guardada */
    if (req.mode === 'navigate') {
      const fresh = net({ cache: 'no-cache' });
      const slow = new Promise(r => setTimeout(r, 4000)).then(hit).then(h => h || fresh);
      return Promise.race([fresh, slow]).catch(() => hit());
    }
    return hit().then(h => h || net());
  }));
});
