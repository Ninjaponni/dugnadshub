// Klient-side push subscription-logikk

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch {
    console.error('SW-registrering feilet')
    return null
  }
}

export async function subscribeToPush(registration: ServiceWorkerRegistration): Promise<PushSubscription | null> {
  if (!('PushManager' in window)) return null

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) as BufferSource,
    })
    return subscription
  } catch {
    console.error('Push-subscription feilet')
    return null
  }
}

export async function saveSubscription(subscription: PushSubscription, accessToken: string): Promise<boolean> {
  const keys = subscription.toJSON().keys!
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys_p256dh: keys.p256dh,
      keys_auth: keys.auth,
    }),
  })
  return res.ok
}

export async function unsubscribeFromPush(accessToken: string): Promise<boolean> {
  const registration = await navigator.serviceWorker?.ready
  if (!registration) return false

  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return true

  await subscription.unsubscribe()
  await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  })
  return true
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false
  try {
    const registration = await navigator.serviceWorker?.ready
    if (!registration) return false
    const subscription = await registration.pushManager.getSubscription()
    return subscription !== null
  } catch {
    return false
  }
}

// Konverter VAPID-key fra base64 til Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}
