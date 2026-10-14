// Wortweg offline: App-Dateien beim Installieren speichern, Schriften beim ersten Laden.
const VERSION = "wortweg-v6";
const AUDIO_CACHE = "wortweg-audio"; // Aufnahmen bleiben über App-Updates hinweg gespeichert
const CORE = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== AUDIO_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== location.origin && !isFont) return;
  // Netz zuerst für die App selbst (damit Updates ankommen), Cache als Rückfall ohne Internet
  if (!isFont && (e.request.mode === "navigate" || url.pathname.endsWith("index.html"))) {
    e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put("index.html", copy)); return r; }).catch(() => caches.match("index.html")));
    return;
  }
  if (url.pathname.endsWith("audio/manifest.json")) {
    e.respondWith(fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(AUDIO_CACHE).then(c => c.put(e.request, copy)); } return r; }).catch(() => caches.open(AUDIO_CACHE).then(c => c.match(e.request))));
    return;
  }
  if (url.pathname.includes("/audio/") && url.pathname.endsWith(".mp3")) {
    e.respondWith(caches.open(AUDIO_CACHE).then(c => c.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }))));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok || r.type === "opaque") { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); } return r; })));
});
