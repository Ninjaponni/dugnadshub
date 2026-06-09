import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Foreløpig redirect til hjem-siden (eller siste aktive arrangement) inntil
// Fase 3 bygger en ekte oversikt over alle arrangementer med vakter.
export default async function VakterIndexPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('events')
    .select('id, date, status')
    .eq('type', 'arrangement')
    .in('status', ['active', 'upcoming'])
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(1)

  const next = (data as Array<{ id: string }> | null)?.[0]
  if (next) redirect(`/arrangement/${next.id}`)
  redirect('/hjem')
}
