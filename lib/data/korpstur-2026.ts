// Korpstur 2026 — Lillehammerfestivalen 12.–14. juni.
// Statisk innhold for /tur-siden, hentet fra turkomiteens infoskriv (juni 2026)
// + nattevakt-fordelingen. Oppdater her ved endringer; siden leser kun denne fila.

export type ProgramItem = {
  time: string // 'HH:MM' eller '' for punkter uten klokkeslett
  title: string
  detail?: string
  highlight?: boolean // accent-markering (oppmøtetider o.l.)
}

export type ProgramDay = {
  id: string
  label: string // 'Fredag 12. juni'
  shortLabel: string // 'FRE 12'
  items: ProgramItem[]
}

export const turMeta = {
  title: 'Korpstur til Lillehammerfestivalen',
  dates: '12.–14. juni',
  stats: [
    ['Oppmøte', 'Fre 15:00 · Tonstad'],
    ['Hjemme', 'Søn ca. 23:00'],
    ['Overnatting', 'Åretta ungdomsskole'],
  ] as Array<[string, string]>,
}

export const program: ProgramDay[] = [
  {
    id: 'fredag',
    label: 'Fredag 12. juni',
    shortLabel: 'FRE 12',
    items: [
      { time: '15:00', title: 'Oppmøte Tonstad skole', detail: 'Avreise så snart buss, korpshenger og biler er pakket. Rinas passasjerer har egne avtaler.', highlight: true },
      { time: '', title: 'Matpakke på bussen', detail: 'Ingen matservering på veien. Matboksen kan gjenbrukes til smørelunsj lørdag og søndag.' },
      { time: '', title: 'Kveldsmat ved ankomst', detail: 'Åretta ungdomsskole. Romfordeling og innkvartering.' },
      { time: '23:00', title: 'Infomøte for nattevaktene', detail: 'På Åretta. Ole Petter kjører egen bil og rekker frem selv om bussen blir forsinket.', highlight: true },
    ],
  },
  {
    id: 'lordag',
    label: 'Lørdag 13. juni',
    shortLabel: 'LØR 13',
    items: [
      { time: '', title: 'Frokost + smør lunsjpakke', detail: 'Alle smører egen matpakke under frokosten. Legges i eske merket med korpsets navn, leveres ut til lunsj. Drikke ordnes av festivalen.' },
      { time: '', title: 'Parade og innmarsj' },
      { time: '', title: 'Konsert på Terrassen', detail: 'Sammen med fire andre korps, rett etter paraden.', highlight: true },
      { time: '', title: 'Leker, underholdning og middag', detail: 'På Åretta utover kvelden.' },
    ],
  },
  {
    id: 'sondag',
    label: 'Søndag 14. juni',
    shortLabel: 'SØN 14',
    items: [
      { time: '', title: 'Frokost + smør lunsjpakke', detail: 'Samme opplegg som lørdag — matpakken leveres ut i parken.' },
      { time: '', title: 'Pakking og rydding', detail: 'Alt ut av klasserommene før avreise.' },
      { time: '10:00', title: 'Oppmøte Hunderfossen', detail: 'Korps-t-skjorte som uniform, så slipper vi å skifte før lek og moro.', highlight: true },
      { time: '', title: 'Parade i parken', detail: 'Marsjering i korps-t-skjorte. Husk instrument og notestativ!' },
      { time: '', title: 'Lek i parken', detail: 'Felles møtepunkt med voksne fra korpset. Alle som vil og trenger får gå sammen med en voksen.' },
      { time: '16:30', title: 'Avreise fra parken', detail: 'Parken stenger 17:00, men logistikken krever avreise 16:30.', highlight: true },
      { time: '', title: 'Middag på Oppdal' },
      { time: '23:00', title: 'Tilbake på Tonstad skole', detail: 'Senest. Nøyaktig tidspunkt varsles på foreldresiden på Facebook.' },
    ],
  },
]

