// eslint-disable-next-line @typescript-eslint/no-require-imports
const webpush = require('web-push')

// VAPID-konfig for Web Push
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!

webpush.setVapidDetails(
  'mailto:tormartin@superponni.no',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
)

export { webpush, VAPID_PUBLIC_KEY }
