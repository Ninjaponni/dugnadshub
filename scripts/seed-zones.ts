/**
 * Seeder soner og oppsamlingspunkter til Supabase fra GeoJSON-filer.
 *
 * Bruk: npx tsx scripts/seed-zones.ts
 *
 * Forutsetter:
 * 1. Du har kjørt convert-kml.ts først
 * 2. SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY er satt i miljøet
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Mangler SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY i miljøet')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function main() {
  // Les GeoJSON-filer
  const zonesData = JSON.parse(readFileSync(join(process.cwd(), 'lib/map/zones.geojson'), 'utf-8'))
  const dropPointsData = JSON.parse(readFileSync(join(process.cwd(), 'lib/map/drop-points.geojson'), 'utf-8'))

  console.log(`Seeder ${zonesData.features.length} soner...`)

  // Seed soner
  const zones = zonesData.features.map((f: { properties: Record<string, string>; geometry: unknown }) => ({
    id: f.properties.id,
    name: f.properties.name,
    area: f.properties.area,
    households: 0, // Fylles inn manuelt eller fra GATEOVERSIKT
    collectors_needed: 2,
    trailer_group: 1,
    geometry: f.geometry,
    notes: null,
  }))

  const { error: zonesError } = await supabase
    .from('zones')
    .upsert(zones, { onConflict: 'id' })

  if (zonesError) {
    console.error('Feil ved seeding av soner:', zonesError)
  } else {
    console.log(`  ✓ ${zones.length} soner seedet`)
  }

  // Seed oppsamlingspunkter
  console.log(`Seeder ${dropPointsData.features.length} oppsamlingspunkter...`)

  const dropPoints = dropPointsData.features.map((f: { properties: Record<string, string>; geometry: { coordinates: number[] } }) => ({
    id: f.properties.id,
    name: f.properties.name,
    area: f.properties.area,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
  }))

  const { error: dpError } = await supabase
    .from('drop_points')
    .upsert(dropPoints, { onConflict: 'id' })

  if (dpError) {
    console.error('Feil ved seeding av oppsamlingspunkter:', dpError)
  } else {
    console.log(`  ✓ ${dropPoints.length} oppsamlingspunkter seedet`)
  }

  console.log('\nFerdig!')
}

main().catch(console.error)
