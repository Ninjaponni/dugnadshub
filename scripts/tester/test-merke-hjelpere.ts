// Test av lib/badges/earned.ts. Kjør: npx tsx scripts/tester/test-merke-hjelpere.ts
import assert from 'node:assert/strict'
import {
  toEarnedRow, countByBadge, sourcesByBadge, hasEventSources,
  unseenBadgeIds, unseenTotal, legacySeenCounts, formatBadgeDate,
  type EarnedBadgeRow,
} from '../../lib/badges/earned'

const rader: EarnedBadgeRow[] = [
  { badge_id: 86, awarded_at: '2026-10-13T08:00:00Z', event_title: 'Flaskeinnsamling NORD', event_date: '2026-10-12', zone_name: 'Sone A' },
  { badge_id: 86, awarded_at: '2026-10-13T08:00:00Z', event_title: 'Flaskeinnsamling Sør', event_date: '2026-09-28', zone_name: 'Sone B' },
  { badge_id: 18, awarded_at: '2026-03-31T10:00:00Z', event_title: 'Lappeutdeling NORD', event_date: '2026-04-07', zone_name: 'Sone C' },
  { badge_id: 1, awarded_at: '2026-04-01T10:00:00Z', event_title: null, event_date: null, zone_name: null },
]

// toEarnedRow: innebygde objekter fra PostgREST, også når de mangler
assert.deepEqual(
  toEarnedRow({ badge_id: 86, awarded_at: 'x', event_id: 'e', zone_assignment_id: 'z',
    events: { title: 'T', date: '2026-10-12' }, zone_assignments: { zones: { name: 'S' } } }),
  { badge_id: 86, awarded_at: 'x', event_title: 'T', event_date: '2026-10-12', zone_name: 'S' })
assert.deepEqual(
  toEarnedRow({ badge_id: 1, awarded_at: 'y', event_id: null, zone_assignment_id: null, events: null, zone_assignments: null }),
  { badge_id: 1, awarded_at: 'y', event_title: null, event_date: null, zone_name: null })

// countByBadge
assert.deepEqual([...countByBadge(rader)].sort((a, b) => a[0] - b[0]), [[1, 1], [18, 1], [86, 2]])

// sourcesByBadge: nyeste dugnad først
const kilder = sourcesByBadge(rader)
assert.deepEqual(kilder.get(86)!.map(k => k.eventDate), ['2026-10-12', '2026-09-28'])
assert.equal(kilder.get(86)![0].zoneName, 'Sone A')
assert.equal(hasEventSources(kilder.get(86)!), true)
assert.equal(hasEventSources(kilder.get(1)!), false)

// Ulest: nytt eksemplar av et merke man har fra før gir prikk
const antall = new Map([[86, 2], [18, 1], [1, 1]])
assert.deepEqual(unseenBadgeIds(antall, { 86: 1, 18: 1, 1: 1 }), [86])
assert.equal(unseenTotal(antall, { 86: 1, 18: 1, 1: 1 }), 1)
assert.equal(unseenTotal(antall, {}), 4)
assert.deepEqual(unseenBadgeIds(antall, { 86: 2, 18: 1, 1: 1 }), [])

// Gammel lagring: rader før skjæringstidspunktet regnes som sett for merker man hadde sett
const gamle = legacySeenCounts(rader, [86, 18, 1], '2026-10-12T00:00:00+02:00')
assert.deepEqual(gamle, { 86: 1, 18: 1, 1: 1 }) // 86 fikk ingen rader før skjæringen, men var sett: minst 1
assert.deepEqual(legacySeenCounts(rader, [1], '2026-10-12T00:00:00+02:00'), { 1: 1 })

// Dato
assert.equal(formatBadgeDate('2026-10-12'), '12. okt. 2026')

console.log('Alle tester OK')
