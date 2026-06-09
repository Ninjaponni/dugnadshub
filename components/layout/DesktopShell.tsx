import { createClient } from '@/lib/supabase/server'
import DesktopSidebar from './DesktopSidebar'
import DesktopTopbar from './DesktopTopbar'
import type { Profile, Role } from '@/lib/supabase/types'

type SidebarProfile = Pick<Profile, 'full_name' | 'role' | 'avatar_url'> & { type?: string }

// Wrapper som rendrer desktop-chrome på lg+. Selve `hidden lg:flex` ligger på
// rotnoden her, slik at vi unngår en ekstra block-wrapper i layout-filene som
// kan forstyrre sticky-posisjonering av sidebaren.
// Henter profil server-side slik at sidebaren kan vise rolle og navn uten klienthenting.
export default async function DesktopShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fallback til 'collector' (Samler) — den vanlige medlemsrollen i Role-unionen
  // (Role = 'admin' | 'collector' | 'driver' | 'strapper' | 'host'). Brukes kun hvis vi
  // mangler profilrad, hvilket er svært sjeldent siden (app)/* krever innlogging.
  const fallbackRole: Role = 'collector'

  let profile: SidebarProfile = {
    full_name: 'Bruker',
    role: fallbackRole,
    avatar_url: null,
    type: 'Forelder',
  }

  let memberCount: number | undefined
  let isAdmin = false

  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, role, avatar_url, is_musician')
      .eq('id', user.id)
      .single()
    if (data) {
      const d = data as unknown as {
        full_name: string | null
        role: Role
        avatar_url: string | null
        is_musician: boolean
      }
      profile = {
        full_name: d.full_name,
        role: d.role,
        avatar_url: d.avatar_url,
        type: d.is_musician ? 'Musikant' : 'Forelder',
      }
      isAdmin = d.role === 'admin'
    }
  }

  // Antall medlemmer i sidebaren — kun for admin (count vises bare i ADMIN-gruppen)
  if (isAdmin) {
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
    memberCount = count ?? undefined
  }

  return (
    <div className="hidden lg:flex lg:min-h-screen lg:bg-bg">
      <DesktopSidebar profile={profile} memberCount={memberCount} />
      <div className="flex-1 flex flex-col min-w-0">
        <DesktopTopbar />
        <main className="max-w-[1320px] w-full mx-auto px-9 py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
