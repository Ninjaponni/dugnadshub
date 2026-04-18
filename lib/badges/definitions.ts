// Badges for dugnadsdeltakelse — nye kan legges til når som helst
// icon = sti til bilde i /public/badges/
export const badgeDefinitions = [
  // Startermerker
  { id: 1, name: 'Frøspire', icon: '/badges/frospire.png', category: 'starter' as const, description: 'Fullførte din første dugnad', auto_criteria: 'first_event' },
  { id: 2, name: 'Sonevelger', icon: '/badges/sonevelger.png', category: 'starter' as const, description: 'Tok en sone for første gang', auto_criteria: 'first_zone_claim' },
  { id: 3, name: 'Makker', icon: '/badges/makker.png', category: 'starter' as const, description: 'Fullførte sone med en partner', auto_criteria: 'paired_completion' },
  { id: 16, name: 'Profil-proffen', icon: '/badges/profil-proffen.png', category: 'starter' as const, description: 'Fylte ut profilen sin', auto_criteria: 'profile_complete' },

  // Vanlige merker
  { id: 4, name: 'Tre på rad', icon: '/badges/tre-pa-rad.png', category: 'vanlig' as const, description: '3 dugnader fullført', auto_criteria: 'events_3' },
  { id: 5, name: 'Nordavansen', icon: '/badges/nordavansen.png', category: 'vanlig' as const, description: '5 soner i Nord', auto_criteria: 'nord_zones_5' },
  { id: 6, name: 'Sørvendt', icon: '/badges/sorvendt.png', category: 'vanlig' as const, description: '5 soner i Sør', auto_criteria: 'sor_zones_5' },
  { id: 7, name: 'Regntett', icon: '/badges/regntett.png', category: 'vanlig' as const, description: 'Stilte opp i dårlig vær', auto_criteria: null },

  // Veteranmerker
  { id: 8, name: 'Ringrev', icon: '/badges/ringrev.png', category: 'veteran' as const, description: '10 dugnader fullført', auto_criteria: 'events_10' },
  { id: 9, name: 'Heldekkende', icon: '/badges/heldekkende.png', category: 'veteran' as const, description: 'Minst én sone i hvert område', auto_criteria: 'both_areas' },
  { id: 10, name: 'Fadder', icon: '/badges/fadder.png', category: 'veteran' as const, description: 'Paret med nybegynner', auto_criteria: null },

  // Elitemerker
  { id: 11, name: 'Årets samler', icon: '/badges/arets-samler.png', category: 'elite' as const, description: 'Alle 4 innsamlinger i ett år', auto_criteria: 'all_yearly' },
  { id: 12, name: 'Maskin', icon: '/badges/maskin.png', category: 'elite' as const, description: '20+ dugnader totalt', auto_criteria: 'events_20' },
  { id: 13, name: 'Legende', icon: '/badges/legende.png', category: 'elite' as const, description: 'Spesiell anerkjennelse', auto_criteria: null },

  // Rollemerker (tildeles manuelt, kan gis flere ganger)
  { id: 14, name: 'Sjåføren', icon: '/badges/sjaforen.png', category: 'aktivitet' as const, description: 'Kjørte henting som sjåfør', auto_criteria: null },
  { id: 15, name: 'Stripsern', icon: '/badges/stripsern.png', category: 'aktivitet' as const, description: 'Stripset som stripser', auto_criteria: null },

  // Aktivitetsmerker (kan gis flere ganger — vises som ×N)
  { id: 17, name: 'Kakeboss', icon: '/badges/kakeboss.png', category: 'aktivitet' as const, description: 'Bakte kake til dugnad', auto_criteria: null },
  { id: 18, name: 'Lappemester Nord', icon: '/badges/lappemester-nord.png', category: 'aktivitet' as const, description: 'Delte ut lapper i Nord', auto_criteria: null },
  { id: 19, name: 'Lykkehjulet', icon: '/badges/lykkehjulet.png', category: 'aktivitet' as const, description: 'Solgte lotteri', auto_criteria: null },
  { id: 20, name: 'Lappemester Sør', icon: '/badges/lappemester-sor.png', category: 'aktivitet' as const, description: 'Delte ut lapper i Sør', auto_criteria: null },
  { id: 21, name: 'Saftansen', icon: '/badges/saftansen.png', category: 'aktivitet' as const, description: 'Laget saft til dugnad', auto_criteria: null },
  { id: 22, name: 'Kaffansen', icon: '/badges/kaffansen.png', category: 'aktivitet' as const, description: 'Kokte kaffe til dugnad', auto_criteria: null },
  { id: 23, name: 'Premieskaffer', icon: '/badges/premieskaffer.png', category: 'aktivitet' as const, description: 'Skaffet premier til lotteri', auto_criteria: null },
  { id: 24, name: 'Flaskesekk-oppbevarer', icon: '/badges/flaskesekkoppbevarer.png', category: 'aktivitet' as const, description: 'Oppbevarte flaskesekker hjemme', auto_criteria: null },
]
