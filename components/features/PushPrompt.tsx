'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { subscribeToPush, saveSubscription, isPushSubscribed } from '@/lib/push/client'
import { Bell, X } from 'lucide-react'
import Button from '@/components/ui/Button'

// Banner som spor bruker om push-tillatelse
export default function PushPrompt() {
  const [show, setShow] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    async function check() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
      if (Notification.permission === 'denied') return
      if (await isPushSubscribed()) return
      if (localStorage.getItem('push_dismissed')) return
      setShow(true)
    }
    check()
  }, [])

  async function handleSubscribe() {
    setSubscribing(true)
    try {
      const registration = await navigator.serviceWorker.ready
      console.log('[Push] SW ready:', registration.scope)
      const subscription = await subscribeToPush(registration)
      console.log('[Push] Subscription:', subscription ? 'OK' : 'FAILED')
      if (subscription) {
        const { data: { session } } = await supabaseRef.current.auth.getSession()
        console.log('[Push] Session:', session ? 'OK' : 'MISSING')
        if (session) {
          const ok = await saveSubscription(subscription, session.access_token)
          console.log('[Push] Saved:', ok)
        }
      }
    } catch (err) {
      console.error('[Push] Error:', err)
    }
    setShow(false)
    setSubscribing(false)
  }

  function handleDismiss() {
    localStorage.setItem('push_dismissed', '1')
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
