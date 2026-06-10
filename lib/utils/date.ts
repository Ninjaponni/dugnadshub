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
  if (d < 0) return 'tidligere'
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

// ISO/timestamptz fra DB → datetime-local-format i LOKAL tid.
// datetime-local-inputs avviser verdier med tidssone-suffiks, så vi må formatere selv.
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