// Nattevakter — festivalen tildelte korpset KUN disse to vaktene,
// begge natt til lørdag. Natt til søndag har korpset ingen vakter.
export const nattevakter = [
  { time: '23:00–03:00', name: 'Ole Petter', note: 'Kjører egen bil og er fremme før bussen' },
  { time: '03:00–06:30', name: 'Tor Martin' },
]

// Personlig ansvar — matches mot innlogget brukers telefonnummer.
// Vises i «Ditt ansvar»-blokken øverst.
export const ansvar: Array<{ phone: string; lines: string[] }> = [
  { phone: '93066213', lines: ['Nattevakt 1 · natt til lørdag · 23:00–03:00', 'Infomøte kl. 23:00 på Åretta', 'Brief Tor Martin på opplegget hvis bussen ikke rekker frem til møtet'] },
  { phone: '91351290', lines: ['Nattevakt 2 · natt til lørdag · 03:00–06:30', 'Ole Petter brifer deg etter infomøtet hvis bussen er forsinket'] },
  { phone: '98849029', lines: ['Romansvarlig · Rom 1'] },
  { phone: '97034895', lines: ['Romansvarlig · Rom 2', 'Logistikk, turregler og mobilhotell'] },
  { phone: '99712460', lines: ['Romansvarlig · Rom 3', 'Kjører egen bil med senere avreise (egne avtaler med passasjerene)'] },
  { phone: '93614200', lines: ['Romansvarlig · Rom 4'] },
  { phone: '93027902', lines: ['Bussjåfør på korpstur'] },
  { phone: '91580826', lines: ['Turleder · vara beredskapsansvarlig'] },
  { phone: '45665959', lines: ['Ansvar for mat, allergier og behov knyttet til dette'] },
  { phone: '99104938', lines: ['Ansvar for helse og beredskap'] },
]

export type Rom = {
  navn: string
  ansvarlig: string
  voksne: string[]
  barn: Array<{ navn: string; gruppe: string }>
}

