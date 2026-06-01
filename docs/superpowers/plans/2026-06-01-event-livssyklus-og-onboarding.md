# Event-livssyklus og onboarding-stabilitet — Implementasjonsplan

**Goal:** Tre uavhengige fikser: (1) onboarding skal ikke trigges på nytt etter timer med inaktivitet, (2) admin kan låse påmelding uten å fullføre event, (3) fullfør-dialogen tilpasser seg event-typen.

**Architecture:** Tre faser som kan kjøres uavhengig. Fase 1 er en DB-migrasjon + ett felt på `profiles`. Fase 2 introduserer ikke ny status, men aktiverer eksisterende `signup_deadline` som offisiell lock-mekanisme med tydeligere UI. Fase 3 er ren UI-branching på `event.type` i fullfør-dialogen.

**Tech Stack:** Next.js 15 App Router, Supabase Postgres + SQL migrasjon, TypeScript strict.

---

## Bakgrunn (oppdaget under utforskning)

- `signup_deadline` finnes allerede på `events`-tabellen og håndheves av `claim_shift_atomic`-RPC (kode `deadline_passed`) og DELETE-endpoint i `app/api/shifts/[id]/claim/route.ts:75-78`. **Fase 2 utnytter dette i stedet for å bygge ny status.**
- Fullfør-dialogen ligger i `app/admin/hendelser/page.tsx:1912-1976` og har ingen `event.type`-branching, mens deactivate/reset-dialogene rett over har det. **Fase 3 utvider eksisterende mønster.**
- Onboarding-flagget settes kun i `localStorage` (`app/(app)/hjem/page.tsx:159`). Safari WebKit ITP kan purge localStorage etter ~7 dagers inaktivitet for PWA-er, særlig hvis appen ikke har vært i forgrunnen. **Fase 1 backer flagget mot DB; localStorage beholdes som rask sjekk.**

---

## Fase 1 — Onboarding mot DB

**Hypotese (må verifiseres før commit):** Safari sletter localStorage etter inaktivitet. Verifikasjon: be Tor Martin sjekke Settings → Safari → Advanced → Website Data neste gang han ser onboarding feilaktig. Hvis Dugnadshub mangler, er ITP-purge bekreftet.

### Task 1.1: Migrasjon — ny kolonne på `profiles`

**Files:** Create `scripts/migrate-onboarding-completed.sql`

- [ ] **Step 1:** Skriv migrasjon

```sql
-- Onboarding-status mot DB, så Safari ITP-purge av localStorage ikke trigger onboarding på nytt.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Backfill: alle som har full_name + minst én children-rad antas å ha sett onboarding.
UPDATE profiles
SET onboarding_completed_at = COALESCE(onboarding_completed_at, created_at)
WHERE full_name IS NOT NULL
  AND (children IS NOT NULL AND jsonb_array_length(children) > 0)
  AND onboarding_completed_at IS NULL;
```

- [ ] **Step 2:** Kjør i Supabase Studio (delt prod-DB, husk at det blir levende umiddelbart, men kolonnen er nullable og bryter ingenting før koden bruker den).
- [ ] **Step 3:** Commit migrasjonsfil.

### Task 1.2: Inkluder feltet i `get_home_data` RPC

**Files:** Modify `scripts/migrate-get-home-data.sql` (kopier ny versjon med versjons-suffix, ikke skriv over den gamle), Modify `lib/supabase/types.ts:14-25`

- [ ] Legg `onboarding_completed_at TIMESTAMPTZ` på `Profile`-interface.
- [ ] Oppdater RPC-en til å inkludere kolonnen i `profile`-feltet. (Den selecter `profiles.*` allerede; bekreft, og oppdater hvis det er eksplisitt column-liste.)
- [ ] Kjør oppdatert RPC i Supabase Studio.

### Task 1.3: Frontend — DB er sannhet, localStorage er cache

**Files:** Modify `app/(app)/hjem/page.tsx:48-54, 158-167`

- [ ] **Trigger-betingelse:** Vis onboarding hvis `profile.onboarding_completed_at == null` AND `localStorage[onboarding_complete_${id}] != '1'`. Hvis DB sier ferdig, sett localStorage-flagget umiddelbart (lazy backfill for raskere første-render).

