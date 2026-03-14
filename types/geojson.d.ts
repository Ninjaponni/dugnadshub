// Tillat import av .geojson-filer som moduler
declare module '*.geojson' {
  const value: GeoJSON.FeatureCollection
  export default value
}

// GeoJSON-typer (forenklet)
declare namespace GeoJSON {
  interface FeatureCollection {
    type: 'FeatureCollection'
    features: Feature[]
  }
  interface Feature {
    type: 'Feature'
    properties: Record<string, unknown> | null
    geometry: Geometry
  }
  type Geometry = Point | Polygon | MultiPolygon
  interface Point {
    type: 'Point'
    coordinates: [number, number]
  }
  interface Polygon {
    type: 'Polygon'
    coordinates: number[][][]
  }
  interface MultiPolygon {
    type: 'MultiPolygon'
    coordinates: number[][][][]
  }
}
