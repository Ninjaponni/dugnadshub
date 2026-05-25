// Typer for arrangement-vakter

export interface EventShift {
  id: string
  event_id: string
  role: string
  shift_date: string  // ISO date 'YYYY-MM-DD'
  start_time: string  // 'HH:MM:SS'
  end_time: string    // 'HH:MM:SS'
  capacity: number
  notes: string | null
  created_at: string
}

export interface ShiftClaim {
  id: string
  shift_id: string
  user_id: string
  claimed_at: string
}

export interface ShiftWithClaims extends EventShift {
  claims: Array<{
    user_id: string
    claimed_at: string
    profile: { full_name: string | null; phone: string | null } | null
  }>
}

export interface RoleInfo {
  role: string
  tasks: string[]
  contact?: string  // navn på ansvarlig hos arrangør, f.eks. "Inger/Gita"
}

export interface GeneralInfoEntry {
  label: string
  value: string
}

export interface Match {
  date: string  // ISO date 'YYYY-MM-DD'
  time: string  // 'HH:MM' (lokal tid)
  home: string
  away: string
}

export interface ArrangementEvent {
  id: string
  title: string
  description: string | null
  type: 'arrangement'
  date: string
  start_time: string | null
  end_time: string | null
  status: 'upcoming' | 'active' | 'completed'
  contact_phone: string | null
  signup_deadline: string | null
  role_info: RoleInfo[] | null
  general_info: GeneralInfoEntry[] | null
  matches: Match[] | null
  driver_notes: string | null
  meeting_point: { lat: number; lng: number; name: string; description: string } | null
  send_push_on_activate: boolean | null
}