```tsx
useEffect(() => {
  if (loading || !profile) return
  if (typeof window === 'undefined') return
  const key = `onboarding_complete_${profile.id}`
  if (profile.onboarding_completed_at) {
    if (!localStorage.getItem(key)) localStorage.setItem(key, '1')
    return
  }
  if (localStorage.getItem(key)) return
  setShowOnboarding(true)
}, [loading, profile])
```

- [ ] **completeOnboarding:** Skriv DB FØRST (via RPC eller direkte update), så localStorage. Hvis DB-skriving feiler, vis feilmelding i stedet for å skjule wizarden (ellers blokkerer vi ikke neste runde).

```tsx
async function completeOnboarding() {
  if (!profile?.id) return
  const { error } = await supabaseRef.current
    .from('profiles')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', profile.id)
  if (error) { /* toast og return — IKKE skjul wizard */ return }
  localStorage.setItem(`onboarding_complete_${profile.id}`, '1')
  setShowOnboarding(false)
  // reload som før
}
```

- [ ] **Reset-knapp på profil-siden** (`app/(app)/profil/page.tsx:589`): må også nullstille DB-feltet, ikke bare localStorage.

### Task 1.4: Verifisering

- [ ] Test lokalt: slett localStorage manuelt, last hjem. Onboarding skal IKKE vises (fordi DB sier ferdig).
- [ ] Test lokalt: nullstill `onboarding_completed_at = NULL` for én test-bruker, slett localStorage, last hjem. Onboarding skal vises.
- [ ] Commit + deploy. v10.11.

---

## Fase 2 — Lås påmelding (uten å fullføre)

**Designvalg:** Vi gjenbruker `signup_deadline`. Ingen ny status. «Låst» = `signup_deadline < now()`. Backend håndhever allerede. Vi tilfører bare admin-handling og tydeligere UI.

### Task 2.1: Admin — «Lås påmelding nå»-knapp på aktive events

**Files:** Modify `app/admin/hendelser/page.tsx` (samme cluster som Aktiver/Deaktiver/Fullfør)

- [ ] Vis knappen kun når `event.status === 'active'` OG (`event.signup_deadline == null` ELLER `signup_deadline > now()`).
- [ ] Klikk → bekreftelses-sheet «Lås påmelding nå? Brukerne kan fortsatt se sine vakter, men ikke melde seg på eller av.» → setter `events.signup_deadline = now()`.
- [ ] Når låst (`signup_deadline < now()`) skjul «Lås påmelding»-knappen, vis i stedet liten label «Påmelding låst» (samme sted, ikke-klikkbar).
- [ ] «Åpne påmelding igjen»-knapp som setter `signup_deadline = NULL` (gjenåpning, for fleksibilitet — Tor Martin har sannsynligvis trengt det allerede).
- [ ] Fullfør-knappen forblir tilgjengelig parallelt — låsing og fullføring er uavhengige.

### Task 2.2: Hjem-siden viser «Påmelding stengt» tydelig

**Files:** Modify `components/features/ArrangementCard.tsx`

- [ ] Når event er aktivt men deadline passert, vis label «Påmelding stengt — du beholder vaktene dine» på kortet.
- [ ] Behold tap-til-arrangement-side så bruker kan se sine vakter.

### Task 2.3: Arrangement-siden — tydeligere låst-tilstand

**Files:** Modify `app/(app)/arrangement/[id]/page.tsx:93-98`

- [ ] Når deadline passert: vis banner «Påmelding er stengt. Du beholder vaktene du har valgt, og kan se dem helt frem til hendelsen.»
- [ ] `ShiftClaimSheet`: hvis bruker har claim → vis «Du står på denne vakten» uten avmeldings-knapp. Hvis bruker ikke har claim → vis «Påmelding stengt» og skjul claim-knapp. (Sjekk `components/features/ShiftClaimSheet.tsx:32` — antagelig allerede implementert via `isDeadlinePassed`, men dobbeltsjekk feilmeldingen.)

### Task 2.4: Hjem-siden + admin-oversikt skiller låst fra fullført

