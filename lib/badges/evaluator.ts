// Klient-side wrapper som kaller server-side badge-evaluering
// Server-ruten bruker service role key for å omgå RLS på user_badges
// Kaster ved feil — kall-stedene må håndtere det synlig i UI
export async function evaluateBadges(userId: string): Promise<number[]> {
  const { createClient } = await import('@/lib/supabase/client')
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Ikke innlogget')

  const res = await fetch('/api/badges/evaluate', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${session.access_token}` },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Badge-evaluering feilet (${res.status})`)
  }
  const { awarded } = await res.json()
  return awarded || []
}
