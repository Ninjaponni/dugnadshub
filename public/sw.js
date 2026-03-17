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

  // iOS støtter ikke client.navigate() i PWA — bruk alltid openWindow
  event.waitUntil(clients.openWindow(fullUrl))
})

// Aktiver umiddelbart
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})
