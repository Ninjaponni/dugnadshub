import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Oppdaterer auth-session og beskytter ruter
export async function updateSession(request: NextRequest) {
  // Mock-modus: bypass auth helt
  if (process.env.NEXT_PUBLIC_MOCK_MODE === 'true') {
    return NextResponse.next({ request })
  }
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Beskytt app-ruter — redirect til login hvis ikke innlogget
  const isAppRoute = request.nextUrl.pathname.startsWith('/hjem') ||
    request.nextUrl.pathname.startsWith('/kart') ||
    request.nextUrl.pathname.startsWith('/merker') ||
    request.nextUrl.pathname.startsWith('/profil') ||
    request.nextUrl.pathname.startsWith('/admin') ||
    request.nextUrl.pathname.startsWith('/sjafor')

  if (!user && isAppRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/logg-inn'
    return NextResponse.redirect(url)
  }

  // Beskytt rollebaserte ruter
  if (user && (request.nextUrl.pathname.startsWith('/admin') || request.nextUrl.pathname.startsWith('/sjafor'))) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role

    // Admin-ruter — kun admin
    if (request.nextUrl.pathname.startsWith('/admin') && role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/hjem'
      return NextResponse.redirect(url)
    }

    // Sjåfør-ruter — driver eller admin
    if (request.nextUrl.pathname.startsWith('/sjafor') && role !== 'driver' && role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/hjem'
      return NextResponse.redirect(url)
    }
  }

  // Redirect innloggede brukere bort fra login
  if (user && request.nextUrl.pathname === '/logg-inn') {
    const url = request.nextUrl.clone()
    url.pathname = '/hjem'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
