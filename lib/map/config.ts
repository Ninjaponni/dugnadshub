// Kart-konfigurasjon for Tiller-området
export const MAP_CONFIG = {
  // Senter av Tiller (mellom Nord og Sør)
  center: [10.37, 63.36] as [number, number],
  zoom: 13,
  minZoom: 11,
  maxZoom: 18,
  // Mapbox-stiler
  style: 'mapbox://styles/mapbox/light-v11',
  darkStyle: 'mapbox://styles/mapbox/dark-v11',
  satelliteStyle: 'mapbox://styles/mapbox/satellite-streets-v12',
}

// Sonestatus-farger bor i lib/map/zone-colors.ts (én kilde)
