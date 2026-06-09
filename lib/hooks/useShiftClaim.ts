'use client'

import { useState } from 'react'
import type { ShiftWithClaims } from '@/lib/types/shifts'

// Delt påmeldings-logikk for vakter. Brukes av både mobil-BottomSheet
// (ShiftClaimSheet) og desktop-Modal (ShiftDetailModal) så claim/unclaim
// oppfører seg likt begge steder.
export function useShiftClaim(shift: ShiftWithClaims | null, onChange: () => void, onClose: () => void) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showUnclaimConfirm, setShowUnclaimConfirm] = useState(false)

  async function handleClaim() {
    if (!shift) return
    setSubmitting(true)
    setError(null)
    const res = await fetch(`/api/shifts/${shift.id}/claim`, { method: 'POST' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: 'Ukjent feil' }))
      setError(j.error)
      setSubmitting(false)
      return
    }
    setSubmitting(false)
    onChange()
    onClose()
  }

  async function handleUnclaim() {
    if (!shift) return
    setSubmitting(true)
    setError(null)
    const res = await fetch(`/api/shifts/${shift.id}/claim`, { method: 'DELETE' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: 'Ukjent feil' }))
      setError(j.error)
      setSubmitting(false)
      return
    }
    setSubmitting(false)
    setShowUnclaimConfirm(false)
    onChange()
    onClose()
  }

  // Nullstill flyktig state når sheeten/modalen lukkes
  function reset() {
    setShowUnclaimConfirm(false)
    setError(null)
  }

  return { submitting, error, showUnclaimConfirm, setShowUnclaimConfirm, handleClaim, handleUnclaim, reset }
}
