'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { subscribeToPush, saveSubscription, isPushSubscribed } from '@/lib/push/client'
import { Bell, X } from 'lucide-react'
import Button from '@/components/ui/Button'

// Banner som spor bruker om push-tillatelse
interface Props {
  userId: string | null
}

export default function PushPrompt({ userId }: Props) {
  const [show, setShow] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const supabaseRef = useRef(createClient())

  // Per-user-flag for «ikke vis igjen» så bruker-skifte på samme enhet ikke
  // skjuler prompten for ny innlogget bruker.
  const dismissKey = userId ? `push_dismissed_${userId}` : null

  useEffect(() => {
    if (!dismissKey) return
    async function check() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
      if (Notification.permission === 'denied') return
      if (await isPushSubscribed()) return
      if (localStorage.getItem(dismissKey!)) return
      setShow(true)
    }
    check()
  }, [dismissKey])

  async function handleSubscribe() {
    setSubscribing(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await subscribeToPush(registration)
      if (subscription) {
        const { data: { session } } = await supabaseRef.current.auth.getSession()
        if (session) {
          await saveSubscription(subscription, session.access_token)
        }
      }
    } catch {
      // Push-registrering feilet stille
    }
    setShow(false)
    setSubscribing(false)
  }

  function handleDismiss() {
    if (dismissKey) localStorage.setItem(dismissKey, '1')
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="card p-4 mb-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
        <Bell size={20} className="text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">Vil du ha push-varsler?</p>
        <p className="text-xs text-text-secondary mt-0.5">
          Få beskjed om dugnader og nye merker
        </p>
        <div className="flex gap-2 mt-2">
          <Button size="sm" loading={subscribing} onClick={handleSubscribe}>
            Ja, aktiver
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDismiss}>
            Ikke nå
          </Button>
        </div>
      </div>
      <button onClick={handleDismiss} className="shrink-0">
        <X size={16} className="text-text-tertiary" />
      </button>
    </div>
  )
}
