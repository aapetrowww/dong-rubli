/* Донг в рубли — офлайн-кэш.
   Свои файлы кладём в кэш при установке. Всё, что тянется с CDN
   (движок распознавания, языковая модель, шрифты) кэшируем при первом
   успешном обращении — после одного онлайн-запуска приложение работает без сети.
   Курс валют не кэшируем никогда: он всегда идёт в сеть, а при её отсутствии
   страница берёт последнее сохранённое значение из localStorage. */

var VERSION = "dongrub-v3";
var SHELL = VERSION + "-shell";
var RUNTIME = VERSION + "-runtime";

var SHELL_FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png"
];

var RUNTIME_HOSTS = [
  "cdn.jsdelivr.net",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "tessdata.projectnaptha.com",
  "raw.githubusercontent.com"
];

var NEVER_CACHE = ["open.er-api.com", "www.cbr-xml-daily.ru", "cbr-xml-daily.ru"];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(SHELL).then(function(c){
      return c.addAll(SHELL_FILES);
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k !== SHELL && k !== RUNTIME) return caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;

  var url;
  try{ url = new URL(req.url); }catch(err){ return; }

  if(NEVER_CACHE.indexOf(url.hostname) !== -1) return;   // курс — только из сети

  // навигация: сначала сеть, при провале — сохранённая страница
  if(req.mode === "navigate"){
    e.respondWith(
      fetch(req).catch(function(){
        return caches.match("index.html").then(function(r){ return r || caches.match("./"); });
      })
    );
    return;
  }

  var sameOrigin = url.origin === self.location.origin;
  var isRuntime = RUNTIME_HOSTS.indexOf(url.hostname) !== -1;
  if(!sameOrigin && !isRuntime) return;

  // из кэша сразу, в фоне обновляем
  e.respondWith(
    caches.match(req).then(function(hit){
      var net = fetch(req).then(function(res){
        if(res && (res.ok || res.type === "opaque")){
          var copy = res.clone();
          caches.open(sameOrigin ? SHELL : RUNTIME).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){ return hit; });
      return hit || net;
    })
  );
});
