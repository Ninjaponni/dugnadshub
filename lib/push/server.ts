import { webpush, ensureVapid } from './vapid'
import { createClient } from '@supabase/supabase-js'

// Lazy Supabase-init — env vars er ikke tilgjengelige ved build-time
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface PushPayload {
  title: string
  body: string
  url?: string
}

interface SendFilter {
  userIds?: string[]
  roles?: string[]
  childGroups?: string[]
  all?: boolean
}

// Hent subscriptions basert pa filter
async function getSubscriptions(filter: SendFilter) {
  // Spesifikke brukere (f.eks. badge-tildeling)
  if (filter.userIds && filter.userIds.length > 0) {
    const { data } = await getSupabase()
      .from('push_subscriptions')
      .select('endpoint, keys_p256dh, keys_auth')
      .in('user_id', filter.userIds)
    return data || []
  }

  // Alle — hent alle subscriptions direkte
  if (filter.all && !filter.roles?.length && !filter.childGroups?.length) {
    const { data } = await getSupabase()
      .from('push_subscriptions')
      .select('endpoint, keys_p256dh, keys_auth')
    return data || []
  }

  // Filtrer pa rolle og/eller barnegruppe
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let profileQuery: any = getSupabase().from('profiles').select('id')

  if (filter.roles && filter.roles.length > 0) {
    profileQuery = profileQuery.in('role', filter.roles)
  }
  if (filter.childGroups && filter.childGroups.length > 0) {
    // children er JSONB-array med {name, group} — filtrer med or() + contains()
    const orClauses = filter.childGroups.map(g => `children.cs.[{"group":"${g}"}]`).join(',')
    profileQuery = profileQuery.or(orClauses)
  }

  const { data: profiles } = await profileQuery
  if (!profiles || profiles.length === 0) return []

  const userIds = profiles.map((p: { id: string }) => p.id)
  const { data } = await getSupabase()
    .from('push_subscriptions')
    .select('endpoint, keys_p256dh, keys_auth')
    .in('user_id', userIds)

  return data || []
}

// Send push til filtrerte mottakere
export async function sendPush(payload: PushPayload, filter: SendFilter): Promise<{ sent: number; failed: number }> {
  ensureVapid()
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
        await getSupabase().from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      }
    }
  }

  return { sent, failed }
}
