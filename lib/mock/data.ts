// Mock-data for designmodus — Flaskeinnsamling Nord aktiv
import type { Profile, DugnadEvent } from '@/lib/supabase/types'
import type { ZoneWithStatus } from '@/lib/hooks/useRealtimeZones'
import { MOCK_USER_ID } from './useMock'

// --- Profil ---
export const mockProfile: Profile = {
  id: MOCK_USER_ID,
  full_name: 'Tor Martin Norvik',
  email: 'tormartin@superponni.no',
  phone: '912 34 567',
  children: [{ name: 'Ella', group: 'Aspirant' }],
  role: 'admin',
  avatar_url: null,
  created_at: '2026-01-15T10:00:00Z',
  is_musician: false,
  musician_group: null,
}

// --- Hendelser ---
const today = new Date().toISOString().split('T')[0]

export const mockEvents: DugnadEvent[] = [
  {
    id: 'mock-event-1',
    title: 'Flaskeinnsamling Nord',
    type: 'bottle_collection',
    date: today,
    start_time: '10:00',
    end_time: '14:00',
    area: 'nord',
    status: 'active',
    description: 'Vårinnsamling 2026 — Nord-området',
    driver_notes: 'Husk å tømme henger ved Tiller VGS etter runde 2',
    created_by: MOCK_USER_ID,
    contact_phone: '912 34 567',
    bags_collected: null,
    completion_notes: null,
    meeting_point: null,
    send_push_on_activate: true,
  },
]

// Hendelser med progress for hjemmesiden
export interface MockEventWithProgress extends DugnadEvent {
  totalZones: number
  claimedZones: number
  completedZones: number
  totalNeeded: number
  totalClaims: number
}

export const mockEventsWithProgress: MockEventWithProgress[] = [
  {
    ...mockEvents[0],
    totalZones: 12,
    claimedZones: 8,
    completedZones: 3,
    totalNeeded: 24,
    totalClaims: 14,
  },
]

// --- Mine soner (hjemmesiden) ---
export interface MockMyZone {
  zoneId: string
  eventId: string
  zoneName: string
  area: string
  status: string
  eventTitle: string
  partnerName: string | null
}

export const mockMyZones: MockMyZone[] = [
  {
    zoneId: 'N3',
    eventId: 'mock-event-1',
    zoneName: 'Torvmyra',
    area: 'NORD',
    status: 'claimed',
    eventTitle: 'Flaskeinnsamling Nord',
    partnerName: 'Hilde Berntsen',
  },
  {
    zoneId: 'N7',
    eventId: 'mock-event-1',
    zoneName: 'Ivar Reitens veg',
    area: 'NORD',
    status: 'completed',
    eventTitle: 'Flaskeinnsamling Nord',
    partnerName: null,
  },
]

// --- Soner med status (kart + sjåfør) ---
// Vi trenger bare Nord-soner for dette scenariet
// Geometry er tomt — kartet bruker zones-data.ts for polygon-rendering
const emptyGeometry = {} as Record<string, unknown>

function makeZone(
  id: string,
  name: string,
  opts: {
    assignmentId?: string | null
    status?: ZoneWithStatus['status']
    claims?: ZoneWithStatus['claims']
    trailerGroup?: number
    households?: number
    collectorsNeeded?: number
  } = {}
): ZoneWithStatus {
  return {
    id,
    name,
    area: 'NORD',
    zone_type: 'bottle',
    households: opts.households ?? 80,
    collectors_needed: opts.collectorsNeeded ?? 2,
    trailer_group: opts.trailerGroup ?? 1,
    geometry: emptyGeometry,
    notes: null,
    flyers: null,
    posters: null,
    event_id: null,
    target_group: null,
    assignment_id: opts.assignmentId ?? `assign-${id}`,
    status: opts.status ?? 'available',
    claims: opts.claims ?? [],
  }
}

