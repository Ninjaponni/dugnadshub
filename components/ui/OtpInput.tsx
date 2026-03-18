'use client'

import { useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'

interface OtpInputProps {
  onComplete: (code: string) => void
  disabled?: boolean
  error?: boolean
}

// 8-sifret OTP-kode med auto-advance, backspace og paste-støtte
const LENGTH = 8

export default function OtpInput({ onComplete, disabled, error }: OtpInputProps) {
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(''))
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const last = LENGTH - 1

  const handleChange = useCallback((index: number, value: string) => {
    // Paste: fordel sifre over alle felt
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, '').slice(0, LENGTH).split('')
      const next = [...digits]
      pasted.forEach((d, i) => {
        if (index + i < LENGTH) next[index + i] = d
      })
      setDigits(next)
      const code = next.join('')
      if (code.length === LENGTH) {
        refs.current[last]?.blur()
        onComplete(code)
      } else {
        refs.current[Math.min(index + pasted.length, last)]?.focus()
      }
      return
    }

    const digit = value.replace(/\D/g, '')
    const next = [...digits]
    next[index] = digit
    setDigits(next)

    if (digit && index < last) {
      refs.current[index + 1]?.focus()
    }

    const code = next.join('')
    if (code.length === LENGTH) {
      refs.current[last]?.blur()
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
      setDigits(Array(LENGTH).fill(''))
      refs.current[0]?.focus()
    }
  }, [error])

  return (
    <motion.div
      className="flex gap-1.5 justify-center"
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
          maxLength={LENGTH}
          value={digit}
          disabled={disabled}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onFocus={() => handleFocus(i)}
          className={`
            w-10 h-12 text-center text-xl font-semibold rounded-lg
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
