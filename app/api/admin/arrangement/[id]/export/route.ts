import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as { role: string } | null)?.role !== 'admin') return new Response('Forbidden', { status: 403 })

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: event } = await service.from('events').select('title').eq('id', eventId).single()
  if (!(event as { title: string } | null)?.title) return new Response('Not found', { status: 404 })

  const { data: shifts } = await service
    .from('event_shifts')
    .select(`
      shift_date, start_time, end_time, role, capacity,
      claims:shift_claims(profile:profiles(full_name, phone))
    `)
    .eq('event_id', eventId)
    .order('shift_date')
    .order('start_time')

  const rows: string[] = ['Dato,Tidspunkt,Rolle,Antall plasser,Navn,Telefon']
  for (const s of shifts ?? []) {
    const date = new Date(s.shift_date).toLocaleDateString('nb-NO')
    const time = `${s.start_time.slice(0,5)}-${s.end_time.slice(0,5)}`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const claims = (s.claims as any[]) ?? []
    if (claims.length === 0) {
      rows.push(`${date},${time},${csvEscape(s.role)},${s.capacity},,`)
    } else {
      for (const c of claims) {
        rows.push(`${date},${time},${csvEscape(s.role)},${s.capacity},${csvEscape(c.profile?.full_name ?? '')},${csvEscape(c.profile?.phone ?? '')}`)
      }
    }
  }

  const csv = '﻿' + rows.join('\n')
  const filename = `vaktliste-${(event as { title: string }).title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

function csvEscape(s: string): string {
  if (!s) return ''
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}
