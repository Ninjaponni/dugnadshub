'use client'

// Korpstur-siden — ren info-oversikt uten påmelding (alt er forhåndsbestemt).
// Svarer på de tre spørsmålene folk faktisk har: Når må jeg være hvor?
// Hva er mitt ansvar? Hvem ringer jeg? Resten ligger sammenleggbart under.
// Innholdet bor i lib/data/korpstur-2026.ts.

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronRight, Phone, AlertTriangle, Moon, BedDouble, Backpack, Info, Users, ClipboardCheck } from 'lucide-react'
import BrandLink from '@/components/layout/BrandLink'
import { isMockMode } from '@/lib/mock/useMock'
import {
  turMeta, program, nattevakter, ansvar, rom, pakkeliste, praktisk, varsler,
  turkomite, reiseledere, kontaktHjemme,
} from '@/lib/data/korpstur-2026'

const GRADIENT_BRAND = 'linear-gradient(135deg, var(--color-accent), var(--color-primary-container))'

// Rolig uppercase seksjons-etikett (samme mønster som arrangement-desktop)
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-accent">{children}</span>
}

// Sammenleggbar seksjon — speiler VMCollapse fra arrangement-siden
function Collapse({ icon, title, subtitle, children, defaultOpen }: {
  icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div className="bg-card rounded-[22px] overflow-hidden border border-text-primary/[0.07]" style={{ boxShadow: '0 4px 16px rgba(160,120,80,0.10)' }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-[13px] px-5 lg:px-6 py-[18px] text-left">
        <span className="text-accent inline-flex shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-[17.5px] font-bold -tracking-[0.01em] text-text-primary">{title}</h3>
          {subtitle && <div className="text-[12.5px] text-text-tertiary mt-0.5">{subtitle}</div>}
        </div>
        <ChevronRight size={18} className="text-text-tertiary shrink-0 transition-transform" style={{ transform: open ? 'rotate(90deg)' : 'none' }} />
      </button>
      <div className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
        <div className="overflow-hidden">
          <div className="px-5 lg:px-6 pb-6 pt-1">{children}</div>
        </div>
      </div>
    </div>
  )
}

export default function TurPage() {
  const supabaseRef = useRef(createClient())
  // Innlogget brukers personlige ansvar (matches på telefonnummer)
  const [myLines, setMyLines] = useState<string[] | null>(null)

  useEffect(() => {
    if (isMockMode()) return
    async function load() {
      const { data: { user } } = await supabaseRef.current.auth.getUser()
      if (!user) return
      const { data } = await supabaseRef.current
        .from('profiles')
        .select('phone')
        .eq('id', user.id)
        .single() as { data: { phone: string | null } | null }
      const phone = (data?.phone || '').replace(/\s+/g, '')
      if (!phone) return
      const hit = ansvar.find(a => a.phone === phone)
      if (hit) setMyLines(hit.lines)
    }
    load()
  }, [])

  return (
    <>
      {/* Mobil-header — samme mønster som de andre sidene */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-card safe-top">
        <div className="flex justify-between items-center px-5 h-14 max-w-[430px] mx-auto">
          <BrandLink />
          <div className="w-9" />
        </div>
      </header>

      <main className="pt-20 pb-28 px-5 space-y-6 lg:pt-8 lg:pb-12 lg:px-8 xl:px-12 lg:max-w-[1060px]">

        {/* ── HERO ─────────────────────────────────────────────── */}
        <section
          className="relative overflow-hidden rounded-[30px] text-white p-7 lg:px-10 lg:py-9"
          style={{ background: GRADIENT_BRAND, boxShadow: '0 18px 44px rgba(162,74,51,0.30)' }}
        >
          <div className="blob-drift absolute -bottom-28 left-16 w-[240px] h-[240px] rounded-full pointer-events-none" style={{ background: 'rgba(255,255,255,.07)', filter: 'blur(10px)' }} />
          <div className="relative">
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.16em] opacity-80">Korpstur · {turMeta.dates}</span>
            <h1 className="font-display text-[28px] lg:text-[34px] font-extrabold -tracking-[0.02em] leading-[1.08] mt-1 text-balance">
              {turMeta.title}
            </h1>
            {/* Stat-strip — samme mønster som arrangement-headeren */}
            <div className="flex items-stretch flex-wrap gap-y-3 mt-5">
              {turMeta.stats.map(([l, v], i) => (
                <div key={l} className={i ? 'px-5 lg:px-7 border-l border-white/25' : 'pr-5 lg:pr-7'}>
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] opacity-75 mb-0.5">{l}</div>
                  <div className="font-display text-[15px] lg:text-[17px] font-extrabold whitespace-nowrap">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── DITT ANSVAR — kun for de med tildelt ansvar ──────── */}
        {myLines && (
          <section>
            <div className="mb-3"><Eyebrow>Ditt ansvar</Eyebrow></div>
            <div className="rounded-2xl px-5 py-4 flex gap-3.5" style={{ background: 'rgba(162,74,51,0.04)', boxShadow: 'inset 0 0 0 1.5px var(--color-accent)' }}>
              <span className="w-[3px] self-stretch rounded-full bg-accent shrink-0" />
              <ul className="flex flex-col gap-2">
                {myLines.map((l, i) => (
                  <li key={i} className={i === 0 ? 'font-display text-base font-bold text-text-primary' : 'text-sm text-text-secondary'}>
                    {l}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* ── PROGRAM — tre dager ──────────────────────────────── */}
        <section>
          <div className="mb-3"><Eyebrow>Program</Eyebrow></div>
          <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
            {program.map(day => (
              <div key={day.id} className="bg-card rounded-[22px] border border-text-primary/[0.07] p-5" style={{ boxShadow: '0 4px 16px rgba(160,120,80,0.10)' }}>
                <h3 className="font-display text-[16.5px] font-bold -tracking-[0.01em] text-text-primary mb-4">{day.label}</h3>
                <div className="flex flex-col gap-3.5">
                  {day.items.map((item, i) => (
                    <div key={i} className="flex gap-3">
                      <span
                        className={`font-mono text-[12.5px] tabular-nums -tracking-[0.02em] shrink-0 w-[44px] pt-px ${item.highlight ? 'font-bold text-accent' : 'text-text-tertiary'}`}
                      >
                        {item.time || '·'}
                      </span>
                      <div className="min-w-0">
                        <div className={`text-[14px] leading-snug ${item.highlight ? 'font-bold text-text-primary' : 'font-semibold text-text-primary/90'}`}>
                          {item.title}
                        </div>
                        {item.detail && <div className="text-[12.5px] text-text-secondary leading-snug mt-0.5">{item.detail}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── NATTEVAKTER — natt til lørdag, forhåndsfordelt ───── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Eyebrow>Nattevakter · natt til lørdag</Eyebrow>
          </div>
          <div className="bg-card rounded-[20px] overflow-hidden border border-text-primary/[0.08]" style={{ boxShadow: '0 4px 16px rgba(160,120,80,0.10)' }}>
            {nattevakter.map((v, i) => (
              <div key={i} className={`flex items-center gap-3.5 px-5 py-3.5 ${i ? 'border-t border-text-primary/[0.07]' : ''}`}>
                <span className="w-9 h-9 rounded-full bg-surface-low flex items-center justify-center text-accent shrink-0">
                  <Moon size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm font-semibold tabular-nums -tracking-[0.02em] text-text-primary">{v.time}</div>
                  {v.note && <div className="text-[12.5px] text-text-tertiary mt-0.5">{v.note}</div>}
                </div>
                <span className="font-display text-[15px] font-bold text-text-primary shrink-0">{v.name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── VIKTIGE VARSLER ──────────────────────────────────── */}
        <section className="grid gap-3 lg:grid-cols-2">
          {varsler.map(v => (
            <div key={v.tittel} className="rounded-2xl bg-warning/10 border border-warning/30 p-4 flex gap-3">
              <AlertTriangle size={18} className="text-warning shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-text-primary mb-0.5">{v.tittel}</p>
                <p className="text-sm text-text-secondary leading-snug">{v.tekst}</p>
              </div>
            </div>
          ))}
        </section>

        {/* ── OPPSLAGSVERKET — sammenleggbart ──────────────────── */}
        <section className="space-y-4">
          <Collapse icon={<BedDouble size={19} />} title="Rominndeling" subtitle="Åretta ungdomsskole · 4 klasserom">
            <div className="grid gap-4 lg:grid-cols-2">
              {rom.map(r => (
                <div key={r.navn} className="bg-surface-low rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-display text-[15.5px] font-bold text-text-primary">{r.navn}</span>
                    <span className="text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-accent/10 text-accent whitespace-nowrap">
                      {r.ansvarlig} har ansvar
                    </span>
                  </div>
                  <p className="text-[12.5px] text-text-tertiary mb-3">Voksne: {r.voksne.join(', ')}</p>
                  <ul className="grid grid-cols-1 gap-y-1">
                    {r.barn.map(b => (
                      <li key={b.navn} className="text-[13.5px] text-text-secondary flex items-baseline justify-between gap-2">
                        <span className="truncate">{b.navn}</span>
                        <span className="text-[10.5px] font-bold text-text-tertiary shrink-0">{b.gruppe}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Collapse>

          <Collapse icon={<Backpack size={19} />} title="Pakkeliste" subtitle="Husk å merke alt med navn!">
            <div className="grid gap-5 lg:grid-cols-2">
              {pakkeliste.map(g => (
                <div key={g.gruppe}>
                  <div className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-text-tertiary mb-2">{g.gruppe}</div>
                  <ul className="flex flex-col gap-1.5">
                    {g.punkter.map((p, i) => (
                      <li key={i} className="relative pl-4 text-[13.5px] text-text-secondary leading-snug">
                        <span className="absolute left-0 top-[7px] w-1.5 h-1.5 rounded-full bg-accent" />{p}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Collapse>

          <Collapse icon={<Info size={19} />} title="Praktisk informasjon" subtitle="Hatt, uniform, lunsj og mer">
            <div className="grid gap-x-7 gap-y-[18px]" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              {praktisk.map(row => (
                <div key={row.label}>
                  <div className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-text-tertiary mb-1">{row.label}</div>
                  <div className="text-sm text-text-secondary leading-relaxed">{row.value}</div>
                </div>
              ))}
            </div>
          </Collapse>

          <Collapse icon={<ClipboardCheck size={19} />} title="Før avreise" subtitle="Sjekkliste for hjemme">
            <ul className="flex flex-col gap-1.5">
              {[
                'Les pakkelisten og merk alt med navn',
                'Gå gjennom turreglene med barna',
                'Øv på å henge opp uniformen i dressposen',
                'Pakk hatten støtsikkert og legg fjæren i jakkelomma',
                'Smør matpakke til bussturen',
              ].map((p, i) => (
                <li key={i} className="relative pl-4 text-[13.5px] text-text-secondary leading-snug">
                  <span className="absolute left-0 top-[7px] w-1.5 h-1.5 rounded-full bg-accent" />{p}
                </li>
              ))}
            </ul>
          </Collapse>
        </section>

        {/* ── KONTAKTER ────────────────────────────────────────── */}
        <section>
          <div className="mb-3"><Eyebrow>Kontakter</Eyebrow></div>

          {/* Turkomiteen med ansvarsområde */}
          <div className="bg-card rounded-[20px] overflow-hidden border border-text-primary/[0.08] mb-4" style={{ boxShadow: '0 4px 16px rgba(160,120,80,0.10)' }}>
            {turkomite.map((k, i) => (
              <a key={k.navn} href={`tel:${k.tlf}`} className={`flex items-center gap-3.5 px-5 py-3.5 hover:bg-surface-low/60 transition-colors ${i ? 'border-t border-text-primary/[0.07]' : ''}`}>
                <span className="w-9 h-9 rounded-full bg-surface-low flex items-center justify-center text-accent shrink-0">
                  <Users size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[14.5px] font-bold text-text-primary">{k.navn}</div>
                  <div className="text-[12.5px] text-text-secondary">{k.rolle}</div>
                </div>
                <Phone size={15} className="text-accent shrink-0" />
              </a>
            ))}
          </div>

          {/* Alle reiseledere — kompakt grid med tel-lenker */}
          <div className="bg-card rounded-[20px] border border-text-primary/[0.08] p-5" style={{ boxShadow: '0 4px 16px rgba(160,120,80,0.10)' }}>
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-text-tertiary mb-3">Reiseledere</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
              {reiseledere.map(r => (
                <a key={r.navn} href={`tel:${r.tlf}`} className="flex items-baseline justify-between gap-3 text-[13.5px] hover:text-accent transition-colors">
                  <span className="text-text-secondary truncate">{r.navn}</span>
                  <span className="font-mono text-[12.5px] text-accent shrink-0">{r.tlf.replace(/(\d{3})(\d{2})(\d{3})/, '$1 $2 $3')}</span>
                </a>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-text-primary/[0.07] flex items-baseline justify-between gap-3 text-[13.5px]">
              <span className="text-text-secondary">{kontaktHjemme.navn} · <span className="text-text-tertiary">{kontaktHjemme.rolle}</span></span>
              <a href={`tel:${kontaktHjemme.tlf}`} className="font-mono text-[12.5px] text-accent shrink-0">{kontaktHjemme.tlf.replace(/(\d{3})(\d{2})(\d{3})/, '$1 $2 $3')}</a>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