export const rom: Rom[] = [
  {
    navn: 'Rom 1',
    ansvarlig: 'Tove',
    voksne: ['Tove (romansvarlig)', 'Marit', 'Therese', '(Vinay Gautam)'],
    barn: [
      { navn: 'Anton Bakke', gruppe: 'AK' },
      { navn: 'Petter Andreas Larsen', gruppe: 'AK' },
      { navn: 'Ylva Krogsæter Aaen', gruppe: 'AK' },
      { navn: 'Tuva Gule Oterhals', gruppe: 'AK' },
      { navn: 'Mia Nikoline Myrhaug', gruppe: 'AK' },
      { navn: 'Erling Kotsbakk Bollingmo', gruppe: 'AK' },
      { navn: 'Pernille Grønning Sølberg', gruppe: 'AK' },
      { navn: 'Reyansh Gautam', gruppe: 'AK' },
    ],
  },
  {
    navn: 'Rom 2',
    ansvarlig: 'Arne Olav',
    voksne: ['Arne Olav (romansvarlig)', 'Kine', 'Ole Petter', '(Maria R)', '(Kristin Belsaas)'],
    barn: [
      { navn: 'Simon Eliasander Regli', gruppe: 'AK' },
      { navn: 'Erik Harborg Rustad', gruppe: 'JK' },
      { navn: 'Magnus Thuestad', gruppe: 'JK' },
      { navn: 'Idun Krogsæter Aaen', gruppe: 'JK' },
      { navn: 'Arn Aakvik Jørgensen', gruppe: 'JK' },
      { navn: 'Zara Lovise Salvesen', gruppe: 'JK' },
      { navn: 'Johannes Skavlan', gruppe: 'JK' },
      { navn: 'Peder Klingen Talgø', gruppe: 'JK' },
      { navn: 'Jonas Heggvik', gruppe: 'JK' },
      { navn: 'Alma Løhre-Walberg', gruppe: 'JK' },
      { navn: 'Kristoffer A. Belsaas', gruppe: 'JK' },
      { navn: 'Arwen van Everdink Brandslet', gruppe: 'JK' },
      { navn: 'Ingrid L Wågseth', gruppe: 'JK' },
      { navn: 'Inga Niemiec', gruppe: 'JK' },
      { navn: 'Mardin Golabi', gruppe: 'JK' },
    ],
  },
  {
    navn: 'Rom 3',
    ansvarlig: 'Rina',
    voksne: ['Rina (romansvarlig)', 'Tor Martin', 'Edel', 'Mari'],
    barn: [
      { navn: 'Vanja Campar', gruppe: 'HK' },
      { navn: 'Montaser Said Shifa', gruppe: 'JK' },
      { navn: 'Ørjan Elias Nilssen', gruppe: 'HK' },
      { navn: 'Mathilde Bakke', gruppe: 'HK' },
      { navn: 'Viktoria Gjøvaag', gruppe: 'HK' },
      { navn: 'Ask Stiansson Langva', gruppe: 'HK' },
      { navn: 'Erle Nesmoen Norvik', gruppe: 'HK' },
      { navn: 'Jon Kristian Askim', gruppe: 'HK' },
      { navn: 'Mia Harborg Rustad', gruppe: 'HK' },
      { navn: 'June Volden Dyrendahl', gruppe: 'HK' },
      { navn: 'Selda Aakvik Jørgensen', gruppe: 'HK' },
      { navn: 'Sebastian Skavlan', gruppe: 'HK' },
      { navn: 'Alma Margrete Løberg', gruppe: 'HK' },
      { navn: 'Eila Marie Løberg', gruppe: 'HK' },
      { navn: 'Dena Abdulreda', gruppe: 'JK' },
    ],
  },
  {
    navn: 'Rom 4',
    ansvarlig: 'Aina',
    voksne: ['Aina (romansvarlig)', 'Remi'],
    barn: [
      { navn: 'Ismael Ang Alic', gruppe: 'HK' },
      { navn: 'Håvard Heggvik', gruppe: 'HK' },
      { navn: 'Emma Sofie Svendsen Dahl', gruppe: 'HK' },
      { navn: 'Tuva Frances F. Nordgård', gruppe: 'HK' },
      { navn: 'Astrid Amalie Lilledalen Molberg', gruppe: 'HK' },
      { navn: 'Signe Rostad Ramstad', gruppe: 'HK' },
      { navn: 'Lise Marie Myrhaug', gruppe: 'HK' },
      { navn: 'Malene Hansen-Zahl', gruppe: 'HK' },
      { navn: 'Olivia Myrland', gruppe: 'HK' },
      { navn: 'Vilde Grande-Weberg', gruppe: 'HK' },
      { navn: 'Anna Kristine Larsen', gruppe: 'HK' },
      { navn: 'Marte Hultmann Klinkenberg', gruppe: 'HK' },
      { navn: 'Frøya Stiansdotter Langva', gruppe: 'HK' },
      { navn: 'Sverre Hatle Nymo', gruppe: 'HK' },
      { navn: 'Rannveig Serine Eide', gruppe: 'HK' },
    ],
  },
]

export const pakkeliste: Array<{ gruppe: string; punkter: string[] }> = [
  {
    gruppe: 'Til bussen',
    punkter: [
      'Vannflaske som kan fylles på gjennom helgen',
      'Matpakke for bussreisen (kveldsmat ved ankomst)',
      'Tidsfordriv',
    ],
  },
  {
    gruppe: 'Klær og personlig utstyr',
    punkter: [
      'Liggeunderlag, sovepose og ev. pute',
      'Klær (sjekk værmeldingen)',
      'Innesko',
      'Toalettsaker',
      'Personlige medisiner',
      'Ørepropper/sovemaske ved behov',
      'Lader',
    ],
  },
  {
    gruppe: 'Til marsjering',
    punkter: [
      'Uniform i merket dresspose (jakke, bukse, cape, hatt med fjær, skjorte, svarte sokker og sko)',
      'Drilluniform med skjørt/bukse, jakke, skjorte, støvletter, tynn strømpebukse (minst to), drillstav',
      'Regnfrakk og hansker',
      'Korps-t-skjorte (nye deles ut på turen)',
      'Instrument med marsjutstyr (noter, noteklype, marsjmappe, ev. bæresele, ekstra fliser, ventilolje)',
      'Notestativ! Alle må ha med. Dette er endret fra tidligere info',
    ],
  },
  {
    gruppe: 'Annet',
    punkter: [
      'Hodetelefoner',
      'Lommepenger ca. 300 kr (kiosken tar kontant, Vipps og kort)',
      'Spill, fotball/basketball e.l. (det er baner på skolen)',
    ],
  },
]

