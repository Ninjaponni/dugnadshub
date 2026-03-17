// Dugnadshub Service Worker — Push-varsler
self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: {
      url: data.url || '/',
    },
    vibrate: [200, 100, 200],
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Dugnadshub', options)
  )
})

// Åpne appen når bruker trykker på varselet
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const path = event.notification.data?.url || '/'
  const fullUrl = new URL(path, self.location.origin).href

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Fokuser eksisterende vindu og naviger
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus().then(() => client.navigate(fullUrl))
        }
      }
      // Ellers åpne nytt vindu
      return clients.openWindow(fullUrl)
    })
  )
})

// Aktiver umiddelbart
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})
