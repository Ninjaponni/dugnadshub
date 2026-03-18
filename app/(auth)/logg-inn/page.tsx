'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import OtpInput from '@/components/ui/OtpInput'
import { motion } from 'framer-motion'
import { Mail, Lock } from 'lucide-react'

type View = 'email' | 'otp' | 'password'

// Innlogging — OTP-kode + passord (fallback)
export default function LoginPage() {
  const [view, setView] = useState<View>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [otpError, setOtpError] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const router = useRouter()

  // Nedtelling for "Send ny kode"
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  // Send OTP-kode til e-post
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({ email })

    if (error) {
      setError('Kunne ikke sende kode. Prøv igjen.')
    } else {
      setView('otp')
      setCooldown(60)
    }
    setLoading(false)
  }

  // Send kode på nytt
  async function handleResend() {
    if (cooldown > 0) return
    setError('')
    setOtpError(false)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({ email })

    if (error) {
      setError('Kunne ikke sende ny kode. Prøv igjen.')
    } else {
      setCooldown(60)
    }
  }

  // Verifiser OTP-kode
  const handleVerifyOtp = useCallback(async (code: string) => {
    setLoading(true)
    setError('')
    setOtpError(false)

    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    })

    if (error) {
      setOtpError(true)
      setError('Feil eller utløpt kode. Prøv igjen.')
    } else {
      router.replace('/hjem')
    }
    setLoading(false)
  }, [email, router])

  // Passord-login
  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError('Feil e-post eller passord.')
    } else {
      router.replace('/hjem')
    }
    setLoading(false)
  }

  const inputClass = `w-full pl-10 pr-4 py-3 rounded-xl bg-bg border-0 text-[17px]
    placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/30`

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

        {view === 'otp' ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card p-6 text-center"
          >
            <h2 className="text-xl font-semibold mb-2">Skriv inn koden</h2>
            <p className="text-text-secondary text-[15px] mb-6">
              Vi sendte en kode til<br />
              <span className="font-medium text-text-primary">{email}</span>
            </p>

            <OtpInput
              onComplete={handleVerifyOtp}
              disabled={loading}
              error={otpError}
            />

            {error && (
              <p className="text-danger text-sm mt-4">{error}</p>
            )}

            <div className="mt-6 space-y-2">
              <button
                onClick={handleResend}
                disabled={cooldown > 0}
                className="text-accent text-sm disabled:opacity-40"
              >
                {cooldown > 0 ? `Send ny kode (${cooldown}s)` : 'Send ny kode'}
              </button>
              <br />
              <button
                onClick={() => { setView('email'); setError(''); setOtpError(false) }}
                className="text-text-tertiary text-sm"
              >
                Bruk en annen e-post
              </button>
            </div>
          </motion.div>
        ) : view === 'password' ? (
          <form onSubmit={handlePasswordLogin} className="card p-6">
            <label className="block mb-3">
              <span className="text-sm font-medium text-text-secondary mb-1.5 block">E-postadresse</span>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="forelder@eksempel.no" required autoFocus className={inputClass} />
              </div>
            </label>
            <label className="block mb-4">
              <span className="text-sm font-medium text-text-secondary mb-1.5 block">Passord</span>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" required className={inputClass} />
              </div>
            </label>

            {error && <p className="text-danger text-sm mb-3">{error}</p>}

            <Button type="submit" size="lg" loading={loading} className="w-full">
              Logg inn
            </Button>

            <button type="button" onClick={() => { setView('email'); setError('') }}
              className="text-accent text-sm mt-4 w-full text-center">
              Bruk kode i stedet
            </button>
          </form>
        ) : (
          <form onSubmit={handleSendOtp} className="card p-6">
            <label className="block mb-4">
              <span className="text-sm font-medium text-text-secondary mb-1.5 block">E-postadresse</span>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="forelder@eksempel.no" required autoFocus className={inputClass} />
              </div>
            </label>

            {error && <p className="text-danger text-sm mb-3">{error}</p>}

            <Button type="submit" size="lg" loading={loading} className="w-full">
              Send kode
            </Button>

            <button type="button" onClick={() => { setView('password'); setError('') }}
              className="text-accent text-sm mt-4 w-full text-center">
              Logg inn med passord
            </button>
          </form>
        )}
      </motion.div>
    </div>
  )
}
