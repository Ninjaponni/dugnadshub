// Dager til en dato, regnet fra LOKAL midnatt til lokal midnatt.
// ('YYYY-MM-DD' uten suffiks parses som UTC og ga «I morgen» for dagens
// event mellom 00 og 02 om natten — derfor T00:00:00 + nullstilt nå-tid.)
export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr.slice(0, 10) + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

// Formater dato på norsk, med valgfri klokkeslett
export function formatDate(dateStr: string, time: string | null): string {
  const d = new Date(dateStr.slice(0, 10) + 'T00:00:00')
  const formatted = d.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })
  if (time) {
    const t = time.split(':').slice(0, 2).join(':')
    return `${formatted} kl. ${t}`
  }
  return formatted
}

// Lesbar tekst for dager-til (I dag, I morgen, om X dager, tidligere)
export function daysUntilLabel(dateStr: string): string {
  const d = daysUntil(dateStr)
  // Negativt = startdato passert men eventet vises fortsatt (aktivt) — «Pågår»
  if (d < 0) return 'Pågår'
  if (d === 0) return 'I dag!'
  if (d === 1) return 'I morgen'
  return `om ${d} dager`
}

// Dagens dato som 'YYYY-MM-DD' i LOKAL tid (toISOString gir UTC-dato,
// som er gårsdagen mellom midnatt og 01/02 norsk tid)
export function localDateISO(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// datetime-local-verdi ('YYYY-MM-DDTHH:MM', lokal tid) → ISO med tidssone.
// new Date() tolker strenger uten sone som LOKAL tid, så toISOString gir riktig instant.
export function localInputToISO(local: string): string | null {
  if (!local) return null
  const d = new Date(local)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

// Tolk 'YYYY-MM-DD' + 'HH:MM' som NORSK veggklokke og gi det faktiske tidspunktet.
//
// Helperne over lener seg på at «lokal tid» ER norsk tid. Det holder i nettleseren,
// men IKKE på serveren: Vercel-funksjoner kjører i UTC, så `new Date('...T15:00:00')`
// ble tolket som 15:00 UTC = 17:00 norsk. Bruk denne i API-ruter og cron.
export function norwegianLocalToInstant(dateStr: string, timeStr: string): Date | null {
  const date = dateStr.slice(0, 10)
  const time = timeStr.slice(0, 5)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null

  // Anta først at veggklokka er UTC, mål så hvor mye Oslo avviker på nettopp det
  // tidspunktet (fanger sommer- og vintertid av seg selv), og korriger tilbake
  const assumedUtc = new Date(`${date}T${time}:00Z`)
  if (isNaN(assumedUtc.getTime())) return null

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Oslo',
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(assumedUtc)

  const get = (type: string) => Number(parts.find(p => p.type === type)?.value)
  const osloWallClock = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))

  return new Date(assumedUtc.getTime() - (osloWallClock - assumedUtc.getTime()))
}

// ISO/timestamptz fra DB → datetime-local-format i LOKAL tid.
// datetime-local-inputs avviser verdier med tidssone-suffiks, så vi må formatere selv.
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
