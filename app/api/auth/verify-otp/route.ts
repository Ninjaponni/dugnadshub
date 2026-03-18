import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// Verifiser OTP-kode og returner sesjon-tokens
export async function POST(request: NextRequest) {
  const { email, code } = await request.json()
  if (!email || !code) {
    return NextResponse.json({ error: 'E-post og kode er påkrevd' }, { status: 400 })
  }

  const supabase = getSupabase()
  const now = new Date().toISOString()

  // Finn gyldig kode
  const { data: otpRow } = await supabase
    .from('otp_codes')
    .select('id')
    .eq('email', email.toLowerCase())
    .eq('code', code)
    .eq('used', false)
    .gte('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!otpRow) {
    return NextResponse.json({ error: 'Feil eller utløpt kode' }, { status: 401 })
  }

  // Marker som brukt
  await supabase
    .from('otp_codes')
    .update({ used: true })
    .eq('id', otpRow.id)

  const emailLower = email.toLowerCase()

  // Finn eller opprett bruker
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const existingUser = users.find(u => u.email?.toLowerCase() === emailLower)

  if (!existingUser) {
    const { error: createError } = await supabase.auth.admin.createUser({
      email: emailLower,
      email_confirm: true,
    })
    if (createError) {
      return NextResponse.json({ error: 'Kunne ikke opprette bruker' }, { status: 500 })
    }
  }

  // Generer magic link og hent token-hash
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: emailLower,
  })

  if (linkError || !linkData) {
    return NextResponse.json({ error: 'Kunne ikke opprette sesjon' }, { status: 500 })
  }

  // Bytt token_hash mot en ekte sesjon via Supabase auth endpoint
  const verifyRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
      body: JSON.stringify({
        token_hash: linkData.properties.hashed_token,
        type: 'magiclink',
      }),
    },
  )

  if (!verifyRes.ok) {
    return NextResponse.json({ error: 'Kunne ikke verifisere sesjon' }, { status: 500 })
  }

  const session = await verifyRes.json()

  return NextResponse.json({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })
}
