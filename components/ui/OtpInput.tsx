'use client'

import { useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'

interface OtpInputProps {
  onComplete: (code: string) => void
  disabled?: boolean
  error?: boolean
}

// 6-sifret OTP-kode med auto-advance, backspace og paste-støtte
export default function OtpInput({ onComplete, disabled, error }: OtpInputProps) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const handleChange = useCallback((index: number, value: string) => {
    // Paste: fordel sifre over alle felt
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, '').slice(0, 6).split('')
      const next = [...digits]
      pasted.forEach((d, i) => {
        if (index + i < 6) next[index + i] = d
      })
      setDigits(next)
      const code = next.join('')
      if (code.length === 6) {
        refs.current[5]?.blur()
        onComplete(code)
      } else {
        refs.current[Math.min(index + pasted.length, 5)]?.focus()
      }
      return
    }

    const digit = value.replace(/\D/g, '')
    const next = [...digits]
    next[index] = digit
    setDigits(next)

    if (digit && index < 5) {
      refs.current[index + 1]?.focus()
    }

    const code = next.join('')
    if (code.length === 6) {
      refs.current[5]?.blur()
      onComplete(code)
    }
  }, [digits, onComplete])

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits]
      next[index - 1] = ''
      setDigits(next)
      refs.current[index - 1]?.focus()
    }
  }, [digits])

  // Nullstill ved ny runde (error-reset)
  const handleFocus = useCallback((index: number) => {
    if (error) {
      setDigits(Array(6).fill(''))
      refs.current[0]?.focus()
    }
  }, [error])

  return (
    <motion.div
      className="flex gap-2.5 justify-center"
      animate={error ? { x: [0, -10, 10, -10, 10, 0] } : {}}
      transition={{ duration: 0.4 }}
    >
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={digit}
          disabled={disabled}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onFocus={() => handleFocus(i)}
          className={`
            w-12 h-14 text-center text-2xl font-semibold rounded-xl
            bg-bg border-2 transition-colors duration-150
            focus:outline-none focus:ring-0
            disabled:opacity-40
            ${error
              ? 'border-danger text-danger'
              : 'border-transparent focus:border-accent'
            }
          `}
        />
      ))}
    </motion.div>
  )
}
