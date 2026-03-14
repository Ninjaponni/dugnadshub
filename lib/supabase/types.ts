// Supabase database-typer — manuelt definert (erstatt med genererte typer senere)
export type Role = 'admin' | 'collector' | 'driver' | 'strapper'
export type ChildGroup = 'Aspirant' | 'Junior' | 'Hovedkorps'
export type ZoneArea = 'NORD' | 'SOR'
export type EventType = 'bottle_collection' | 'lottery' | 'baking' | 'other'
export type EventStatus = 'upcoming' | 'active' | 'completed'
export type ZoneStatus = 'available' | 'claimed' | 'in_progress' | 'completed' | 'picked_up'

export interface Profile {
  id: string
  full_name: string | null
  email: string
  phone: string | null
  child_name: string | null
  child_group: ChildGroup | null
  role: Role
  avatar_url: string | null
  created_at: string
}

export interface Zone {
  id: string
  name: string
  area: ZoneArea
  households: number
  collectors_needed: number
  trailer_group: number
  geometry: Record<string, unknown>
  notes: string | null
}

export interface DropPoint {
  id: string
  name: string
  area: ZoneArea
  lat: number
  lng: number
}

export interface DugnadEvent {
  id: string
  title: string
  type: EventType
  date: string
  start_time: string | null
  status: EventStatus
  description: string | null
  created_by: string
}

export interface ZoneAssignment {
  id: string
  event_id: string
  zone_id: string
  status: ZoneStatus
}

export interface ZoneClaim {
  id: string
  assignment_id: string
  user_id: string
  claimed_at: string
}

export interface DriverAssignment {
  id: string
  event_id: string
  user_id: string
  trailer_group: number
  area: ZoneArea
}

export interface ParticipationLog {
  id: string
  user_id: string
  event_id: string
  role: Role
  zones_completed: number
  completed_at: string
}

export interface Badge {
  id: number
  name: string
  description: string
  icon: string
  category: 'starter' | 'vanlig' | 'veteran' | 'elite' | 'rolle'
  auto_criteria: string | null
}

export interface UserBadge {
  id: string
  user_id: string
  badge_id: number
  awarded_at: string
  event_id: string | null
}

// Database typer for Supabase
export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile> & { id: string }; Update: Partial<Profile> }
      zones: { Row: Zone; Insert: Omit<Zone, 'geometry'> & { geometry: unknown }; Update: Partial<Zone> }
      drop_points: { Row: DropPoint; Insert: DropPoint; Update: Partial<DropPoint> }
      events: { Row: DugnadEvent; Insert: Omit<DugnadEvent, 'id'>; Update: Partial<DugnadEvent> }
      zone_assignments: { Row: ZoneAssignment; Insert: Omit<ZoneAssignment, 'id'>; Update: Partial<ZoneAssignment> }
      zone_claims: { Row: ZoneClaim; Insert: Omit<ZoneClaim, 'id'>; Update: Partial<ZoneClaim> }
      driver_assignments: { Row: DriverAssignment; Insert: Omit<DriverAssignment, 'id'>; Update: Partial<DriverAssignment> }
      participation_log: { Row: ParticipationLog; Insert: Omit<ParticipationLog, 'id'>; Update: Partial<ParticipationLog> }
      badges: { Row: Badge; Insert: Omit<Badge, 'id'>; Update: Partial<Badge> }
      user_badges: { Row: UserBadge; Insert: Omit<UserBadge, 'id'>; Update: Partial<UserBadge> }
    }
  }
}
