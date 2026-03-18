// Kart-konfigurasjon for Tiller-området
export const MAP_CONFIG = {
  // Senter av Tiller (mellom Nord og Sør)
  center: [10.37, 63.36] as [number, number],
  zoom: 13,
  minZoom: 11,
  maxZoom: 18,
  // Mapbox-stiler
  style: 'mapbox://styles/mapbox/light-v11',
  satelliteStyle: 'mapbox://styles/mapbox/satellite-streets-v12',
}

// Statusfarger for sonepolygoner
export const ZONE_COLORS: Record<string, string> = {
  available: '#EF4444',   // Rød — ledig
  claimed: '#F59E0B',     // Gul — delvis tatt
  in_progress: '#F59E0B', // Gul — pågår
  completed: '#22C55E',   // Grønn — ferdig
  picked_up: '#8B5CF6',   // Lilla — hentet
}

// Opacity for sonepolygoner
export const ZONE_OPACITY: Record<string, number> = {
  available: 0.25,
  claimed: 0.35,
  in_progress: 0.4,
  completed: 0.35,
  picked_up: 0.3,
}
