import { createClient } from '@/lib/supabase/server'

// Henter kommende arrangement-events til sidebar-undermenyen (Vakter).
// Server-side: kjøres i DesktopShell og sendes ned som prop.
export type ShiftNavEvent = {
  id: string
  title: string
  navLabel: string
  closed: boolean
}

export async function getShiftEventsForNav(): Promise<ShiftNavEvent[]> {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('events')
    .select('id, title, signup_deadline')
    .eq('type', 'arrangement')
    .in('status', ['active', 'upcoming'])
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(8)

  if (!data) return []
  return (data as Array<{ id: string; title: string; signup_deadline: string | null }>).map(e => ({
    id: e.id,
    title: e.title,
    navLabel: shortLabel(e.title),
    closed: e.signup_deadline ? new Date(e.signup_deadline) < new Date() : false,
  }))
}

// Kortform for trang sidebar-bredde — første ord hvis tittelen er lang.
function shortLabel(title: string): string {
  if (title.length <= 14) return title
  const firstWord = title.split(' ')[0]
  return firstWord.length <= 14 ? firstWord : title.slice(0, 12) + '…'
}
