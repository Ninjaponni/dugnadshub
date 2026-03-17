export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPush } from '@/lib/push/server'

// Lazy Supabase-init
function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Auto-push til sjåfører når en sone er ferdigplukket
// Krever innlogget bruker (ikke admin)
export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { zoneName } = await request.json()
  if (!zoneName) {
    return NextResponse.json({ error: 'zoneName required' }, { status: 400 })
  }

  const result = await sendPush(
    {
      title: 'Sone klar for henting!',
      body: `${zoneName} er ferdigplukket og venter på henting.`,
      url: '/sjafor',
    },
    { roles: ['driver', 'admin'] }
  )

  return NextResponse.json(result)
}
