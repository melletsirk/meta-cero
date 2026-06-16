/**
 * ============================================================
 * Meta Cero — Service Worker
 * ============================================================
 * Responsabilidades:
 *  1. install   → pre-cachea assets críticos
 *  2. activate  → limpia caches obsoletos y toma control inmediato
 *  3. push      → muestra notificación nativa del SO
 *  4. notificationclick → enfoca ventana existente o abre nueva
 * ============================================================
 */

const CACHE_NAME = 'meta-cero-v1'

// ── Install: pre-cachea la shell de la app ──────────────────
self.addEventListener('install', (event) => {
  // Saltar la fase de espera para activarse inmediatamente
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/'])
    })
  )
})

// ── Activate: limpiar caches de versiones anteriores ────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim()) // tomar control inmediato de todas las pestañas
  )
})

// ── Push: mostrar notificación nativa ───────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Meta Cero', body: event.data.text(), url: '/' }
  }

  const options = {
    body: payload.body || 'Tienes actividad pendiente en Meta Cero',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: payload.tag || 'meta-cero-notification',   // agrupa notificaciones del mismo tipo
    renotify: false,                                  // no vibrar si ya hay una del mismo tag
    requireInteraction: false,
    data: {
      url: payload.url || '/'
    },
    actions: [
      { action: 'open', title: 'Ver ahora' },
      { action: 'dismiss', title: 'Descartar' }
    ]
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Meta Cero', options)
  )
})

// ── Notification click: enfocar ventana existente o abrir ───
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  // Si el usuario clickeó "Descartar", no hacer nada
  if (event.action === 'dismiss') return

  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Buscar una ventana ya abierta de Meta Cero
        const existingClient = clientList.find(
          (client) => client.url.includes(self.location.origin)
        )
        if (existingClient) {
          // Enfocar la ventana existente y navegar a la URL objetivo
          return existingClient.focus().then((client) =>
            client.navigate(targetUrl)
          )
        }
        // Si no hay ventana abierta, abrir una nueva
        return self.clients.openWindow(targetUrl)
      })
  )
})
