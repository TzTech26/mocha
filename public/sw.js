importScripts('/coffee/uv.bundle.js')
importScripts('/coffee/uv.config.js')
importScripts(__uv$config.sw || '/coffee/uv.sw.js')

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

// A worker that is merely active still does not intercept anything for a page
// that was already open when it activated: control is only handed over on the
// page's next load. Claiming takes over those pages straight away, which is
// what makes the proxy work on a first visit instead of on the second.
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

const sw = new UVServiceWorker()

self.addEventListener('fetch', (event) => {
  event.respondWith(
    (async () => {
      if (event.request.url.startsWith(location.origin + __uv$config.prefix)) {
        return await sw.fetch(event)
      }
      return await fetch(event.request)
    })()
  )
})
