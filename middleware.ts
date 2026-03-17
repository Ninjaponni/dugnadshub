import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // Kjør middleware på alle ruter unntatt statiske filer og API
    '/((?!_next/static|_next/image|favicon.ico|icon-.*\\.png|manifest\\.json|sw\\.js|api/push/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
