// Badges for dugnadsdeltakelse — nye kan legges til når som helst
export const badgeDefinitions = [
  // Startermerker
  { id: 1, name: 'Frøspire', icon: '🌱', category: 'starter' as const, description: 'Fullførte din første dugnad', auto_criteria: 'first_event' },
  { id: 2, name: 'Sonevelger', icon: '🗺️', category: 'starter' as const, description: 'Tok en sone for første gang', auto_criteria: 'first_zone_claim' },
  { id: 3, name: 'Makker', icon: '🤝', category: 'starter' as const, description: 'Fullførte sone med en partner', auto_criteria: 'paired_completion' },
  { id: 16, name: 'Profil-proffen', icon: '📝', category: 'starter' as const, description: 'Fylte ut profilen sin', auto_criteria: 'profile_complete' },

  // Vanlige merker
  { id: 4, name: 'Tre på rad', icon: '⭐', category: 'vanlig' as const, description: '3 dugnader fullført', auto_criteria: 'events_3' },
  { id: 5, name: 'Nordavansen', icon: '🧭', category: 'vanlig' as const, description: '5 soner i Nord', auto_criteria: 'nord_zones_5' },
  { id: 6, name: 'Sørvendt', icon: '🏔️', category: 'vanlig' as const, description: '5 soner i Sør', auto_criteria: 'sor_zones_5' },
  { id: 7, name: 'Regntett', icon: '🌧️', category: 'vanlig' as const, description: 'Stilte opp i dårlig vær', auto_criteria: null },

  // Veteranmerker
  { id: 8, name: 'Ringrev', icon: '🎖️', category: 'veteran' as const, description: '10 dugnader fullført', auto_criteria: 'events_10' },
  { id: 9, name: 'Heldekkende', icon: '🌍', category: 'veteran' as const, description: 'Minst én sone i hvert område', auto_criteria: 'both_areas' },
  { id: 10, name: 'Fadder', icon: '🎓', category: 'veteran' as const, description: 'Paret med nybegynner', auto_criteria: null },

  // Elitemerker
  { id: 11, name: 'Årets samler', icon: '🏆', category: 'elite' as const, description: 'Alle 4 innsamlinger i ett år', auto_criteria: 'all_yearly' },
  { id: 12, name: 'Maskin', icon: '💎', category: 'elite' as const, description: '20+ dugnader totalt', auto_criteria: 'events_20' },
  { id: 13, name: 'Legende', icon: '👑', category: 'elite' as const, description: 'Spesiell anerkjennelse', auto_criteria: null },

  // Rollemerker
  { id: 14, name: 'Sjåføren', icon: '🚗', category: 'rolle' as const, description: '10 hentinger som sjåfør', auto_criteria: 'driver_pickups_10' },
  { id: 15, name: 'Stripsern', icon: '🔧', category: 'rolle' as const, description: '5 ganger som stripser', auto_criteria: 'strapper_5' },

  // Aktivitetsmerker (kan gis flere ganger — vises som ×N)
  { id: 17, name: 'Kakeboss', icon: '🧁', category: 'aktivitet' as const, description: 'Bakte kake til dugnad', auto_criteria: null },
  { id: 18, name: 'Lappemester Nord', icon: '🚪', category: 'aktivitet' as const, description: 'Delte ut lapper i Nord', auto_criteria: null },
  { id: 19, name: 'Lykkehjulet', icon: '🎰', category: 'aktivitet' as const, description: 'Solgte lotteri', auto_criteria: null },
  { id: 20, name: 'Lappemester Sør', icon: '📬', category: 'aktivitet' as const, description: 'Delte ut lapper i Sør', auto_criteria: null },
  { id: 21, name: 'Saftansen', icon: '🧃', category: 'aktivitet' as const, description: 'Laget saft til dugnad', auto_criteria: null },
  { id: 22, name: 'Kaffansen', icon: '☕', category: 'aktivitet' as const, description: 'Kokte kaffe til dugnad', auto_criteria: null },
]
