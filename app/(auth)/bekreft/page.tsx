'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Auth callback — håndterer magic link redirect
export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    // Supabase håndterer token fra URL automatisk
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        router.replace('/hjem')
      }
    })
  }, [router])

  return (
    <div className="min-h-dvh flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-2 border-accent border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-text-secondary">Logger inn...</p>
      </div>
    </div>
  )
}
