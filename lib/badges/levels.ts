// Felles nivåstige for merker — brukes av BÅDE mobil (app/(app)/merker/page.tsx)
// og desktop (components/merker/MerkerDesktop.tsx) så de aldri viser ulike nivåer.
// Navnene beskriver dugnadsforelderen, fra håndsopprekning til monument.
export const BADGE_LEVELS = [
  { at: 1, name: 'Håndsopprekkeren', desc: 'Rakk opp hånda på foreldremøtet. Sånn starter det.' },
  { at: 5, name: 'Ja-mennesket', desc: 'Sier ja før spørsmålet er ferdig stilt' },
  { at: 10, name: 'Poteten', desc: 'Kan brukes til alt, og blir det' },
  { at: 16, name: 'Arbeidsjernet', desc: 'Tar i et tak hver gang, ruster aldri' },
  { at: 23, name: 'Allværsjakka', desc: 'Stiller opp i regn, sludd og sidevind' },
  { at: 31, name: 'Limet', desc: 'Holder hele korpset sammen' },
  { at: 40, name: 'Ryggraden', desc: 'Korpset hadde kollapset uten' },
  { at: 50, name: 'Grunnfjellet', desc: 'Har vært med siden før noen kan huske' },
  { at: 60, name: 'Fyrtårnet', desc: 'Nye foreldre navigerer etter hen' },
  { at: 70, name: 'Statuen', desc: 'Fortjener egen statue utenfor Rosten' },
] as const

export type BadgeLevel = (typeof BADGE_LEVELS)[number]

// Finn nåværende og neste nivå ut fra totalt antall merker (inkl. duplikater).
// Med 0 merker står man på første trinn — reisen har tross alt startet.
export function getBadgeLevel(totalBadgeCount: number): { current: BadgeLevel; next: BadgeLevel | null; index: number } {
  let index = 0
  for (let i = BADGE_LEVELS.length - 1; i >= 0; i--) {
    if (totalBadgeCount >= BADGE_LEVELS[i].at) {
      index = i
      break
    }
  }
  return { current: BADGE_LEVELS[index], next: BADGE_LEVELS[index + 1] ?? null, index }
}
