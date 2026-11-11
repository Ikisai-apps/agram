// El service worker de la carta: cachea la propia web para funcionar sin red (el eje y el libro local ya viven en
// localStorage). Precachea el armazón (index, carta/, manifiesto) y guarda, al primer uso, cada módulo del mismo
// origen que la carta pide (src/, datos/, ejemplos/, antigua/, arte/): caché primero, red si falta, y lo que llega de
// la red se guarda. Lo de otros orígenes (lottie-web desde cdnjs) no se toca. Al cambiar la versión se borran las
// cachés anteriores.
const VERSION = 'agram-carta-v13';
const ARMAZON = ['./', './index.html', './manifest.webmanifest', './carta/estilo.css', './carta/app.js', './carta/carta.js', './carta/dom.js', './carta/gestos.js', './carta/textos.js', './carta/cuentas.js', './carta/sincronia.js', './carta/opinar.js', './carta/guia.js', './carta/externa.js', './carta/texto.js', './carta/icono.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARMAZON)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((claves) => Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const peticion = e.request;
  if (peticion.method !== 'GET') return;
  const url = new URL(peticion.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const guardada = await cache.match(peticion, { ignoreSearch: true });
    const red = fetch(peticion).then((r) => {
      if (r && r.ok && r.type === 'basic') cache.put(peticion, r.clone());
      return r;
    }).catch(() => null);
    if (guardada) {
      red.catch(() => {}); // refresca en segundo plano
      return guardada;
    }
    const r = await red;
    if (r) return r;
    if (peticion.mode === 'navigate') return (await cache.match('./index.html')) ?? Response.error();
    return Response.error();
  })());
});
