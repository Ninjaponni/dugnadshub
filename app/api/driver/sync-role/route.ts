export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Synker profiles.role basert på aktive driver_assignments.
// Uten body: synker kallerens egen role (trengs fordi RLS hindrer egen-endring).
// Med { userId }: krever at kalleren er admin, synker den brukerens role.
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.slice(7)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const body = await request.json().catch(() => null) as { userId?: string } | null
  let targetId = user.id

  if (body?.userId && body.userId !== user.id) {
    const { data: caller } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if ((caller as { role: string } | null)?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    targetId = body.userId
  }

  const newRole = await syncRoleForUser(supabase, targetId)
  return NextResponse.json({ role: newRole })
}

// Eksportert slik at completion-endepunktet kan gjenbruke den
export async function syncRoleForUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<string | null> {
  // Aldri tilbakestill admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  const currentRole = (profile as { role: string } | null)?.role
  if (!currentRole || currentRole === 'admin') return currentRole ?? null

  // Finn aktive driver_assignments (hendelser som ikke er fullført)
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
