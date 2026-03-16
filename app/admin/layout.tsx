import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/supabase/types'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

// Admin layout — kun tilgjengelig for admins
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
    <div className="max-w-4xl mx-auto min-h-dvh px-4 pt-14 pb-8 safe-top">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/hjem" className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center">
          <ArrowLeft size={18} className="text-text-secondary" />
        </Link>
        <h1 className="text-[28px] font-bold">Administrasjon</h1>
      </div>
      {children}
    </div>
  )
}
