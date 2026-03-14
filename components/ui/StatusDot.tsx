import type { ZoneStatus } from '@/lib/supabase/types'

const statusColors: Record<ZoneStatus, string> = {
  available: 'bg-zone-available',
  claimed: 'bg-zone-partial',
  in_progress: 'bg-warning',
  completed: 'bg-zone-complete',
  picked_up: 'bg-zone-picked-up',
}

const statusLabels: Record<ZoneStatus, string> = {
  available: 'Ledig',
  claimed: 'Tatt',
  in_progress: 'Pågår',
  completed: 'Ferdig',
  picked_up: 'Hentet',
}

interface StatusDotProps {
  status: ZoneStatus
  showLabel?: boolean
  className?: string
}

// Liten fargeprikk for sonestatus
export default function StatusDot({ status, showLabel = false, className = '' }: StatusDotProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className={`status-dot ${statusColors[status]}`} />
      {showLabel && (
        <span className="text-xs text-text-secondary">{statusLabels[status]}</span>
      )}
    </span>
  )
}
