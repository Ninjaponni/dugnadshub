# Push-varsler Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementere Web Push-varsler i Dugnadshub slik at foreldre får beskjed om dugnader, merker og hjelp-behov — pluss at admin kan sende manuelle push-meldinger.

**Architecture:** Service worker i `public/sw.js` håndterer push-events. Next.js API-ruter (`app/api/push/`) håndterer subscription-lagring og sending via `web-push`-biblioteket. Supabase-tabell `push_subscriptions` lagrer endpoints per bruker. Varsler trigges fra eksisterende kode (hendelser, merker) og fra ny admin-side.

**Tech Stack:** web-push (VAPID), Service Worker API, Next.js API Routes, Supabase

---

## Filstruktur

| Fil | Ansvar |
|-----|--------|
| `public/sw.js` | **Ny** — Service worker: lytter på push-events, viser notifikasjoner, håndterer klikk |
| `lib/push/client.ts` | **Ny** — Klient-side: registrer SW, be om tillatelse, subscribe, sende subscription til API |
| `lib/push/server.ts` | **Ny** — Server-side: send push via web-push, hent subscriptions fra DB |
| `lib/push/vapid.ts` | **Ny** — VAPID-konfig, eksporter keys fra env |
| `components/features/PushPrompt.tsx` | **Ny** — UI-komponent som spør bruker om push-tillatelse |
| `app/api/push/subscribe/route.ts` | **Ny** — POST: lagre subscription, DELETE: fjerne subscription |
| `app/api/push/send/route.ts` | **Ny** — POST: send push til filtrerte mottakere (kun admin) |
| `app/api/push/vapid-key/route.ts` | **Ny** — GET: returner public VAPID key |
| `app/admin/varsler/page.tsx` | **Ny** — Admin-side for manuelle push-meldinger med filtrering |
| `app/(app)/profil/page.tsx` | **Endre** — Legg til push-varsel toggle |
| `app/(app)/hjem/page.tsx` | **Endre** — Vis PushPrompt for nye brukere |
| `app/admin/hendelser/page.tsx` | **Endre** — "Send hjelp-varsel" knapp på aktive hendelser |
| `app/admin/oversikt/page.tsx` | **Endre** — Legg til "Varsler" i admin-navigasjon |
| `app/layout.tsx` | **Endre** — Registrer service worker |
| `lib/supabase/types.ts` | **Endre** — Legg til PushSubscription-type |
| `.env.local` | **Endre** — Legg til VAPID-nøkler |

---

## Task 1: VAPID-nøkler og dependencies

**Files:**
- Modify: `.env.local`
- Modify: `package.json`
- Create: `lib/push/vapid.ts`

- [ ] **Step 1: Generer VAPID-nøkler**

```bash
npx web-push generate-vapid-keys
```

Kopier output — public key og private key.

- [ ] **Step 2: Legg til i .env.local**

Legg til disse to linjene i `.env.local`:
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key fra steg 1>
VAPID_PRIVATE_KEY=<private key fra steg 1>
```

- [ ] **Step 3: Installer web-push**

```bash
npm install web-push
```

- [ ] **Step 4: Opprett VAPID-konfig**

Opprett `lib/push/vapid.ts`:
```typescript
import webpush from 'web-push'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!

webpush.setVapidDetails(
  'mailto:tormartin@superponni.no',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
)

export { webpush, VAPID_PUBLIC_KEY }
```

- [ ] **Step 5: Legg til VAPID-keys i Vercel**

```bash
npx vercel env add NEXT_PUBLIC_VAPID_PUBLIC_KEY
npx vercel env add VAPID_PRIVATE_KEY
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/push/vapid.ts
git commit -m "feat: legg til web-push dependency og VAPID-konfig"
```

---

## Task 2: Supabase-tabell for push subscriptions

**Files:**
- Modify: `lib/supabase/types.ts`

- [ ] **Step 1: Opprett tabell via SQL Editor**

Kopier til utklipp med pbcopy og kjør i Supabase SQL Editor:

```sql
CREATE TABLE push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  endpoint text NOT NULL,
  keys_p256dh text NOT NULL,
  keys_auth text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- RLS: brukere kan lese/slette egne, admin kan lese alle
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can read all"
  ON push_subscriptions FOR SELECT
  USING (true);
