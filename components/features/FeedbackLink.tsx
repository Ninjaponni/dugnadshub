'use client'

import { useState } from 'react'
import { Mail, Copy, Check } from 'lucide-react'
import BottomSheet from '@/components/ui/BottomSheet'
import { APP_VERSION } from '@/lib/version'

const FEEDBACK_EMAIL = 'tor.martin.norvik@gmail.com'

// Trykkbar tekst (bevisst ikke knapp — profilen har nok knapper nederst) som åpner
// et lite ark med forklaring + «Skriv e-post». Versjonen legges i e-posten så vi ser
// hvilken utgave forslaget gjelder.
export function FeedbackLink({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
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
          className="mt-5 w-full inline-flex items-center justify-center gap-2 font-semibold font-[var(--font-display)] rounded-full text-white px-8 py-3.5 text-[17px] active:scale-[0.97] transition-transform"
          style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-primary-container))' }}
        >
          <Mail size={18} />
          <span>Skriv e-post</span>
        </a>

        {/* mailto: gjør ingenting hvis enheten ikke har et e-postprogram satt opp (vanlig på PC med
            webmail) — derfor står adressen også synlig, med kopier-knapp */}
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-text-secondary">
          <span className="select-all">{FEEDBACK_EMAIL}</span>
          <button
            type="button"
            onClick={async () => {
              try { await navigator.clipboard.writeText(FEEDBACK_EMAIL); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* utklippstavle utilgjengelig — adressen kan markeres manuelt */ }
            }}
            className="inline-flex items-center gap-1 font-semibold text-accent active:opacity-60"
            aria-label="Kopier e-postadressen"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Kopiert' : 'Kopier'}</span>
          </button>
        </div>
      </BottomSheet>
    </>
  )
}
