'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import { motion } from 'framer-motion'
import { Mail, CheckCircle } from 'lucide-react'

// Magic link innlogging — ingen passord
export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/bekreft`,
      },
    })

    if (error) {
      setError('Kunne ikke sende innloggingslenke. Prøv igjen.')
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        className="w-full max-w-sm"
      >
        {/* Logo/tittel */}
        <div className="text-center mb-10">
          <h1 className="text-[34px] font-bold tracking-tight">Dugnadshub</h1>
          <p className="text-text-secondary mt-2 text-[17px]">
            Tillerbyen Skolekorps
          </p>
        </div>

        {sent ? (
          // Bekreftelse
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card p-6 text-center"
          >
            <CheckCircle size={48} className="text-success mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Sjekk e-posten din</h2>
            <p className="text-text-secondary text-[15px]">
              Vi har sendt en innloggingslenke til<br />
              <span className="font-medium text-text-primary">{email}</span>
            </p>
            <button
              onClick={() => setSent(false)}
              className="text-accent text-sm mt-4"
            >
              Bruk en annen e-post
            </button>
          </motion.div>
        ) : (
          // Skjema
          <form onSubmit={handleLogin} className="card p-6">
            <label className="block mb-4">
              <span className="text-sm font-medium text-text-secondary mb-1.5 block">
                E-postadresse
              </span>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="forelder@eksempel.no"
                  required
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-bg border-0 text-[17px]
                    placeholder:text-text-tertiary
                    focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
            </label>

            {error && (
              <p className="text-danger text-sm mb-3">{error}</p>
            )}

            <Button type="submit" size="lg" loading={loading} className="w-full">
              Send innloggingslenke
            </Button>
          </form>
        )}
      </motion.div>
    </div>
  )
}
