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

// Statusfarger for sonepolygoner — varm palett
export const ZONE_COLORS: Record<string, string> = {
  available: '#E57373',   // Varm rød — ledig
  claimed: '#FFD54F',     // Varm gul — delvis tatt
  in_progress: '#FFD54F', // Varm gul — pågår
  completed: '#6B8F71',   // Dempet grønn — ferdig
  picked_up: '#9C7DB8',   // Varm lilla — hentet
}

// Opacity for sonepolygoner
export const ZONE_OPACITY: Record<string, number> = {
  available: 0.25,
  claimed: 0.35,
  in_progress: 0.4,
  completed: 0.35,
  picked_up: 0.3,
}
