import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: shiftId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })
  }

  const service = getServiceClient()

  const { data: shift, error: shiftErr } = await service
    .from('event_shifts')
    .select('id, capacity, event_id, events(signup_deadline)')
    .eq('id', shiftId)
    .single()

  if (shiftErr || !shift) {
    return NextResponse.json({ error: 'Vakt finnes ikke' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deadline = (shift.events as any)?.signup_deadline as string | null
  if (deadline && new Date(deadline) < new Date()) {
    return NextResponse.json({ error: 'Påmeldingsfrist passert' }, { status: 403 })
  }

  const { count } = await service
    .from('shift_claims')
    .select('id', { count: 'exact', head: true })
    .eq('shift_id', shiftId)

  if ((count ?? 0) >= shift.capacity) {
    return NextResponse.json({ error: 'Vakt er fullt' }, { status: 409 })
  }

  const { error: insertErr } = await service
    .from('shift_claims')
    .insert({ shift_id: shiftId, user_id: user.id })

  if (insertErr) {
    if (insertErr.code === '23505') {
      return NextResponse.json({ error: 'Du er allerede påmeldt' }, { status: 409 })
    }
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: shiftId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })
  }

  const service = getServiceClient()

  const { data: shift } = await service
    .from('event_shifts')
    .select('events(signup_deadline)')
    .eq('id', shiftId)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deadline = (shift?.events as any)?.signup_deadline as string | null
  if (deadline && new Date(deadline) < new Date()) {
    return NextResponse.json({ error: 'Påmeldingsfrist passert. Kontakt admin.' }, { status: 403 })
  }

  const { error: deleteErr } = await service
    .from('shift_claims')
    .delete()
    .eq('shift_id', shiftId)
    .eq('user_id', user.id)

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
