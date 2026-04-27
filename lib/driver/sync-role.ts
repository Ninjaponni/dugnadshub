// Synker en brukers profiles.role basert på deres aktive driver_assignments.
// Aldri tilbakestilt admin. Brukes både fra /api/driver/sync-role (klient-flyt)
// og /api/events/finalize-drivers (admin-flyt).
export async function syncRoleForUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<string | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  const currentRole = (profile as { role: string } | null)?.role
  if (!currentRole || currentRole === 'admin') return currentRole ?? null

  const { data: assignments } = await supabase
    .from('driver_assignments')
    .select('role, events!inner(status)')
    .eq('user_id', userId)
    .neq('events.status', 'completed')

  const active = (assignments || []) as Array<{ role: string; events: { status: string } }>

  let nextRole: string
  if (active.some(a => a.role === 'driver')) {
    nextRole = 'driver'
  } else if (active.some(a => a.role === 'strapper')) {
    nextRole = 'strapper'
  } else {
    nextRole = 'collector'
  }

  if (nextRole === currentRole) return currentRole

  await supabase.from('profiles').update({ role: nextRole }).eq('id', userId)
  return nextRole
}
