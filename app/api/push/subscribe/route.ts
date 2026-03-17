export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Subscribe/unsubscribe fra push-varsler
function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await getSupabase().auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Auth failed', detail: authError?.message }, { status: 401 })
    }

    const body = await request.json()
    const { endpoint, keys_p256dh, keys_auth } = body
    if (!endpoint || !keys_p256dh || !keys_auth) {
      return NextResponse.json({ error: 'Missing fields', received: Object.keys(body) }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (getSupabase().from('push_subscriptions') as any).upsert({
      user_id: user.id,
      endpoint,
      keys_p256dh,
      keys_auth,
    }, { onConflict: 'user_id,endpoint' })

    if (error) {
      return NextResponse.json({ error: 'DB error', detail: error.message, code: error.code }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Unexpected error', detail: String(err) }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await getSupabase().auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { endpoint } = await request.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (getSupabase().from('push_subscriptions') as any).delete()
      .eq('user_id', user.id)
      .eq('endpoint', endpoint)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Unexpected error', detail: String(err) }, { status: 500 })
  }
}
