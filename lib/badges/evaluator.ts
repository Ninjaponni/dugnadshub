// Klient-side wrapper som kaller server-side badge-evaluering
// Server-ruten bruker service role key for å omgå RLS på user_badges
export async function evaluateBadges(userId: string) {
  try {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return []

    const res = await fetch('/api/badges/evaluate', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    })
    if (!res.ok) return []
    const { awarded } = await res.json()
    return awarded || []
  } catch {
    return []
  }
}
