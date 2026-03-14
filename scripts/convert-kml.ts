/**
 * Konverterer KML-filer til GeoJSON. Nord-filen har mapper for
 * "Tiller Nord", "Tiller Sør", "Oppsamling Nord", "Oppsamling Sør".
 *
 * Bruk: npx tsx scripts/convert-kml.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

interface GeoFeature {
  type: 'Feature'
  properties: Record<string, string>
  geometry: {
    type: 'Polygon' | 'Point'
    coordinates: number[] | number[][][]
  }
}

// Parser alle placemarks inni en Folder-blokk
function parsePlacemarks(block: string): GeoFeature[] {
  const features: GeoFeature[] = []
  const placemarkRegex = /<Placemark>([\s\S]*?)<\/Placemark>/g
  let match

  while ((match = placemarkRegex.exec(block)) !== null) {
    const pm = match[1]

    const nameMatch = pm.match(/<name>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/name>/)
    const name = nameMatch ? nameMatch[1].trim() : 'Ukjent'

    const descMatch = pm.match(/<description>([\s\S]*?)<\/description>/)
    const description = descMatch ? descMatch[1].trim() : ''

    const isPolygon = pm.includes('<Polygon>')
    const isPoint = pm.includes('<Point>')
    if (!isPolygon && !isPoint) continue

    const coordsMatch = pm.match(/<coordinates>([\s\S]*?)<\/coordinates>/)
    if (!coordsMatch) continue

    const coords = coordsMatch[1].trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((c) => {
        const [lng, lat] = c.split(',').map(Number)
        return [lng, lat]
      })

    if (isPoint && coords.length >= 1) {
      features.push({
        type: 'Feature',
        properties: { name, description },
        geometry: { type: 'Point', coordinates: coords[0] },
      })
    } else if (isPolygon && coords.length > 2) {
      features.push({
        type: 'Feature',
        properties: { name, description },
        geometry: { type: 'Polygon', coordinates: [coords] },
      })
    }
  }

  return features
}

// Finn en <Folder> med gitt navn og returner innholdet
function findFolder(kml: string, folderName: string): string | null {
  // Finn start av folder med dette navnet
  const nameTag = `<name>${folderName}</name>`
  const idx = kml.indexOf(nameTag)
  if (idx === -1) return null

  // Gå bakover til <Folder>
  const folderStart = kml.lastIndexOf('<Folder>', idx)
  if (folderStart === -1) return null

  // Finn matchende </Folder> — teller nesting
  let depth = 1
  let pos = kml.indexOf('>', folderStart) + 1
  while (depth > 0 && pos < kml.length) {
    const nextOpen = kml.indexOf('<Folder>', pos)
    const nextClose = kml.indexOf('</Folder>', pos)
    if (nextClose === -1) break
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++
      pos = nextOpen + 8
    } else {
      depth--
      if (depth === 0) {
        return kml.substring(folderStart, nextClose + 9)
      }
      pos = nextClose + 9
    }
  }
  return null
}

function main() {
  console.log('Konverterer KML → GeoJSON...\n')

  // Nord-filen har alt i mapper
  const kml = readFileSync('/tmp/tiller_nord.kmz', 'utf-8')

  // Hent mapper
  const nordBlock = findFolder(kml, 'Tiller Nord')
  const sorBlock = findFolder(kml, 'Tiller Sør')
  const dpNordBlock = findFolder(kml, 'Oppsamling Nord')
  const dpSorBlock = findFolder(kml, 'Oppsamling Sør')

  if (!nordBlock || !sorBlock) {
    console.error('Fant ikke Tiller Nord/Sør-mapper i KML!')
    process.exit(1)
  }

  // Parse features fra mapper
  const nordZones = parsePlacemarks(nordBlock!)
  const sorZones = parsePlacemarks(sorBlock!)
  const nordDPs = dpNordBlock ? parsePlacemarks(dpNordBlock) : []
  const sorDPs = dpSorBlock ? parsePlacemarks(dpSorBlock) : []

  console.log(`Nord: ${nordZones.length} soner, ${nordDPs.length} oppsamlingspunkter`)
  console.log(`Sør: ${sorZones.length} soner, ${sorDPs.length} oppsamlingspunkter`)

  // Tilordne IDer og område
  const zones: GeoFeature[] = []
  const dropPoints: GeoFeature[] = []

  nordZones.forEach((f, i) => {
    f.properties.id = `N${i + 1}`
    f.properties.area = 'NORD'
    zones.push(f)
  })

  sorZones.forEach((f, i) => {
    f.properties.id = `S${i + 1}`
    f.properties.area = 'SOR'
    zones.push(f)
  })

  nordDPs.forEach((f, i) => {
    f.properties.id = `DP-N-${i + 1}`
    f.properties.area = 'NORD'
    dropPoints.push(f)
  })

  sorDPs.forEach((f, i) => {
    f.properties.id = `DP-S-${i + 1}`
    f.properties.area = 'SOR'
    dropPoints.push(f)
  })

  console.log(`\nTotalt: ${zones.length} soner, ${dropPoints.length} oppsamlingspunkter`)

  // Skriv GeoJSON
  const outDir = join(process.cwd(), 'lib', 'map')
  mkdirSync(outDir, { recursive: true })

  writeFileSync(
    join(outDir, 'zones.geojson'),
    JSON.stringify({ type: 'FeatureCollection', features: zones }, null, 2)
  )

  writeFileSync(
    join(outDir, 'drop-points.geojson'),
    JSON.stringify({ type: 'FeatureCollection', features: dropPoints }, null, 2)
  )

  console.log('\nFiler skrevet:')
  console.log('  lib/map/zones.geojson')
  console.log('  lib/map/drop-points.geojson')

  console.log('\nSoner:')
  for (const z of zones) {
    const note = z.properties.description ? ` — ${z.properties.description}` : ''
    console.log(`  ${z.properties.id}: ${z.properties.name}${note}`)
  }

  console.log('\nOppsamlingspunkter:')
  for (const dp of dropPoints) {
    console.log(`  ${dp.properties.id}: ${dp.properties.name}`)
  }
}

main()
