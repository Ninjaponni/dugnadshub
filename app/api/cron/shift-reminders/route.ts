import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendPush } from '@/lib/push/server'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  // Beskytt med CRON_SECRET (Vercel injiserer automatisk via Authorization-header)
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Finn alle vakter som starter i morgen (basert på server-tid)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const { data: shifts, error } = await service
    .from('event_shifts')
    .select(`
      id, role, shift_date, start_time, event_id,
      events!inner(title),
      shift_claims(user_id)
    `)
    .eq('shift_date', tomorrowStr)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let totalSent = 0
  let totalFailed = 0

  for (const shift of shifts ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const title = (shift.events as any)?.title ?? 'Arrangement'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const claims = (shift.shift_claims as any[]) ?? []
    const userIds = claims.map((c) => c.user_id).filter(Boolean)
    if (userIds.length === 0) continue

    const result = await sendPush(
      {
        title: `Påminnelse: ${title}`,
        body: `Din vakt (${shift.role}) er i morgen kl ${String(shift.start_time).slice(0, 5)}.`,
        url: `/arrangement/${shift.event_id}`,
      },
      { userIds }
    )
    totalSent += result.sent
    totalFailed += result.failed
  }

  return NextResponse.json({ ok: true, sent: totalSent, failed: totalFailed, date: tomorrowStr })
}