```

- [ ] **Step 2: Legg til TypeScript-type**

Legg til i `lib/supabase/types.ts`:

```typescript
export interface PushSubscription {
  id: string
  user_id: string
  endpoint: string
  keys_p256dh: string
  keys_auth: string
  created_at: string
}
```

Legg til i Database.Tables:
```typescript
push_subscriptions: { Row: PushSubscription; Insert: Omit<PushSubscription, 'id' | 'created_at'>; Update: Partial<PushSubscription> }
```

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/types.ts
git commit -m "feat: PushSubscription type for web push"
```

---

## Task 3: Service Worker

**Files:**
- Create: `public/sw.js`

- [ ] **Step 1: Opprett public-mappe**

```bash
mkdir -p /Users/tormartin/dugnadshub/public
```

- [ ] **Step 2: Opprett service worker**

Opprett `public/sw.js`:

```javascript
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

  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Fokuser eksisterende vindu hvis mulig
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      // Ellers åpne nytt vindu
      return clients.openWindow(url)
    })
  )
})

// Aktiver umiddelbart
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})
```

- [ ] **Step 3: Commit**

```bash
git add public/sw.js
git commit -m "feat: service worker for push-varsler"
```

---

## Task 4: Klient-side push-logikk

**Files:**
- Create: `lib/push/client.ts`

- [ ] **Step 1: Opprett klient-modul**

Opprett `lib/push/client.ts`:

```typescript
// Registrer service worker og håndter push-subscription

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
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    })
    return subscription
  } catch {
    console.error('Push-subscription feilet')
    return null
  }
}

export async function saveSubscription(subscription: PushSubscription): Promise<boolean> {
  const keys = subscription.toJSON().keys!
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys_p256dh: keys.p256dh,
      keys_auth: keys.auth,
    }),
  })
  return res.ok
}

export async function unsubscribeFromPush(): Promise<boolean> {
  const registration = await navigator.serviceWorker?.ready
  if (!registration) return false

  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return true

  await subscription.unsubscribe()
  await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  })
  return true
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false
  const registration = await navigator.serviceWorker?.ready
  if (!registration) return false
  const subscription = await registration.pushManager.getSubscription()
  return subscription !== null
}

// Konverter VAPID-key fra base64 til Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/push/client.ts
git commit -m "feat: klient-side push subscription-logikk"
```

---

## Task 5: API-ruter for subscribe/unsubscribe

**Files:**
- Create: `app/api/push/subscribe/route.ts`
- Create: `app/api/push/vapid-key/route.ts`

- [ ] **Step 1: Opprett subscribe-rute**

Opprett `app/api/push/subscribe/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  // Hent bruker fra auth header (Supabase JWT)
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { endpoint, keys_p256dh, keys_auth } = await request.json()
  if (!endpoint || !keys_p256dh || !keys_auth) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: user.id,
    endpoint,
    keys_p256dh,
    keys_auth,
  }, { onConflict: 'user_id,endpoint' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { endpoint } = await request.json()
  await supabase.from('push_subscriptions').delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Oppdater klient-modul med auth**

Oppdater `saveSubscription` i `lib/push/client.ts` til å sende auth-token:

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add app/api/push/subscribe/route.ts lib/push/client.ts
git commit -m "feat: API-rute for push subscribe/unsubscribe"
```

---

## Task 6: API-rute for sending push

**Files:**
- Create: `app/api/push/send/route.ts`
- Create: `lib/push/server.ts`

- [ ] **Step 1: Opprett server-side send-logikk**

Opprett `lib/push/server.ts`:

