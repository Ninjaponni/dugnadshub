import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/supabase/types'
import DesktopShell from '@/components/layout/DesktopShell'

// Admin-layout: krever admin-rolle. Mobile beholder dagens kompakte top-padding,
// desktop bruker samme sidebar + topbar som medlems-sidene (lg+).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/logg-inn')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const p = profile as unknown as Pick<Profile, 'role'> | null
  if (!p || p.role !== 'admin') redirect('/hjem')

  return (
    <DesktopShell mobileMainClassName="max-w-4xl mx-auto min-h-dvh px-4 pt-14 pb-8 safe-top">
      {children}
    </DesktopShell>
  )
}
