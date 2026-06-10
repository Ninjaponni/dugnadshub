'use client'

// Desktop-visning av Merker-siden (lg+). Bygget 1:1 fra Tor Martins
// Claude Design-prototype (views-vakter-merker.jsx → MerkerView).
// Mobil-flyten i merker/page.tsx er urørt — denne rendres kun bak `hidden lg:block`.
//
// Tre blokker:
//  1) HERO — ring (samling-progress) + journey-track med nivå-prikker
//  2) "Det du har samlet" — trophy-shelf med store coins, ferskeste først
//  3) "Hele samlingen" — kategori-rader med filter (Alle/Opptjent/Mangler)

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Lock, Sparkles } from 'lucide-react'
import { badgeDefinitions } from '@/lib/badges/definitions'

// Kategori-rekkefølge + etiketter — speiler mobil-siden
const CATS: [string, string][] = [
  ['starter', 'Startermerker'],
  ['vanlig', 'Vanlige merker'],
  ['veteran', 'Veteranmerker'],
  ['elite', 'Elitemerker'],
  ['aktivitet', 'Aktivitetsmerker'],
  ['17mai', '17. mai-merker'],
  ['styret', 'Styret'],
  ['komite', 'Komitémerker'],
  ['vakt', 'Vaktmerker'],
]

// Navngitt nivå-stige — reisen fra første merke til legende (fra prototypen)
const LEVELS = [
  { name: 'Frøspire', at: 1 },
  { name: 'Samler', at: 5 },
  { name: 'Pantejeger', at: 12 },
  { name: 'Sonevandrer', at: 19 },
  { name: 'Rodemester', at: 30 },
  { name: 'Veteran', at: 45 },
  { name: 'Legende', at: 60 },
]

const GRADIENT_BRAND = 'linear-gradient(135deg, var(--color-accent), var(--color-primary-container))'
const GRADIENT_BRAND_HORIZ = 'linear-gradient(90deg, var(--color-accent), var(--color-primary-container))'

type DBadge = {
  id: number
  name: string
  src: string
  desc: string
  cat: string
  earned: boolean
  count: number
  fresh: boolean
}

// Animert sirkulær progress-ring
function Ring({ size = 132, stroke = 10, pct = 0, children }: { size?: number; stroke?: number; pct?: number; children: React.ReactNode }) {
  const [p, setP] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setP(pct))
    return () => cancelAnimationFrame(id)
  }, [pct])
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.22)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#fff"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, p)))}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  )
}

// Myk opptelling for overskrifts-tall
function useCountUp(target: number, dur = 1000, delay = 0) {
  const [v, setV] = useState(target)
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) { setV(target); return }
    let raf = 0
    let start: number | undefined
    const tick = (t: number) => {
      if (start === undefined) start = t
      const k = Math.min(1, (t - start) / dur)
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(tick)
      else setV(target)
    }
    const to = setTimeout(() => { raf = requestAnimationFrame(tick) }, delay)
    return () => { clearTimeout(to); cancelAnimationFrame(raf) }
  }, [target, dur, delay])
  return v
}

// Liten glitter-klynge som feirer et ferskt merke
function Sparks() {
  const spots: [number, number, number, number][] = [[-8, 6, 9, 0.9], [70, 2, 7, 0.7], [64, 60, 6, 0.6], [-4, 54, 7, 0.65]]
  return (
    <>
      {spots.map(([l, t, s, o], i) => (
        <span key={i} style={{ position: 'absolute', left: l, top: t, color: 'var(--color-warning)', opacity: o, pointerEvents: 'none' }}>
          <Sparkles size={s} />
        </span>
      ))}
    </>
  )
}

// Liten pille
function Pill({ tone, children }: { tone: 'success' | 'neutral'; children: React.ReactNode }) {
  const styles = tone === 'success'
    ? { background: 'color-mix(in srgb, var(--color-success) 16%, transparent)', color: 'var(--color-success)' }
    : { background: 'var(--color-surface-low)', color: 'var(--color-text-tertiary)' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700, padding: '5px 12px', borderRadius: 9999, ...styles }}>
      {children}
    </span>
  )
}

