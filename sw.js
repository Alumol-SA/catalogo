/* Antes el catálogo vivía en la raíz del dominio y registraba aquí un service worker.
   Ahora el catálogo está en /catalogo/ (con su propio service worker). Este archivo
   solo se da de baja a sí mismo en los celulares que tenían el anterior. */
self.addEventListener("install", function(){ self.skipWaiting(); });
self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(ks){ return Promise.all(ks.map(function(k){ return caches.delete(k); })); })
    .then(function(){ return self.registration.unregister(); }));
});
