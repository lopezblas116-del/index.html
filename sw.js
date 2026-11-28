// sw.js — EL MUNDO NUNCA SE QUEDA VIEJO.
// GitHub Pages cachea los assets por UN AÑO: sin este guardián, el jugador navega
// una build vieja mezclada con HTML nuevo — la fuente real de errores "imposibles".
// Política: RED PRIMERO (revalidando, nunca el HTTP-cache de un año) con caché
// de emergencia para jugar sin conexión. skipWaiting + claim: la nueva build
// gobierna desde el primer reload, sin esperar a que "se liberen" los viejos.
const CACHE = 'onelatam-v1';

self.addEventListener('install', () => { self.skipWaiting(); });

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(nombres.filter((n) => n.startsWith('onelatam-') && n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const mismoOrigen = url.origin === location.origin;
  // solo assets propios (js/css/html/mapas): las fuentes de Google y demás pasan directas
  if (!mismoOrigen) return;
  if (!/\.(js|mjs|css|html|json|png|jpg|jpeg|svg|webp|ico)($|\?)/i.test(url.pathname)) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      // cache:'no-cache' = revalida con el servidor SIEMPRE (el HTTP-cache del
      // navegador puede traer una entrada de hace un año; eso jamás responde aquí)
      const fresca = await fetch(req, { cache: 'no-cache' });
      if (fresca && fresca.ok) cache.put(req, fresca.clone());
      return fresca;
    } catch (err) {
      const vieja = await cache.match(req, { ignoreSearch: true });
      if (vieja) return vieja;
      throw err;
    }
  })());
});
