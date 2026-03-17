// eslint-disable-next-line @typescript-eslint/no-require-imports
const webpush = require('web-push')

// Lazy VAPID-init — kjores kun ved forste kall, ikke ved modul-import
let vapidInitialized = false

function ensureVapid() {
  if (vapidInitialized) return
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys not configured')
  }
  webpush.setVapidDetails('mailto:tormartin@superponni.no', publicKey, privateKey)
  vapidInitialized = true
}

export { webpush, ensureVapid }
