// KMZ-parser for plastdugnad-soner
// KMZ er en zip-fil som inneholder en KML (XML) — vi henter ut polygoner og møteplass-punkt
import JSZip from 'jszip'
import { XMLParser } from 'fast-xml-parser'

export interface ParsedPlastZone {
  // Beskrivende navn fra KML (f.eks. "Sone 1")
  raw_name: string
  // Beskrivelse fra KML (f.eks. "Plukkes av HK gruppe 1")
  description: string
  // Mappet target_group ('Hovedkorps-1', 'Junior 1', osv.)
  target_group: string
  // GeoJSON Polygon
  geometry: {
    type: 'Polygon'
    coordinates: number[][][]
  }
}

export interface ParsedKmz {
  zones: ParsedPlastZone[]
  meeting_point: {
    lng: number
    lat: number
    name: string
    description: string
  } | null
}

// Mapper KML-beskrivelse til target_group brukt i zones-tabellen
function descriptionToTargetGroup(desc: string): string {
  const d = desc.toLowerCase().replace(/\s+/g, ' ').trim()
  if (d.includes('hk gruppe 1') || d.includes('hovedkorps gruppe 1') || d.includes('hovedkorps-1')) return 'Hovedkorps-1'
  if (d.includes('hk gruppe 2') || d.includes('hovedkorps gruppe 2') || d.includes('hovedkorps-2')) return 'Hovedkorps-2'
  if (d.includes('hk gruppe 3') || d.includes('hovedkorps gruppe 3') || d.includes('hovedkorps-3')) return 'Hovedkorps-3'
  if (d.includes('jk 1') || d.includes('jk1') || d.includes('junior 1')) return 'Junior 1'
  if (d.includes('jk 2') || d.includes('jk2') || d.includes('junior 2')) return 'Junior 2'
  if (d.includes('aspirant') || d === 'plukkes av ak' || d.includes(' ak')) return 'Aspirantkorps'
  return 'Ukjent'
}

// Konverterer KML-koordinatstreng "lng,lat,alt lng,lat,alt ..." til GeoJSON [[lng, lat], ...]
function parseCoordinates(coordStr: string): number[][] {
  return coordStr.trim().split(/\s+/).map(triplet => {
    const [lng, lat] = triplet.split(',').map(Number)
    return [lng, lat]
  })
}

export async function parseKmz(file: File | Blob): Promise<ParsedKmz> {
  const zip = await JSZip.loadAsync(file)
  // KMZ inneholder typisk doc.kml
  const kmlFile = zip.file('doc.kml') || Object.values(zip.files).find(f => f.name.endsWith('.kml'))
  if (!kmlFile) throw new Error('Fant ingen .kml-fil i KMZ-en')

  const kmlText = await kmlFile.async('text')
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    trimValues: true,
  })
  const kml = parser.parse(kmlText)

  // KML kan ha struktur: kml > Document > Folder > Placemark, eller kml > Document > Placemark
  // Bruk en flat søk etter alle Placemark-noder
  const placemarks: Array<{ name?: string; description?: string; Point?: { coordinates: string }; Polygon?: { outerBoundaryIs: { LinearRing: { coordinates: string } } }; MultiGeometry?: unknown }> = []

  function walk(node: unknown) {
    if (!node || typeof node !== 'object') return
    const obj = node as Record<string, unknown>
    if (obj.Placemark) {
      const pms = Array.isArray(obj.Placemark) ? obj.Placemark : [obj.Placemark]
      placemarks.push(...(pms as typeof placemarks))
    }
    for (const key of Object.keys(obj)) {
      if (key !== 'Placemark') walk(obj[key])
    }
  }
  walk(kml)

  const zones: ParsedPlastZone[] = []
  let meeting_point: ParsedKmz['meeting_point'] = null

  for (const pm of placemarks) {
    const name = pm.name || ''
    const description = pm.description || ''

    if (pm.Point?.coordinates) {
      const [lng, lat] = pm.Point.coordinates.trim().split(',').map(Number)
      meeting_point = {
        lng,
        lat,
        name: name || 'Møteplass',
        description: description || '',
      }
    } else if (pm.Polygon?.outerBoundaryIs?.LinearRing?.coordinates) {
      const coords = parseCoordinates(pm.Polygon.outerBoundaryIs.LinearRing.coordinates)
      zones.push({
        raw_name: name,
        description,
        target_group: descriptionToTargetGroup(description),
        geometry: {
          type: 'Polygon',
          coordinates: [coords],
        },
      })
    }
  }

  return { zones, meeting_point }
}