export const mockZones: ZoneWithStatus[] = [
  // Brukerens soner
  makeZone('N3', 'Torvmyra', {
    status: 'claimed',
    trailerGroup: 1,
    households: 95,
    claims: [
      { user_id: MOCK_USER_ID, full_name: 'Tor Martin Norvik', notes: null, phone: '912 34 567' },
      { user_id: 'user-2', full_name: 'Hilde Berntsen', notes: null, phone: '987 65 432' },
    ],
  }),
  makeZone('N7', 'Ivar Reitens veg', {
    status: 'completed',
    trailerGroup: 1,
    households: 65,
    claims: [
      { user_id: MOCK_USER_ID, full_name: 'Tor Martin Norvik', notes: 'Setter ut kl 10', phone: '912 34 567' },
    ],
    collectorsNeeded: 1,
  }),

  // Andre tatt av andre
  makeZone('N1', 'Porsmyra', {
    status: 'claimed',
    trailerGroup: 1,
    households: 110,
    claims: [
      { user_id: 'user-3', full_name: 'Lars Holm', notes: null, phone: '900 11 222' },
      { user_id: 'user-4', full_name: 'Kari Svendsen', notes: null, phone: '900 33 444' },
    ],
  }),
  makeZone('N2', 'Starrmyra', {
    status: 'completed',
    trailerGroup: 1,
    households: 70,
    claims: [
      { user_id: 'user-5', full_name: 'Arne Johansen', notes: null, phone: '911 22 333' },
      { user_id: 'user-6', full_name: 'Mette Dahl', notes: null, phone: '922 33 444' },
    ],
  }),

  // Delvis tatt (1 av 2)
  makeZone('N4', 'Moltmyra Vest', {
    status: 'claimed',
    trailerGroup: 2,
    households: 85,
    claims: [
      { user_id: 'user-7', full_name: 'Geir Pedersen', notes: null, phone: '933 44 555' },
    ],
  }),

  // Ferdig — venter på henting
  makeZone('N5', 'Moltmyra Øst', {
    status: 'completed',
    trailerGroup: 2,
    households: 90,
    claims: [
      { user_id: 'user-8', full_name: 'Silje Bakken', notes: '3 fulle sekker', phone: '944 55 666' },
      { user_id: 'user-9', full_name: 'Petter Olsen', notes: null, phone: '955 66 777' },
    ],
  }),
  makeZone('N6', 'Tonstad Park', {
    status: 'completed',
    trailerGroup: 2,
    households: 120,
    claims: [
      { user_id: 'user-10', full_name: 'Ingrid Aune', notes: 'Stod på hjørnet Tonstadringen', phone: '966 77 888' },
      { user_id: 'user-11', full_name: 'Kristian Berg', notes: null, phone: '977 88 999' },
    ],
  }),

  // Hentet
  makeZone('N8', 'Movollen', {
    status: 'picked_up',
    trailerGroup: 1,
    households: 55,
    claims: [
      { user_id: 'user-12', full_name: 'Torill Moe', notes: null, phone: '911 00 111' },
    ],
    collectorsNeeded: 1,
  }),

  // Ledige
  makeZone('N9', 'Harald Torps veg ++', {
    status: 'available',
    trailerGroup: 2,
    households: 100,
    claims: [],
  }),
  makeZone('N10', 'Movollflata og Tillerenga', {
    status: 'available',
    trailerGroup: 2,
    households: 130,
    claims: [],
  }),
  makeZone('N11', 'Tonstadbrinken Vest', {
    status: 'available',
    trailerGroup: 3,
    households: 75,
    claims: [],
  }),
  makeZone('N12', 'Tonstadbrinken Midt', {
    status: 'available',
    trailerGroup: 3,
    households: 60,
    claims: [],
  }),
]

// --- Sjåfør-data ---
export interface MockDriverZone {
  assignmentId: string
  eventId: string
  zoneId: string
  zoneName: string
  area: string
  status: string
  households: number
  trailerGroup: number
  collectors: Array<{ full_name: string | null; phone: string | null; notes: string | null }>
}

export interface MockTrailerGroup {
  area: string
  trailerGroup: number
  driverName: string | null
  zones: MockDriverZone[]
}

// Soner klare for henting (completed) og hentede (picked_up)
const completedZones: MockDriverZone[] = mockZones
  .filter(z => z.status === 'completed' || z.status === 'picked_up')
  .map(z => ({
    assignmentId: z.assignment_id!,
    eventId: 'mock-event-1',
    zoneId: z.id,
    zoneName: z.name,
    area: z.area,
    status: z.status,
    households: z.households,
    trailerGroup: z.trailer_group,
    collectors: z.claims.map(c => ({
      full_name: c.full_name,
      phone: c.phone,
      notes: c.notes,
    })),
  }))

export const mockDriverZones: MockDriverZone[] = completedZones

export const mockTrailerGroups: MockTrailerGroup[] = [
  {
    area: 'NORD',
    trailerGroup: 1,
    driverName: 'Tor Martin Norvik',
    zones: completedZones.filter(z => z.trailerGroup === 1),
  },
  {
    area: 'NORD',
    trailerGroup: 2,
    driverName: 'Ola Hansen',
    zones: completedZones.filter(z => z.trailerGroup === 2),
  },
  {
    area: 'NORD',
    trailerGroup: 3,
    driverName: null,
    zones: completedZones.filter(z => z.trailerGroup === 3),
  },
]

// --- Badges ---
// Badge-IDer som brukeren har opptjent (matcher badgeDefinitions)
export const mockBadgeCounts = new Map<number, number>([
  [16, 1], // Profil fullført
  [2, 1],  // Første sone
  [1, 1],  // Første dugnad fullført
  [3, 1],  // Sonemakker
])

// --- Profilhistorikk ---
export const mockHistory = [
  { title: 'Lappeutdeling Sør', date: '2026-04-06', zones: 2 },
  { title: 'Flaskeinnsamling Sør', date: '2026-03-15', zones: 3 },
]

// --- Ditt bidrag (korps-total for året) ---
export interface DittBidragData {
  sekkerPant: number
  lapperDeltUt: number
  kakerBakt: number
  premierSkaffet: number
  loddbokerSolgt: number
  dugnader: number
  kronerOpptjent: number
}

export const mockDittBidrag: DittBidragData = {
  sekkerPant: 126,
  lapperDeltUt: 3400,
  kakerBakt: 9,
  premierSkaffet: 42,
  loddbokerSolgt: 58,
  dugnader: 4,
  kronerOpptjent: 83000,
}
