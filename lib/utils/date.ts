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
