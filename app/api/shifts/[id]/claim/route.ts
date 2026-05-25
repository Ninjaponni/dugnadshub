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

  // Atomisk: validerer deadline, kapasitet OG insert i samme transaksjon (med FOR UPDATE-lås).
  // Hindrer race condition der to brukere kan ta siste plass samtidig.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: rpcErr } = await (service.rpc as any)('claim_shift_atomic', {
    p_shift_id: shiftId,
    p_user_id: user.id,
  })

  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = data as { ok: boolean; error?: string; code?: string } | null
  if (!result?.ok) {
    const status =
      result?.code === 'not_found' ? 404 :
      result?.code === 'deadline_passed' ? 403 :
      result?.code === 'full' || result?.code === 'duplicate' ? 409 :
      500
    return NextResponse.json({ error: result?.error ?? 'Ukjent feil' }, { status })
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
