import { createClient } from '@/lib/supabase/server'
import DesktopSidebar from './DesktopSidebar'
import DesktopTopbar from './DesktopTopbar'
import type { Profile, Role } from '@/lib/supabase/types'

type SidebarProfile = Pick<Profile, 'full_name' | 'role' | 'avatar_url'> & { type?: string }

// Wrapper som rendrer desktop-chrome på lg+ og passer mobilinnhold gjennom uendret.
// Henter profil server-side slik at sidebaren kan vise rolle og navn uten klienthenting.
export default async function DesktopShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fallback: 'host' er valgt fordi 'member' ikke finnes i Role-unionen
  // (Role = 'admin' | 'collector' | 'driver' | 'strapper' | 'host')
  const fallbackRole: Role = 'host'

  let profile: SidebarProfile = {
    full_name: 'Bruker',
    role: fallbackRole,
    avatar_url: null,
    type: 'Forelder',
  }

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
    }
  }

  return (
    <div className="lg:flex lg:min-h-screen lg:bg-bg">
      <DesktopSidebar profile={profile} />
      <div className="flex-1 lg:flex lg:flex-col lg:min-w-0">
        <DesktopTopbar />
        <main className="lg:max-w-[1320px] lg:w-full lg:mx-auto lg:px-9 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
