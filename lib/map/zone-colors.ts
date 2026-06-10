// Sonestatus-farger — ÉN kilde for hex-verdiene som før var hardkodet i både
// ZoneLayer (Mapbox krever rene hex, ikke CSS-variabler) og MapInfoSheet
// (legenden). Speiler --color-zone-*-tokens i app/globals.css; endrer du her,
// endre der også.
export const ZONE_COLORS = {
  available: '#E57373', // ledig (rød)
  partial: '#FFD54F', // delvis tatt (gul)
  full: '#5C9CE6', // fullt bemannet (blå)
  completed: '#6B8F71', // ferdigplukket/levert/ryddet (grønn)
  pickedUp: '#9C7DB8', // hentet av sjåfør (lilla)
} as const