```typescript
import { webpush } from './vapid'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface PushPayload {
  title: string
  body: string
  url?: string
}

interface SendFilter {
  userIds?: string[]       // Spesifikke brukere
  roles?: string[]         // Filtrer på rolle
  childGroups?: string[]   // Filtrer på barnegruppe
  all?: boolean            // Send til alle
}

// Hent subscriptions basert på filter
async function getSubscriptions(filter: SendFilter) {
  if (filter.userIds && filter.userIds.length > 0) {
    const { data } = await supabase
      .from('push_subscriptions')
      .select('endpoint, keys_p256dh, keys_auth')
      .in('user_id', filter.userIds)
    return data || []
  }

  // Hent brukere basert på rolle/gruppe-filter
  let profileQuery = supabase.from('profiles').select('id')

  if (filter.roles && filter.roles.length > 0) {
    profileQuery = profileQuery.in('role', filter.roles)
  }
  if (filter.childGroups && filter.childGroups.length > 0) {
    profileQuery = profileQuery.in('child_group', filter.childGroups)
  }

  const { data: profiles } = await profileQuery
  if (!profiles || profiles.length === 0) return []

  const userIds = profiles.map((p: { id: string }) => p.id)
  const { data } = await supabase
    .from('push_subscriptions')
    .select('endpoint, keys_p256dh, keys_auth')
    .in('user_id', userIds)

  return data || []
}

// Send push til filtrerte mottakere
export async function sendPush(payload: PushPayload, filter: SendFilter): Promise<{ sent: number; failed: number }> {
  const subscriptions = await getSubscriptions(filter)

  let sent = 0
  let failed = 0

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys_p256dh,
            auth: sub.keys_auth,
          },
        },
        JSON.stringify(payload)
      )
      sent++
    } catch (err: unknown) {
      failed++
      // Fjern ugyldige subscriptions (410 Gone = bruker har unsubscribet)
      const statusCode = (err as { statusCode?: number })?.statusCode
      if (statusCode === 410 || statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      }
    }
  }

  return { sent, failed }
}
```

- [ ] **Step 2: Opprett send API-rute**

Opprett `app/api/push/send/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPush } from '@/lib/push/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  // Verifiser at bruker er admin
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { title, body, url, filter } = await request.json()
  if (!title || !body) {
    return NextResponse.json({ error: 'title and body required' }, { status: 400 })
  }

  const result = await sendPush({ title, body, url }, filter || { all: true })
  return NextResponse.json(result)
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/push/server.ts app/api/push/send/route.ts
git commit -m "feat: server-side push sending med filtrering"
```

---

## Task 7: Service Worker-registrering i layout

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Legg til SW-registrering**

Legg til en `<script>`-tag i `<body>` i `app/layout.tsx` som registrerer service workeren:

```typescript
// I layout.tsx, legg til etter children i body:
<script
  dangerouslySetInnerHTML={{
    __html: `
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {})
      }
    `,
  }}
/>
```

- [ ] **Step 2: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: registrer service worker i layout"
```

---

## Task 8: PushPrompt-komponent

**Files:**
- Create: `components/features/PushPrompt.tsx`
- Modify: `app/(app)/hjem/page.tsx`

- [ ] **Step 1: Opprett PushPrompt**

Opprett `components/features/PushPrompt.tsx`:

```typescript
'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { subscribeToPush, saveSubscription, isPushSubscribed } from '@/lib/push/client'
import { Bell, X } from 'lucide-react'
import Button from '@/components/ui/Button'

// Viser en banner som spør om push-tillatelse
export default function PushPrompt() {
  const [show, setShow] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    // Sjekk om vi skal vise prompt
    async function check() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
      if (Notification.permission === 'denied') return
      if (await isPushSubscribed()) return
      // Ikke vis om brukeren har avvist tidligere (lagret i localStorage)
      if (localStorage.getItem('push_dismissed')) return
      setShow(true)
    }
    check()
  }, [])

  async function handleSubscribe() {
    setSubscribing(true)
    const registration = await navigator.serviceWorker.ready
    const subscription = await subscribeToPush(registration)
    if (subscription) {
      const { data: { session } } = await supabaseRef.current.auth.getSession()
      if (session) {
        await saveSubscription(subscription, session.access_token)
      }
    }
    setShow(false)
    setSubscribing(false)
  }

  function handleDismiss() {
    localStorage.setItem('push_dismissed', '1')
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="card p-4 mb-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
        <Bell size={20} className="text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">Vil du ha push-varsler?</p>
        <p className="text-xs text-text-secondary mt-0.5">
          Få beskjed om dugnader og nye merker
        </p>
        <div className="flex gap-2 mt-2">
          <Button size="sm" loading={subscribing} onClick={handleSubscribe}>
            Ja, aktiver
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDismiss}>
            Ikke nå
          </Button>
        </div>
      </div>
      <button onClick={handleDismiss} className="shrink-0">
        <X size={16} className="text-text-tertiary" />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Legg til PushPrompt på hjemskjermen**

