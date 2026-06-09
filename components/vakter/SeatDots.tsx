// Kompakt plass-indikator — fylt prikk = tatt, hul = ledig. Rolig og scanbar.
type Props = { cap: number; claimed: number; mine?: boolean }

export default function SeatDots({ cap, claimed, mine }: Props) {
  return (
    <span className="inline-flex items-center gap-1">
      {Array.from({ length: cap }).map((_, i) => {
        const filled = i < claimed
        const style = filled
          ? { background: mine ? 'var(--color-accent)' : 'var(--color-text-secondary)' }
          : { boxShadow: 'inset 0 0 0 1.5px var(--color-text-tertiary)' }
        return <span key={i} className="w-[7px] h-[7px] rounded-full" style={style} />
      })}
    </span>
  )
}
