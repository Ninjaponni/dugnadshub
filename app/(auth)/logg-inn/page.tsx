'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import OtpInput from '@/components/ui/OtpInput'
import { motion } from 'framer-motion'
import { Mail } from 'lucide-react'
import Image from 'next/image'
import KorpsLogo from '@/components/ui/KorpsLogo'

// Innlogging — OTP via Resend, varm gradient-bakgrunn
export default function LoginPage() {
  const [view, setView] = useState<'email' | 'otp'>('email')
  const [email, setEmail] = useState('')
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

  // Send OTP-kode via egen API-rute (Resend)
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    if (!res.ok) {
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

    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    if (!res.ok) {
      setError('Kunne ikke sende ny kode. Prøv igjen.')
    } else {
      setCooldown(60)
    }
  }

  // Verifiser OTP-kode via egen API, deretter opprett sesjon
  const handleVerifyOtp = useCallback(async (code: string) => {
    setLoading(true)
    setError('')
    setOtpError(false)

    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    })

    if (!res.ok) {
      setOtpError(true)
      setError('Feil eller utløpt kode. Prøv igjen.')
      setLoading(false)
      return
    }

    // Sett sesjon med tokens fra serveren
    const { access_token, refresh_token } = await res.json()
    const supabase = createClient()
    const { error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    })

    if (sessionError) {
      setOtpError(true)
      setError('Kunne ikke logge inn. Prøv igjen.')
    } else {
      router.replace('/hjem')
    }
    setLoading(false)
  }, [email, router])

  const inputClass = `w-full pl-10 pr-4 py-3 rounded-[12px] bg-surface-low border-0 text-[17px]
    placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-white/30`

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: '#c4724a' }}
    >
      {/* Topp — logo + illustrasjon + tittel */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        className="flex flex-col items-center justify-center pt-16"
      >
        <KorpsLogo size={80} className="mb-6 !fill-white" />
        <Image
          src="/korps.svg"
          alt="Tillerbyen Skolekorps"
          width={240}
          height={120}
          className="mb-6"
          priority
        />
        <h1 className="text-[36px] font-extrabold tracking-tight text-white font-[var(--font-display)]">
          Dugnadshub
        </h1>
        <p className="text-white/70 mt-1 text-[17px]">
          Tillerbyen Skolekorps
        </p>
      </motion.div>

      {/* Bunn — innlogging */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 25, delay: 0.15 }}
        className="w-full max-w-sm mt-8"
      >

        {view === 'otp' ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card p-6 text-center"
          >
            <h2 className="text-xl font-semibold mb-2 font-[var(--font-display)]">Skriv inn koden</h2>
            <p className="text-text-secondary text-[15px] mb-6">
              Vi sendte en 6-sifret kode til<br />
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
                className="text-text-secondary text-sm"
              >
                Bruk en annen e-post
              </button>
            </div>
          </motion.div>
        ) : (
          <form onSubmit={handleSendOtp} className="card p-6">
            <label className="block mb-4">
              <span className="text-[11px] font-bold uppercase tracking-widest text-text-secondary mb-1.5 block">E-postadresse</span>
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
          </form>
        )}
      </motion.div>
    </div>
  )
}
