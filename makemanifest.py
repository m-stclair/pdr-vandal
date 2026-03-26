import datetime as dt
import os

ROOT_INCLUDE = []

def findish():
    manifest_entries = []
    for dn, _, fns in os.walk("."):
        if dn == "." or ".git" in dn or ".idea" in dn or "__pycache__" in dn:
            continue
        if "build" not in dn:
            continue
        manifest_entries += [
            f"{dn}/{fn}" for fn in fns if "shader_manifest" not in fn
        ]
    return manifest_entries


def make_manifest():
    return findish() + [f"./{fn}" for fn in ROOT_INCLUDE]


def generate_serviceworker():
    var = f"""const CACHE_NAME = 'vandal-cache-{dt.datetime.now().timestamp()}';
    const ASSETS_TO_CACHE = {make_manifest()};"""

    const = """
    const SHADER_PREFIX = `${self.location.origin}/build/shaders/`;

    self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)))});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url); 
  if (req.method !== 'GET') return;

  // Network-first for HTML/navigation
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith((async () => {
      try {
        return await fetch(req);
      } catch {
        const cached = await caches.match(req);
        return cached || Response.error();
      }
    })());
    return;
  }
  
  // Only cache same-origin shader assets.
  if (url.origin !== self.location.origin || !url.href.startsWith(SHADER_PREFIX)) {
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    const fresh = await fetch(req);
    const cache = await caches.open(CACHE_NAME);
    await cache.put(req, fresh.clone());
    return fresh;
  })());
});
"""
    return var + const


def write_serviceworker():
    with open("cache-worker.js", "w") as stream:
        stream.write(generate_serviceworker())

