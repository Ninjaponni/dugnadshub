// Dager til en dato (negativt = i fortiden)
export function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

// Formater dato på norsk, med valgfri klokkeslett
export function formatDate(dateStr: string, time: string | null): string {
  const d = new Date(dateStr)
  const formatted = d.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })
  if (time) {
    const t = time.split(':').slice(0, 2).join(':')
    return `${formatted} kl. ${t}`
  }
  return formatted
}

// Lesbar tekst for dager-til (I dag, I morgen, om X dager)
export function daysUntilLabel(dateStr: string): string {
  const d = daysUntil(dateStr)
  if (d <= 0) return 'I dag!'
  if (d === 1) return 'I morgen'
  return `om ${d} dager`
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
