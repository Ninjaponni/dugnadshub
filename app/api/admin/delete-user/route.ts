export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Slett auth-bruker — kun admin
function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Sjekk admin-rolle
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { user_id } = await request.json()
  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  // Ikke la admin slette seg selv
  if (user_id === user.id) {
    return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })
  }

  // Rydd ALLE relaterte rader først, så ingenting blir liggende foreldreløst
  // ("Anonym" i vaktlister og sjåføroversikter). Service role omgår RLS.
  // event_musicians.profile_id peker på forelderen — også den må ryddes.
  const cleanups: Array<[string, string]> = [
    ['user_badges', 'user_id'],
    ['zone_claims', 'user_id'],
    ['shift_claims', 'user_id'],
    ['driver_assignments', 'user_id'],
    ['push_subscriptions', 'user_id'],
    ['event_musicians', 'profile_id'],
  ]
  const failed: string[] = []
  await Promise.all(cleanups.map(async ([table, col]) => {
    const { error } = await supabase.from(table).delete().eq(col, user_id)
    if (error) failed.push(`${table}: ${error.message}`)
  }))
  if (failed.length > 0) {
    // Ikke slett brukeren hvis oppryddingen feilet — da mister vi sporbarheten
    return NextResponse.json({ error: `Opprydding feilet: ${failed.join('; ')}` }, { status: 500 })
  }

  // Slett auth-bruker via admin API — profilen følger med (FK on delete cascade)
  const { error } = await supabase.auth.admin.deleteUser(user_id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
