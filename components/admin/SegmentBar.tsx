'use client'

type Props = {
  ferdig: number
  paagaar: number
  ledige: number
}

// Segmentert progress for aktive dugnader. Tre segmenter: ferdig (accent), pågår (accent ved 38% alpha), ledige (transparent track).
export default function SegmentBar({ ferdig, paagaar, ledige }: Props) {
  const total = ferdig + paagaar + ledige
  if (total === 0) return null
  return (
    <div className="h-2 rounded-full overflow-hidden flex gap-[2px] bg-surface-low">
      {ferdig > 0 && <span className="bg-accent" style={{ flex: ferdig }} />}
      {paagaar > 0 && <span style={{ flex: paagaar, background: 'rgba(162,74,51,0.38)' }} />}
      {ledige > 0 && <span style={{ flex: ledige, background: 'transparent' }} />}
    </div>
  )
}
