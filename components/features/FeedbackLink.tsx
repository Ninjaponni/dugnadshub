'use client'

import { useState } from 'react'
import { Mail } from 'lucide-react'
import BottomSheet from '@/components/ui/BottomSheet'
import { APP_VERSION } from '@/lib/version'

const FEEDBACK_EMAIL = 'tor.martin.norvik@gmail.com'

// Trykkbar tekst (bevisst ikke knapp — profilen har nok knapper nederst) som åpner
// et lite ark med forklaring + «Skriv e-post». Versjonen legges i e-posten så vi ser
// hvilken utgave forslaget gjelder.
export function FeedbackLink({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const mailto = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('Forslag til Dugnadshub')}&body=${encodeURIComponent(`\n\n\nSendt fra Dugnadshub v${APP_VERSION}`)}`

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-sm font-semibold text-accent underline underline-offset-4 decoration-accent/40 active:opacity-60 lg:hover:decoration-accent transition ${className}`}
      >
        Forslag til forbedringer?
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Forslag til forbedringer">
        <div className="space-y-3 text-[15px] leading-relaxed text-text-secondary">
          <p>Dugnadshub utvikles hele tiden, og de beste endringene kommer fra foreldre som bruker den.</p>
          <p>Savner du noe, eller er det noe som burde virke annerledes? Send en e-post, så ser vi hva vi får til.</p>
        </div>
        {/* Lenke stylet 1:1 som primær <Button size="lg"> — en <a> kan ikke inneholde en <button> */}
        <a
          href={mailto}
          onClick={() => setOpen(false)}
          className="mt-5 w-full inline-flex items-center justify-center gap-2 font-semibold font-[var(--font-display)] rounded-full text-white px-8 py-3.5 text-[17px] active:scale-[0.97] transition-transform"
          style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-primary-container))' }}
        >
          <Mail size={18} />
          <span>Skriv e-post</span>
        </a>
      </BottomSheet>
    </>
  )
}
