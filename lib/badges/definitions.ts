// 15 meningsfulle badges for dugnadsdeltakelse
export const badgeDefinitions = [
  // Startermerker
  { id: 1, name: 'Spire', icon: '🌱', category: 'starter' as const, description: 'Fullførte din første dugnad', auto_criteria: 'first_event' },
  { id: 2, name: 'Kartleser', icon: '🗺️', category: 'starter' as const, description: 'Tok en sone for første gang', auto_criteria: 'first_zone_claim' },
  { id: 3, name: 'Lagspiller', icon: '🤝', category: 'starter' as const, description: 'Fullførte sone med en partner', auto_criteria: 'paired_completion' },

  // Vanlige merker
  { id: 4, name: 'Dugnadssoldat', icon: '⭐', category: 'vanlig' as const, description: '3 dugnader fullført', auto_criteria: 'events_3' },
  { id: 5, name: 'Nordmester', icon: '🧭', category: 'vanlig' as const, description: '5 soner i Nord', auto_criteria: 'nord_zones_5' },
  { id: 6, name: 'Sørmester', icon: '🏔️', category: 'vanlig' as const, description: '5 soner i Sør', auto_criteria: 'sor_zones_5' },
  { id: 7, name: 'Regnvæksjer', icon: '🌧️', category: 'vanlig' as const, description: 'Stilte opp i dårlig vær (admin-tildelt)', auto_criteria: null },

  // Veteranmerker
  { id: 8, name: 'Veteran', icon: '🎖️', category: 'veteran' as const, description: '10 dugnader fullført', auto_criteria: 'events_10' },
  { id: 9, name: 'Alle soner', icon: '🌍', category: 'veteran' as const, description: 'Minst én sone i hvert område', auto_criteria: 'both_areas' },
  { id: 10, name: 'Mentor', icon: '🎓', category: 'veteran' as const, description: 'Paret med nybegynner (admin-tildelt)', auto_criteria: null },

  // Elitemerker
  { id: 11, name: 'Årgangsamler', icon: '🏆', category: 'elite' as const, description: 'Alle 4 innsamlinger i ett år', auto_criteria: 'all_yearly' },
  { id: 12, name: 'Ustoppelig', icon: '💎', category: 'elite' as const, description: '20+ dugnader totalt', auto_criteria: 'events_20' },
  { id: 13, name: 'Legende', icon: '👑', category: 'elite' as const, description: 'Spesiell anerkjennelse (admin-tildelt)', auto_criteria: null },

  // Rollemerker
  { id: 14, name: 'Veiviser', icon: '🚗', category: 'rolle' as const, description: '10 hentinger som sjåfør', auto_criteria: 'driver_pickups_10' },
  { id: 15, name: 'Stripsemester', icon: '🔧', category: 'rolle' as const, description: '5 ganger som stripser', auto_criteria: 'strapper_5' },
]