I `app/(app)/hjem/page.tsx`, importer og vis PushPrompt øverst i innholdet (etter header, før hendelseskort):

```typescript
import PushPrompt from '@/components/features/PushPrompt'

// I JSX, etter velkomst-tekst:
<PushPrompt />
```

- [ ] **Step 3: Commit**

```bash
git add components/features/PushPrompt.tsx "app/(app)/hjem/page.tsx"
git commit -m "feat: PushPrompt-banner på hjemskjermen"
```

---

## Task 9: Push-toggle på profilsiden

**Files:**
- Modify: `app/(app)/profil/page.tsx`

- [ ] **Step 1: Legg til push-toggle**

I profilsiden, legg til en seksjon mellom admin-lenken og "Logg ut" som viser push-status og lar brukeren aktivere/deaktivere:

```typescript
// Ny state
const [pushEnabled, setPushEnabled] = useState(false)
const [pushLoading, setPushLoading] = useState(false)

// Sjekk push-status ved lasting
useEffect(() => {
  isPushSubscribed().then(setPushEnabled)
}, [])

// Toggle-funksjon
async function togglePush() {
  setPushLoading(true)
  if (pushEnabled) {
    const { data: { session } } = await supabase.auth.getSession()
    await unsubscribeFromPush(session?.access_token || '')
    setPushEnabled(false)
  } else {
    const registration = await navigator.serviceWorker?.ready
    if (registration) {
      const subscription = await subscribeToPush(registration)
      if (subscription) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          await saveSubscription(subscription, session.access_token)
          setPushEnabled(true)
        }
      }
    }
  }
  setPushLoading(false)
}
```

UI — en enkel kort med toggle:
```tsx
<Card className="p-4 mb-4 flex items-center justify-between">
  <div className="flex items-center gap-3">
    <Bell size={20} className="text-accent" />
    <div>
      <p className="font-medium text-sm">Push-varsler</p>
      <p className="text-xs text-text-secondary">
        {pushEnabled ? 'Aktivert' : 'Deaktivert'}
      </p>
    </div>
  </div>
  <button
    onClick={togglePush}
    disabled={pushLoading}
    className={`w-12 h-7 rounded-full transition-colors relative ${
      pushEnabled ? 'bg-accent' : 'bg-black/10'
    }`}
  >
    <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
      pushEnabled ? 'translate-x-5.5' : 'translate-x-0.5'
    }`} />
  </button>
</Card>
```

- [ ] **Step 2: Commit**

```bash
git add "app/(app)/profil/page.tsx"
git commit -m "feat: push-varsel toggle på profilsiden"
```

---

## Task 10: Admin varsler-side

**Files:**
- Create: `app/admin/varsler/page.tsx`
- Modify: `app/admin/oversikt/page.tsx`

- [ ] **Step 1: Opprett admin varsler-side**

Opprett `app/admin/varsler/page.tsx` med:
- Tekstfelt for tittel og melding
- Filtreringsvalg: Rolle (multi-select chips), Barnegruppe (multi-select chips), eller "Alle"
- "Send varsel" knapp
- Bekreftelsesdialog før sending
- Resultat-visning ("Sendt til X, feilet Y")

Filtreringsvalg:
- **Roller:** Admin, Samler, Sjåfør, Strapper (fra Role-type)
- **Barnegruppe:** Aspirant, Junior, Hovedkorps
- **Alle:** Override som sender til alle uansett

- [ ] **Step 2: Legg til i admin-navigasjon**

I `app/admin/oversikt/page.tsx`, legg til "Varsler" som tredje navigasjonskort etter Hendelser og Medlemmer:

```tsx
<Link href="/admin/varsler">
  <Card className="p-4 flex items-center gap-4">
    <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
      <Bell size={20} className="text-accent" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium">Varsler</p>
      <p className="text-sm text-text-secondary">Send push-meldinger</p>
    </div>
    <ChevronRight size={16} className="text-text-tertiary shrink-0" />
  </Card>