// Stor coin til trophy-shelf
function BigBadge({ b, onClick }: { b: DBadge; onClick: () => void }) {
  const [h, setH] = useState(false)
  const fresh = b.fresh
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{ width: 110, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, background: h ? 'var(--color-surface-low)' : 'transparent', border: 0, cursor: 'pointer', padding: '14px 6px 11px', borderRadius: 20, fontFamily: 'inherit', transition: 'background .16s, transform .16s', transform: h ? 'translateY(-3px)' : 'none' }}
    >
      <div style={{ position: 'relative' }}>
        {fresh && <Sparks />}
        <div
          style={{
            width: 76, height: 76, borderRadius: '50%', overflow: 'hidden', isolation: 'isolate', background: 'var(--color-badge-coin)',
            boxShadow: fresh
              ? (h ? '0 8px 22px rgba(255,170,70,.5), inset 0 0 0 2px rgba(255,196,90,.85)' : '0 5px 18px rgba(255,170,70,.42), inset 0 0 0 2px rgba(255,196,90,.7)')
              : (h ? '0 8px 20px rgba(160,120,80,.3), inset 0 0 0 2px rgba(255,213,79,.45)' : '0 4px 14px rgba(160,120,80,.2)'),
            transition: 'box-shadow .25s',
          }}
        >
          <img src={b.src} alt={b.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scale(0.8)', mixBlendMode: 'multiply' }} />
        </div>
        {b.count > 1
          ? <span style={{ position: 'absolute', bottom: -3, right: -3, minWidth: 24, height: 24, padding: '0 6px', background: GRADIENT_BRAND, color: '#fff', borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2.5px solid var(--color-card)', fontSize: 11, fontWeight: 800 }}>×{b.count}</span>
          : <span style={{ position: 'absolute', bottom: -3, right: -3, width: 24, height: 24, background: 'var(--color-success)', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2.5px solid var(--color-card)' }}><Check size={12} strokeWidth={3} /></span>}
        {fresh && <span style={{ position: 'absolute', top: -7, left: '50%', transform: 'translateX(-50%)', background: 'var(--color-warning)', color: '#6b4e00', fontSize: 9.5, fontWeight: 800, letterSpacing: '.08em', padding: '2px 7px', borderRadius: 9999, boxShadow: '0 2px 6px rgba(160,120,80,.3)' }}>NY</span>}
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, textAlign: 'center', lineHeight: 1.25, color: 'var(--color-text-secondary)' }}>{b.name}</span>
    </button>
  )
}

// Kompakt vegg-coin (hele samlingen)
function MiniBadge({ b, onClick }: { b: DBadge; onClick: () => void }) {
  const [h, setH] = useState(false)
  return (
    <button
      title={b.earned ? `${b.name}${b.count > 1 ? ` ×${b.count}` : ''} — opptjent` : `${b.name} — mangler`}
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{ position: 'relative', width: 56, height: 56, borderRadius: '50%', border: 0, padding: 0, cursor: 'pointer', background: 'var(--color-badge-coin)', flexShrink: 0, boxShadow: b.earned ? (h ? '0 6px 15px rgba(160,120,80,.28)' : '0 2px 9px rgba(160,120,80,.18)') : 'inset 0 0 0 1.5px rgba(57,56,43,.07)', transition: 'box-shadow .2s, transform .16s', transform: h ? 'translateY(-3px) scale(1.09)' : 'none', zIndex: h ? 5 : 1 }}
    >
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden', isolation: 'isolate', background: 'var(--color-badge-coin)' }}>
        <img src={b.src} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scale(0.8)', mixBlendMode: 'multiply', filter: b.earned ? 'none' : 'grayscale(1)', opacity: b.earned ? 1 : 0.32 }} />
      </span>
      {b.earned && b.count > 1 && (
        <span style={{ position: 'absolute', bottom: -3, right: -3, minWidth: 19, height: 19, padding: '0 5px', background: 'var(--color-accent)', color: '#fff', borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--color-card)', fontSize: 9.5, fontWeight: 700 }}>×{b.count}</span>
      )}
      {!b.earned && h && (
        <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)' }}><Lock size={15} /></span>
      )}
    </button>
  )
}

type Props = {
  loading: boolean
  badgeCounts: Map<number, number>
  earnedBadgeIds: Set<number>
  newBadgeIds: Set<number>
}

export default function MerkerDesktop({ loading, badgeCounts, earnedBadgeIds, newBadgeIds }: Props) {
  const [sel, setSel] = useState<DBadge | null>(null)
  const [filter, setFilter] = useState<'all' | 'earned' | 'missing'>('all')
  const [tracked, setTracked] = useState(false)

  // Bygg en samlet liste av merker fra ekte app-data
  const all: DBadge[] = badgeDefinitions.map(d => ({
    id: d.id,
    name: d.name,
    src: d.icon,
    desc: d.description,
    cat: d.category,
    earned: earnedBadgeIds.has(d.id),
    count: badgeCounts.get(d.id) || 0,
    fresh: newBadgeIds.has(d.id),
  }))

  const total = all.length
  const earned = all.filter(b => b.earned)
  // Teller totalt antall opptjente merker INKL. duplikater (f.eks. Solpanter ×2
  // teller som 2) — samme tall som mobil-siden viser. Distinkte merker = earned.length.
  const earnedCount = all.reduce((n, b) => n + b.count, 0)

  // Nivå-matematikk — basert på totalt antall opptjente merker (inkl. duplikater)
  const curIdx = LEVELS.reduce((acc, lv, i) => (earnedCount >= lv.at ? i : acc), 0)
  const cur = LEVELS[curIdx]
  const next = LEVELS[curIdx + 1]
  const toNext = next ? next.at - earnedCount : 0
  const intra = next ? (earnedCount - cur.at) / (next.at - cur.at) : 1
  const trackPct = ((curIdx + Math.max(0, Math.min(1, intra))) / (LEVELS.length - 1)) * 100

  // Shelf-rekkefølge: ferskeste først
  const shelf = [...earned].sort((a, b) => (b.fresh ? 1 : 0) - (a.fresh ? 1 : 0))

  const countMerker = useCountUp(loading ? 0 : earnedCount)

  useEffect(() => {
    const id = requestAnimationFrame(() => setTracked(true))
    return () => cancelAnimationFrame(id)
  }, [])

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="rounded-[30px] h-[220px]" style={{ background: GRADIENT_BRAND, opacity: 0.5 }} />
        <div className="card rounded-[26px] h-[180px]" />
        <div className="card rounded-[26px] h-[320px]" />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── HERO: nivå + journey ──────────────────────────────────── */}
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 30, background: GRADIENT_BRAND, color: '#fff', padding: '34px 40px', boxShadow: '0 18px 44px rgba(162,74,51,0.30)' }}>
        <div className="blob-drift" style={{ position: 'absolute', bottom: -120, left: 90, width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,.07)', filter: 'blur(10px)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 40, flexWrap: 'wrap' }}>

          {/* samlings-emblem — ring = hele samlingens progresjon */}
          {/* Ringen måler samlingens DEKNING (distinkte merker av totalen) —
              tallet i midten teller totalt inkl. duplikater (×2 osv.), som mobil.
              Uten distinkt-telleren kunne ringen passert 100 %. */}
          <Ring size={132} stroke={10} pct={total ? earned.length / total : 0}>
            <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.18em', opacity: .8 }}>SAMLET</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 800, lineHeight: 1, marginTop: 1 }}>{countMerker}</span>
            <span style={{ fontSize: 12, fontWeight: 600, opacity: .82 }}>av {total}</span>
          </Ring>

          {/* journey */}
          <div style={{ flex: 1, minWidth: 320 }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', opacity: .82 }}>Din samling · Nivå {curIdx + 1}</span>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.05, margin: '5px 0 4px' }}>{cur.name}</h2>
            <p style={{ margin: '0 0 22px', fontSize: 14.5, opacity: .92 }}>
              {next ? <>Bare <b>{toNext} {toNext === 1 ? 'merke' : 'merker'}</b> igjen til <b>{next.name}</b> — du er nesten der!</> : <>Du har nådd toppen. Legende!</>}
            </p>

            {/* journey track */}
            <div style={{ position: 'relative', height: 4, background: 'rgba(255,255,255,.24)', borderRadius: 9999, margin: '0 10px' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${tracked ? trackPct : 0}%`, background: '#fff', borderRadius: 9999, transition: 'width 1.2s cubic-bezier(.2,.8,.2,1)' }} />
              {LEVELS.map((lv, i) => {
                const x = (i / (LEVELS.length - 1)) * 100
                const passed = i <= curIdx
                const isNext = i === curIdx + 1
                const dotSize = isNext ? 18 : passed ? 15 : 11
                return (
                  <div key={lv.name} style={{ position: 'absolute', left: `${x}%`, top: '50%', transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ position: 'relative', width: dotSize, height: dotSize, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isNext && <span className="next-beacon" aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '50%', width: 16, height: 16, marginLeft: -8, marginTop: -8, borderRadius: '50%', background: 'rgba(255,213,79,.55)', pointerEvents: 'none' }} />}
                      <span style={{ position: 'relative', width: dotSize, height: dotSize, borderRadius: '50%', background: passed ? '#fff' : isNext ? 'var(--color-warning)' : 'rgba(255,255,255,.35)', boxShadow: isNext ? '0 0 0 4px rgba(255,213,79,.3)' : passed ? '0 2px 5px rgba(120,50,30,.3)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent)' }}>
                        {passed && i === curIdx && <Check size={9} strokeWidth={3.5} />}
                      </span>
                    </span>
                    <span style={{ position: 'absolute', top: 22, fontSize: 9.5, fontWeight: 700, whiteSpace: 'nowrap', opacity: isNext ? 1 : passed ? .85 : .5, color: isNext ? 'var(--color-warning)' : '#fff' }}>{lv.name}</span>
                  </div>
                )
              })}
            </div>
            <div style={{ height: 18 }} />
          </div>
        </div>
      </div>

      {/* ── DET DU HAR SAMLET: trophy-shelf ───────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 700, margin: 0, letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>Det du har samlet</h2>
          <Pill tone="success"><Check size={11} strokeWidth={3} />{earnedCount} merker</Pill>
        </div>
        <div className="card" style={{ borderRadius: 26, overflow: 'hidden' }}>
          {shelf.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '20px 22px', background: 'linear-gradient(180deg, rgba(255,213,79,.07), transparent 60%)' }}>
              {shelf.map(b => <BigBadge key={b.id} b={b} onClick={() => setSel(b)} />)}
            </div>
          ) : (
            <div style={{ padding: '34px 22px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 14.5 }}>
              Ingen merker ennå — din første dugnad gir deg det første merket!
            </div>
          )}
        </div>
      </div>

      {/* ── HELE SAMLINGEN: full collection wall ──────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 700, margin: 0, letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>Hele samlingen</h2>
          <div style={{ display: 'inline-flex', background: 'var(--color-surface-low)', borderRadius: 9999, padding: 4, gap: 2 }}>
            {([['all', 'Alle'], ['earned', 'Opptjent'], ['missing', 'Mangler']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} style={{ border: 0, cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, padding: '7px 16px', borderRadius: 9999, background: filter === k ? 'var(--color-card)' : 'transparent', color: filter === k ? 'var(--color-accent)' : 'var(--color-text-secondary)', boxShadow: filter === k ? '0 2px 8px rgba(160,120,80,.16)' : 'none', transition: 'all .15s' }}>{l}</button>
            ))}
          </div>
        </div>
        <div className="card" style={{ borderRadius: 26, padding: 6 }}>
          {CATS.map(([key, label], i) => {
            const list = all.filter(b => b.cat === key)
            const got = list.filter(b => b.earned).length
            const done = got === list.length && list.length > 0
            const shown = list.filter(b => (filter === 'all' ? true : filter === 'earned' ? b.earned : !b.earned))
            if (shown.length === 0) return null
            return (
              <div key={key} style={{ display: 'flex', gap: 22, alignItems: 'flex-start', padding: '14px 18px', borderTop: i ? '1px solid rgba(57,56,43,.08)' : 'none' }}>
                <div style={{ width: 156, flexShrink: 0, paddingTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>{label}</span>
                    {done && <span style={{ width: 17, height: 17, borderRadius: '50%', background: 'var(--color-warning)', color: '#6b4e00', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Check size={10} strokeWidth={3.5} /></span>}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: got ? 'var(--color-accent)' : 'var(--color-text-tertiary)', margin: '4px 0 6px' }}>{got} / {list.length}{done ? ' · fullført!' : ''}</div>
                  <div style={{ width: 110, height: 5, background: 'var(--color-surface-low)', borderRadius: 9999, overflow: 'hidden' }}>
                    <div style={{ width: `${list.length ? Math.round((got / list.length) * 100) : 0}%`, height: '100%', background: done ? 'var(--color-warning)' : GRADIENT_BRAND_HORIZ, borderRadius: 9999, transition: 'width .8s cubic-bezier(.2,.8,.2,1)' }} />
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 13 }}>
                  {shown.map(b => <MiniBadge key={b.id} b={b} onClick={() => setSel(b)} />)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── badge-detalj modal ────────────────────────────────────── */}
      <AnimatePresence>
        {sel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => setSel(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2"
              style={{ width: 400 }}
            >
              <div className="card" style={{ position: 'relative', overflow: 'hidden', borderRadius: 28 }}>
                {sel.earned && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 150, background: 'linear-gradient(180deg, rgba(255,213,79,.20), transparent)', pointerEvents: 'none' }} />}
                <div style={{ position: 'relative', padding: '38px 30px 30px', textAlign: 'center' }}>
                  <div style={{ position: 'relative', width: 128, height: 128, margin: '0 auto 8px' }}>
                    {sel.earned && <Sparks />}
                    <div style={{ width: 128, height: 128, borderRadius: '50%', overflow: 'hidden', isolation: 'isolate', background: 'var(--color-badge-coin)', boxShadow: sel.earned ? '0 6px 22px rgba(255,170,70,.4), inset 0 0 0 2.5px rgba(255,196,90,.7)' : 'inset 0 0 0 1.5px rgba(57,56,43,0.08)' }}>
                      <img src={sel.src} alt={sel.name} style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scale(0.82)', mixBlendMode: 'multiply', filter: sel.earned ? 'none' : 'grayscale(1)', opacity: sel.earned ? 1 : 0.4 }} />
                    </div>
                  </div>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, margin: '14px 0 10px', color: 'var(--color-text-primary)' }}>{sel.name}</h2>
                  {sel.earned
                    ? <Pill tone="success"><Check size={12} strokeWidth={3} />Opptjent{sel.count > 1 ? ` ×${sel.count}` : ''}</Pill>
                    : <Pill tone="neutral"><Lock size={12} />Ikke opptjent ennå</Pill>}
                  <p style={{ fontSize: 14.5, color: 'var(--color-text-secondary)', margin: '18px 4px 0', lineHeight: 1.55 }}>{sel.desc}</p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