- [ ] `useActiveEvent` (`lib/hooks/useEvent.ts`) returnerer fortsatt låste arrangementer som «aktiv» — det er riktig, ingenting trengs å endres.
- [ ] Sjekk at admin-fanen «Aktive (2)» fortsatt teller låste events. Ja, fordi status fortsatt er `active`.

### Task 2.5: Auto-deadline (vurderes, men IKKE implementer i denne fasen)

Skipper først. Tor Martin kan låse manuelt. Hvis han senere vil at deadline-feltet (som settes ved opprettelse) skal automatisk gjøre dette ved cron/edge function — eget tema.

### Task 2.6: Verifisering

- [ ] Manuell test: lås Neonfestival → som vanlig bruker, prøv å melde deg på. Skal feile med 403 (allerede dekket av RPC).
- [ ] Manuell test: bruker med eksisterende claim ser fortsatt sin vakt på `/arrangement/<id>` og på `MyShiftsCard`.
- [ ] Commit + deploy. v10.12.

---

## Fase 3 — Type-aware fullfør-dialog

### Task 3.1: Branche dialog-innhold på `event.type`

**Files:** Modify `app/admin/hendelser/page.tsx:1912-1976`

Mapping:

| event.type | Felter |
|---|---|
| `plast` | «Hvor mange sekker ble levert?» + notater |
| `bottle_collection` | «Antall flasker/pant?» (valgfritt) + notater |
| `lapper` | «Antall lapper levert?» (valgfritt) + notater |
| `arrangement` | KUN notater («Hvordan gikk det?») |
| `lottery` / `baking` / `other` | KUN notater |

- [ ] Lag liten helper-komponent eller bare conditional rendering i dialogen.
- [ ] Sekker-feltet skrives kun til `bags_collected` for `plast` og `bottle_collection` (gjenbruk feltet — det er allerede generisk «antall enheter»). For `lapper` kan vi enten lagre i samme felt eller la det stå. Beslutning: bruk `bags_collected` som generisk teller for alle ikke-arrangement, gi feltet riktig label per type.
- [ ] For `arrangement`: hopp helt over tall-feltet, kun notater.

### Task 3.2: Forenkle copy

- [ ] Heading endres dynamisk: `«Fullfør plastdugnad»`, `«Fullfør flaskeinnsamling»`, `«Fullfør arrangement»`.
- [ ] Knapp-tekst «Fullfør» beholdes.

### Task 3.3: Verifisering

- [ ] Lokal: opprett mock-event per type, åpne fullfør-dialog, sjekk innhold.
- [ ] Bekreft at `bags_collected` ikke skrives som NULL for plast hvis bruker glemmer å fylle inn (samme atferd som før).
- [ ] Commit + deploy. v10.13.

---

## Rekkefølge og rollout

1. **Fase 3 først** (lavest risiko, kun UI-branching i admin). v10.11.
2. **Fase 2** (krever DB-handling men `signup_deadline` finnes allerede). v10.12.
3. **Fase 1 sist** (krever migrasjon + RPC-oppdatering, så vi vil gjøre det når vi har god tid for differensial-test). v10.13.

Hver fase commitres og deployes uavhengig. Hver fase bump versjon i `app/layout.tsx` og `package.json`.

---

## Åpne beslutningspunkter (be Tor Martin avklare før Fase 2 starter)

1. **Lås-knapp eller automatisk?** Plan sier manuell knapp. Skal vi heller la systemet automatisk låse når `signup_deadline` passerer (uten knapp)? — Manuell foreslås fordi det gir Tor Martin kontroll, men det kan også gjøres automatisk parallelt.
2. **«Åpne igjen»-knapp:** Trengs den? Hvis nei, kutter vi den.
3. **Bags-feltets navn:** Skal `bags_collected` bytte navn til noe mer generisk (f.eks. `units_collected`)? Migrasjon mulig, men ikke nødvendig for å løse oppgaven. Foreslår: behold navnet, det er internt.

---

## Hva som IKKE er i denne planen

- Merker-modernisering ([[dugnadshub-merker-modernisering]]) — egen task, venter på beslutninger.
- MeetingPointSheet-skalerbarhet ([[dugnadshub-neste-plast]]) — egen task.
- Ytelse fase 2/3 ([[dugnadshub-ytelse]]) — egen task.