</Link>
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/varsler/page.tsx app/admin/oversikt/page.tsx
git commit -m "feat: admin-side for manuelle push-varsler"
```

---

## Task 11: "Send hjelp-varsel" på aktive hendelser

**Files:**
- Modify: `app/admin/hendelser/page.tsx`

- [ ] **Step 1: Legg til hjelp-varsel knapp**

I hendelseslisten, for aktive hendelser (`event.status === 'active'`), legg til en "Send hjelp-varsel" knapp som:

1. Henter ledige soner for hendelsen (zoneStats.available)
2. Forhåndsfyller melding: "Vi trenger hjelp! {X} soner mangler folk for {event.title}"
3. Viser en enkel modal med meldingen (redigerbar) og "Send" knapp
4. Sender push til alle med `{ all: true }` filter

- [ ] **Step 2: Commit**

```bash
git add app/admin/hendelser/page.tsx
git commit -m "feat: hjelp-varsel knapp på aktive hendelser"
```

---

## Task 12: Automatiske push-triggere

**Files:**
- Modify: `app/admin/hendelser/page.tsx` (ved aktivering)
- Modify: `app/admin/medlemmer/page.tsx` (ved badge-tildeling)

- [ ] **Step 1: Push ved hendelse-aktivering**

I `handleStatusChange()`, når `newStatus === 'active'`, send push til alle:

```typescript
if (newStatus === 'active') {
  const event = events.find(e => e.id === eventId)
  if (event) {
    const { data: { session } } = await supabaseRef.current.auth.getSession()
    if (session) {
      await fetch('/api/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: 'Dugnad er i gang!',
          body: `${event.title} er nå aktiv — ta en sone!`,
          url: '/kart',
          filter: { all: true },
        }),
      })
    }
  }
}
```

- [ ] **Step 2: Push ved badge-tildeling**

I admin/medlemmer, når en badge tildeles, send push til den spesifikke brukeren.

- [ ] **Step 3: Push ved sone ferdigplukket → sjåfører**

I `ZoneClaimSheet.tsx`, når en sone markeres som ferdig ("completed"), send push til sjåfører:

```typescript
await fetch('/api/push/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({
    title: 'Sone ferdigplukket!',
    body: `Sone ${zone.name} er klar for henting`,
    url: `/kart?sone=${zone.id}`,
    filter: { roles: ['driver'] },
  }),
})
```

- [ ] **Step 4: Commit**

```bash
git add app/admin/hendelser/page.tsx app/admin/medlemmer/page.tsx components/features/ZoneClaimSheet.tsx
git commit -m "feat: automatiske push-varsler ved aktivering, merker og ferdigplukking"
```

---

## Task 13: Test og deploy

- [ ] **Step 1: Lokal test**

```bash
npm run dev
```

Test flyten:
1. Åpne appen → PushPrompt vises på hjem
2. Klikk "Ja, aktiver" → nettleser spør om tillatelse
3. Sjekk Supabase: subscription lagret i `push_subscriptions`
4. Gå til admin/varsler → send test-varsel → sjekk at push mottas
5. Gå til profil → push-toggle viser "Aktivert"
6. Toggle av → subscription fjernet

- [ ] **Step 2: Legg til VAPID-keys i Vercel (hvis ikke gjort)**

```bash
npx vercel env add NEXT_PUBLIC_VAPID_PUBLIC_KEY production
npx vercel env add VAPID_PRIVATE_KEY production
```

- [ ] **Step 3: Deploy**

```bash
npx vercel --prod
```

- [ ] **Step 4: Test på mobil**

Test på ekte iPhone:
1. Åpne dugnadshub.vercel.app i Safari
2. "Add to Home Screen" (VIKTIG for iOS push)
3. Åpne fra hjemskjermen
4. Godta push-varsler
5. Send test-varsel fra admin
6. Sjekk at varsel mottas

---

## Oppsummering av varsler

| Trigger | Mottaker | Automatisk |
|---------|----------|------------|
| Hendelse aktivert | Alle | ✅ |
| Sone ferdigplukket | Sjåfører (`driver`) | ✅ |
| Badge tildelt | Brukeren | ✅ |
| Hjelp-varsel (ledige soner) | Alle | Manuell knapp |
| Fritekst fra admin | Filtrert på rolle/gruppe | Manuell |
