import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

// Lazy init — env vars ikke tilgjengelig ved build-time
function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Generer 6-sifret kode
function generateCode(): string {
  const code = Math.floor(100000 + Math.random() * 900000)
  return code.toString()
}

// Send OTP-kode til e-post via Resend
export async function POST(request: NextRequest) {
  const { email } = await request.json()
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'E-post mangler' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Marker gamle koder som brukt
  await supabase
    .from('otp_codes')
    .update({ used: true })
    .eq('email', email.toLowerCase())
    .eq('used', false)

  // Lag ny kode (gyldig i 10 min)
  const code = generateCode()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const { error: insertError } = await supabase
    .from('otp_codes')
    .insert({ email: email.toLowerCase(), code, expires_at: expiresAt })

  if (insertError) {
    return NextResponse.json({ error: 'Kunne ikke opprette kode' }, { status: 500 })
  }

  // Send e-post via Resend
  const resend = getResend()
  const { error: emailError } = await resend.emails.send({
    from: 'Dugnadshub <noreply@dugnadshub.no>',
    to: email,
    subject: `Din innloggingskode: ${code}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 400px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="margin: 0 0 8px; font-size: 20px;">Din innloggingskode</h2>
        <p style="color: #666; margin: 0 0 24px; font-size: 15px;">Bruk denne koden for å logge inn i Dugnadshub:</p>
        <p style="font-size: 36px; letter-spacing: 6px; font-weight: bold; text-align: center; margin: 0 0 24px; color: #111;">
          ${code}
        </p>
        <p style="color: #999; font-size: 13px; margin: 0;">Koden er gyldig i 10 minutter.</p>
      </div>
    `,
  })

  if (emailError) {
    return NextResponse.json({ error: 'Kunne ikke sende e-post' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
