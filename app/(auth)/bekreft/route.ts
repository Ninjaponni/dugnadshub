import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Auth callback — bytter kode mot sesjon (PKCE-flyt)
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  // Hvis feil (f.eks. utløpt lenke), redirect til login med melding
  if (error) {
    return NextResponse.redirect(`${origin}/logg-inn?error=${error}`)
  }

  if (code) {
    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (!exchangeError) {
      return NextResponse.redirect(`${origin}/hjem`)
    }
  }

  // Fallback — noe gikk galt
  return NextResponse.redirect(`${origin}/logg-inn?error=auth_failed`)
}
