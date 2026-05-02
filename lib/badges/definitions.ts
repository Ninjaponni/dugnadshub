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
  { id: 14, name: 'Sjåføren', icon: '/badges/sjaforen.png', category: 'aktivitet' as const, description: 'Driving Miss Pant', auto_criteria: null },
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
  { id: 25, name: 'Stormpanter', icon: '/badges/stormpanter.png', category: 'aktivitet' as const, description: 'Stilte opp i storm og kuling', auto_criteria: null },
  { id: 26, name: 'Solpanter', icon: '/badges/solpanter.png', category: 'aktivitet' as const, description: 'Samlet flasker i strålende solskinn', auto_criteria: null },
  { id: 27, name: 'Snøpanter', icon: '/badges/snopanter.png', category: 'aktivitet' as const, description: 'Trasket gjennom snøen for korpset', auto_criteria: null },
  { id: 28, name: 'Førstemann', icon: '/badges/forstemann.png', category: 'aktivitet' as const, description: 'Først ute med å ta en sone', auto_criteria: 'first_zone_in_event' },

  // 17. mai-merker (manuelt tildelt rundt nasjonaldagen)
  { id: 29, name: 'Hurra-helten', icon: '/badges/hurra-helten.png', category: '17mai' as const, description: 'Bidro på korpsets 17. mai-dugnad', auto_criteria: null },
  { id: 30, name: 'Festkakebaker', icon: '/badges/festkakebaker.png', category: '17mai' as const, description: 'Bakte og leverte kake til 17. mai', auto_criteria: null },
  { id: 31, name: 'Kioskløve', icon: '/badges/kiosklove.png', category: '17mai' as const, description: 'Bemannet kiosk på 17. mai', auto_criteria: null },
  { id: 32, name: 'Kjøkkengeneral', icon: '/badges/kjokkengeneral.png', category: '17mai' as const, description: 'Sto i kjøkkenet og holdt hjulene i gang', auto_criteria: null },
  { id: 33, name: 'Riggemester', icon: '/badges/riggemester.png', category: '17mai' as const, description: 'Rigget skolen kvelden før 17. mai', auto_criteria: null },
  { id: 34, name: 'Ryddesjef', icon: '/badges/ryddesjef.png', category: '17mai' as const, description: 'Ryddet og vasket etter endt dugnad', auto_criteria: null },
  { id: 35, name: 'Springer', icon: '/badges/springer.png', category: '17mai' as const, description: 'Sprang mellom kiosk og kjøkken med påfyll', auto_criteria: null },
  { id: 36, name: 'Skolesjefen', icon: '/badges/skolesjefen.png', category: '17mai' as const, description: 'Var skoleansvarlig på sin skole', auto_criteria: null },
  { id: 37, name: 'Vareherre', icon: '/badges/vareherre.png', category: '17mai' as const, description: 'Sørget for innkjøp og distribusjon', auto_criteria: null },
  { id: 38, name: 'Tilhengerhelten', icon: '/badges/tilhengerhelten.png', category: '17mai' as const, description: 'Kjørte henger fullastet med varer', auto_criteria: null },
  { id: 39, name: 'Togsjef', icon: '/badges/togsjef.png', category: '17mai' as const, description: 'Ledet barnetoget på 17. mai', auto_criteria: null },
  { id: 40, name: 'Fanebærer', icon: '/badges/fanebaerer.png', category: '17mai' as const, description: 'Bar fanen i 17. mai-toget', auto_criteria: null },
  { id: 41, name: 'Pakkemester', icon: '/badges/pakkemester.png', category: '17mai' as const, description: 'Pakket varer på pakkedugnaden', auto_criteria: null },
  { id: 42, name: 'Portøren', icon: '/badges/portor.png', category: '17mai' as const, description: 'Sørget for trygg frakt av brus uten å bryte plasten', auto_criteria: null },

  // Konfirmasjonsspilling og innhopp (kan stables ×N)
  { id: 43, name: 'Konfirmasjonsfaneren', icon: '/badges/konfirmasjonsfaneren.png', category: 'aktivitet' as const, description: 'Bar fanen på konfirmasjonsspilling', auto_criteria: null },
  { id: 44, name: 'Stortrommeren', icon: '/badges/stortrommeren.png', category: 'aktivitet' as const, description: 'Steppet inn og spilte stortromma', auto_criteria: null },

  // Styret (manuelt tildelt, kan stables ×N år)
  { id: 45, name: 'Leder', icon: '/badges/leder.png', category: 'styret' as const, description: 'Korpsleder', auto_criteria: null },
  { id: 46, name: 'Nestleder', icon: '/badges/nestleder.png', category: 'styret' as const, description: 'Nestleder i styret', auto_criteria: null },
  { id: 47, name: 'Sekretær', icon: '/badges/sekretaer.png', category: 'styret' as const, description: 'Skriver møtereferater og holder orden', auto_criteria: null },
  { id: 48, name: 'Kasserer', icon: '/badges/kasserer.png', category: 'styret' as const, description: 'Holder orden på korpsets økonomi', auto_criteria: null },
  { id: 49, name: 'Styremedlem', icon: '/badges/styremedlem.png', category: 'styret' as const, description: 'Sitter i korpsstyret', auto_criteria: null },
  { id: 50, name: 'Varamedlem', icon: '/badges/varamedlem.png', category: 'styret' as const, description: 'Vara i korpsstyret', auto_criteria: null },
  { id: 51, name: 'Materialforvalter', icon: '/badges/materialforvalter.png', category: 'styret' as const, description: 'Tar vare på uniformer, noter og annet utstyr', auto_criteria: null },
  { id: 52, name: 'Instrumentansvarlig', icon: '/badges/instrumentansvarlig.png', category: 'styret' as const, description: 'Holder orden på instrumentparken', auto_criteria: null },
  { id: 53, name: 'Dugnadsansvarlig', icon: '/badges/dugnadsansvarlig.png', category: 'styret' as const, description: 'Koordinerer korpsets dugnader', auto_criteria: null },

  // Komitéer (manuelt tildelt, kan stables ×N år)
  { id: 54, name: 'Uniformskomiteen', icon: '/badges/uniformskomiteen.png', category: 'komite' as const, description: 'Sittet i uniformskomiteen', auto_criteria: null },
  { id: 55, name: 'Valgkomiteen', icon: '/badges/valgkomiteen.png', category: 'komite' as const, description: 'Sittet i valgkomiteen', auto_criteria: null },
  { id: 56, name: 'Turkomiteen', icon: '/badges/turkomiteen.png', category: 'komite' as const, description: 'Sittet i turkomiteen', auto_criteria: null },
  { id: 57, name: 'Steinkjerspællkomiteen', icon: '/badges/steinkjerspaellkomiteen.png', category: 'komite' as const, description: 'Sittet i steinkjerspællkomiteen', auto_criteria: null },
  { id: 58, name: '17. mai-komiteen', icon: '/badges/17mai-komiteen.png', category: 'komite' as const, description: 'Sittet i 17. mai-komiteen', auto_criteria: null },

  // Vakter (manuelt tildelt, kan stables ×N)
  { id: 59, name: 'Styrevakta', icon: '/badges/styrevakta.png', category: 'vakt' as const, description: 'Hadde styrevakt på øvelseskvelder', auto_criteria: null },
  { id: 60, name: 'Korpsvakten', icon: '/badges/korpsvakten.png', category: 'vakt' as const, description: 'Hadde foreldrevakt under øvelse (AK/JK/HK)', auto_criteria: null },
  { id: 61, name: 'Vaffelvakta', icon: '/badges/vaffelvakta.png', category: 'vakt' as const, description: 'Stekte vafler på vaffeltorsdag', auto_criteria: null },
]
