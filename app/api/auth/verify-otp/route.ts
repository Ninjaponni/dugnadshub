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

// Verifiser OTP-kode og opprett Supabase-sesjon
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

  // Finn eller opprett bruker i Supabase Auth
  const emailLower = email.toLowerCase()

  // Sjekk om bruker finnes
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const existingUser = users.find(u => u.email?.toLowerCase() === emailLower)

  let userId: string

  if (existingUser) {
    userId = existingUser.id
  } else {
    // Opprett ny bruker med tilfeldig passord
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: emailLower,
      email_confirm: true,
    })
    if (createError || !newUser.user) {
      return NextResponse.json({ error: 'Kunne ikke opprette bruker' }, { status: 500 })
    }
    userId = newUser.user.id
  }

  // Generer en magic link som brukeren kan bruke for å opprette sesjon
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: emailLower,
  })

  if (linkError || !linkData) {
    return NextResponse.json({ error: 'Kunne ikke opprette sesjon' }, { status: 500 })
  }

  // Returner token-hash og type slik at klienten kan verifisere
  const url = new URL(linkData.properties.action_link)
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')

  return NextResponse.json({ token_hash: tokenHash, type })
}
