import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Landing — redirect til hjem (innlogget) eller login
export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/hjem')
  } else {
    redirect('/logg-inn')
  }
}
