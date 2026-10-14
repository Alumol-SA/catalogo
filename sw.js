/* CAMBIO 13 · Funciona como app y abre aunque haya poca señal.
   - Página, hoja de Google e índice: primero internet; si no hay, lo último guardado.
   - Fotos y letras: primero lo guardado (cargan al instante); si no está, se descarga y se guarda. */
var CACHE = "alumol-v1";
var BASE = ["./", "logo.png", "fotos/indice.json", "productos-respaldo.csv", "icono-192.png"];

self.addEventListener("install", function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(BASE); }).catch(function(){}));
});
self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

function guardar(req, res){
  if (res && (res.ok || res.type === "opaque")) { var copia = res.clone(); caches.open(CACHE).then(function(c){ c.put(req, copia); }); }
  return res;
}
self.addEventListener("fetch", function(e){
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  var esFoto = (url.origin === location.origin && /\/fotos\/.+\.(jpe?g|png|webp)$/i.test(url.pathname)) ||
               url.hostname === "lh3.googleusercontent.com" || url.hostname === "fonts.gstatic.com";
  if (esFoto) {
    e.respondWith(caches.match(req).then(function(r){ return r || fetch(req).then(function(res){ return guardar(req, res); }); }));
    return;
  }
  var nuestro = url.origin === location.origin || url.hostname === "docs.google.com" || url.hostname === "fonts.googleapis.com";
  if (!nuestro) return;
  e.respondWith(fetch(req).then(function(res){ return guardar(req, res); }).catch(function(){
    return caches.match(req).then(function(r){
      return r || caches.match(req, { ignoreSearch: true }).then(function(r2){ return r2 || (req.mode === "navigate" ? caches.match("./") : undefined); });
    });
  }));
});
