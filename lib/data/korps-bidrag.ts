// «Sammen har vi i 2026» — korpsets FELLES bidragstall, vist på profilsiden
// for alle medlemmer. Dette er EKTE tall som vedlikeholdes manuelt her
// (de er ikke mock-data — flyttet hit fra lib/mock/data.ts så ingen
// «rydder dem bort» ved en feiltagelse).
//
// Oppdater tallene her etter sesongen / store dugnader.

export interface KorpsBidragData {
  sekkerPant: number
  lapperDeltUt: number
  kakerBakt: number
  premierSkaffet: number
  loddbokerSolgt: number
  dugnader: number
  polserSolgt: number
  isSolgt: number
  kakestykkerSolgt: number
  brusSolgt: number
  literSoppel: number
  kronerOpptjent: number
}

export const korpsBidrag: KorpsBidragData = {
  sekkerPant: 126,
  // 3400 etter vårens utdelinger + 1404 (Sør 21.09.2026), rundet av Tor Martin
  lapperDeltUt: 4800,
  kakerBakt: 125,
  premierSkaffet: 42,
  loddbokerSolgt: 58,
  // Kun reserve: profilsiden regner ut tallet fra fullførte hendelser i år (app/(app)/profil/page.tsx)
  dugnader: 10,
  polserSolgt: 668,
  isSolgt: 755,
  kakestykkerSolgt: 1255,
  brusSolgt: 938,
  literSoppel: 300,
  // 232 385 + 13 650 (Fotball-VM Clarion, 91 t) + 8 400 (Neonfestivalen, 56 t)
  kronerOpptjent: 254435,
}