export const praktisk: Array<{ label: string; value: string }> = [
  { label: 'Uniformshatt', value: 'Sårbar ved transport. Pakk i støtsikker eske i kofferten, eller legg merket hatt i felles stor eske. Ta av fjæren og legg den i jakkens innerlomme.' },
  { label: 'Uniform etter bruk', value: 'Heng alltid uniformen på kleshenger i dressposen. Øv gjerne hjemme før avreise.' },
  { label: 'Lunsj lørdag og søndag', value: 'Alle smører egen matpakke under frokosten. Korpset har med litt ekstra mat hvis noen trenger påfyll.' },
  { label: 'T-skjorte i reserve', value: 'Har du en korps-t-skjorte som ikke passer lenger? Lever den til turkomiteen eller styret, så har vi reserve til søndagens marsjering.' },
  { label: 'Ungdomskorps', value: 'Deltakerne skal ha fått egen e-post med info og noter. Mangler du den, kontakt Maria snarest.' },
  { label: 'Festivalprogram', value: 'Oppdatert program ligger på Lillehammerfestivalens hjemmeside.' },
]

export const varsler = [
  { tittel: 'Alvorlig nøtteallergi', tekst: 'Det er alvorlig nøtteallergi blant aspirantene. Ingen nøtter på klasserommet der aspirantene sover.' },
  { tittel: 'Merk alt med navn', tekst: 'Alle klær, alt utstyr og alle personlige eiendeler skal merkes. Alt!' },
]

export const turkomite: Array<{ navn: string; rolle: string; tlf: string }> = [
  { navn: 'Maria Rustad', rolle: 'Leder · vara beredskapsansvarlig', tlf: '91580826' },
  { navn: 'Kine Halgunset', rolle: 'Mat, allergier og behov', tlf: '45665959' },
  { navn: 'Edel Askim', rolle: 'Helse og beredskap', tlf: '99104938' },
  { navn: 'Arne-Olav Thuestad', rolle: 'Logistikk, turregler og mobilhotell', tlf: '97034895' },
]

export const reiseledere: Array<{ navn: string; tlf: string }> = [
  { navn: 'Maria Rustad', tlf: '91580826' },
  { navn: 'Kine Halgunset', tlf: '45665959' },
  { navn: 'Arne-Olav Thuestad', tlf: '97034895' },
  { navn: 'Edel Askim', tlf: '99104938' },
  { navn: 'Mari Langva', tlf: '99464774' },
  { navn: 'Remi Bakke', tlf: '97546823' },
  { navn: 'Therese Oterhals', tlf: '99309814' },
  { navn: 'Rina Aakvik', tlf: '99712460' },
  { navn: 'Tor Martin Norvik', tlf: '91351290' },
  { navn: 'Tove Myrhaug', tlf: '98849029' },
  { navn: 'Ole Petter Talgø', tlf: '93066213' },
  { navn: 'Kristin Belsaas', tlf: '97605797' },
  { navn: 'Aina Nesmoen Norvik', tlf: '93614200' },
  { navn: 'Marit Kotsbakk Bollingmo', tlf: '91735177' },
]

export const bussjafor = { navn: 'Eyvind Dyrendahl', rolle: 'Bussjåfør på korpstur', tlf: '93027902' }

export const kontaktHjemme = { navn: 'Alfhild Lien Eide', rolle: 'Kontaktperson på Tiller', tlf: '90971238' }
