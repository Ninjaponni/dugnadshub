import type { SupabaseClient } from '@supabase/supabase-js'

// Supabase/PostgREST har server-side hard cap på 1000 rader per request
// (kjent felle — .range(0, 9999) hjelper IKKE). Denne henter alt i
// 1000-bolker til tabellen er tom. Bruk for tabeller som kan vokse
// forbi 1000 rader (claims, assignments, profiles, badges).
export async function fetchAll<T>(
  supabase: SupabaseClient,
  table: string,
  select: string,
): Promise<T[]> {
  const PAGE = 1000
  const out: T[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data } = await supabase
      .from(table)
      .select(select)
      .range(offset, offset + PAGE - 1) as unknown as { data: T[] | null }
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < PAGE) break
  }
  return out
}
