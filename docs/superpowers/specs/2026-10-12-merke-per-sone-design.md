# Ett merke per sone (lapper og flasker), automatisk Lappemester og ×N overalt

Dato: 2026-10-12. Bestiller: Tor Martin.
Bakgrunn: Flaskeinnsamling Nord 12.10. Lappeutdelerne i Nord 29.09 fikk aldri Lappemester Nord, og foreldre ønsker å bli belønnet for hver sone de tar (se `docs/tilbakemeldinger.md` punkt 1, 3 og 7).

**Langsiktig mål (Tor Martin 12.10):** et helautomatisk merkesystem. Alle merker som kan avledes av data i Dugnadshub, skal deles ut av databasen uten at admin gjør noe. Manuell tildeling i admin/medlemmer er bare en reserve for unntak, ikke en del av rutinen. Denne speken er første steg (sonemerkene). Resten kartlegges i en egen spec.

Appen er i drift for ca. 130 familier, og merkene er lodd i julekonserttrekningen. **Ingen sletting i `user_badges` uten styrets OK.**

Arbeidsmåte:
- Lag først en implementeringsplan.
- Vis meg alle migreringer før de kjøres.
- Test i mock-modus og med `begin ... rollback` mot prod-data. Rapporter tallene fra tilbakefyllingen før commit.
- Bump versjon som vanlig.

---

## Funn (diagnose 12.10)

1. **Lappemester Nord (18) og Sør (20) har ingen automatikk.** `auto_criteria: null`, og verken `mark_event_completed` eller `reevaluate_event_badges` deler dem ut. Alt er gjort manuelt og ulikt:
   - Lappeutdeling Nord 07.04: 3 personer / 6 soner, 6 rader uten `event_id`.
   - Lappeutdeling Sør 14.04: 6 personer, 5 rader uten `event_id`. Én mangler.
   - Lappeutdeling Sør 21.09: 6 personer, 6 rader med `event_id`. Riktig.
   - Lappeutdeling Nord 29.09: 6 personer, 0 merker. Feilen som ble meldt.
2. Rader uten `event_id` teller ikke som deltakelse i `award_participation_badges` og gir ikke ×N per hendelse.
3. `user_badges_event_unique (user_id, badge_id, event_id)` hindrer mer enn ett eksemplar av samme merke per hendelse. Ett merke per sone krever derfor en endring i datamodellen.
4. Mobil (`app/(app)/merker/page.tsx` linje 251) viser ×N bare for `category === 'aktivitet'`. Desktop (`MerkerDesktop.tsx`) viser ×N for alle. Det er derfor gjentatte 17. mai-, sommerkonsert- og seminarmerker ser ut som ett merke på mobil.
5. Ulest-prikken i `BottomNav.tsx` sammenligner `badge_id` mot det man har sett, så et merke man har fra før gir ingen prikk når man får det igjen.
6. Makker (3) og Heldekkende (9) deles bare ut når brukeren åpner appen (`/api/badges/evaluate`). Per 12.10 manglet 4 Makker og 1 Heldekkende fordi brukerne ikke har åpnet appen ennå. Utenfor scope, se Del 5.

Data per 12.10 (fullførte hendelser): 136 flaskeclaims fordelt på 47 personer (maks 7, 28 tilfeller med flere soner på samme dugnad). 24 lappeclaims fordelt på 14 personer.

---

## Del 1: Merkene

- **Lappeutdeling:** gjenbruk Lappemester Nord (18) og Lappemester Sør (20). Merket velges etter `zones.area`. De finnes allerede, folk har dem, og det finnes grafikk til dem. Ny beskrivelse: "Tok en lappesone i Nord" / "Tok en lappesone i Sør".
- **Flaskeinnsamling:** nytt merke, id 86, kategori `aktivitet`. Navn **Pantejeger** (bekreftet av Tor Martin 12.10), beskrivelse "Tok en flaskesone". Ett merke for begge områder, fordi Nordavansen og Sørvendt allerede belønner område.
- Grafikk: `public/badges/pantejeger.png` er ferdig (360x360, Nano Banana 2 med Tillerdagen-merket som stilreferanse, variant 3 valgt av Tor Martin). Ikke lag plassholder.
- Plast er ikke med.

## Del 2: Datamodell

Additivt og bakoverkompatibelt (se Del 0 i speken fra 2026-09-28 om gamle klienter):

```sql
alter table public.user_badges
  add column if not exists zone_assignment_id uuid
    references public.zone_assignments(id) on delete set null;

-- Merker per sone: ett per bruker per merke per sone
create unique index if not exists user_badges_zone_uniq
  on public.user_badges (user_id, badge_id, zone_assignment_id)
  where zone_assignment_id is not null;

-- Den eksisterende hendelsesindeksen gjelder bare merker uten sone
-- (bytt user_badges_event_unique til ... where event_id is not null and zone_assignment_id is null)
```

Planen må vurdere `on delete set null` mot den nye indeksen: hvis en sone slettes, kan to rader havne på samme `(user_id, badge_id, event_id)` med `zone_assignment_id = null`. Velg en løsning som verken mister merker eller bryter indeksen (f.eks. `on delete restrict`, eller bare beholde id-en uten FK).

`event_id` settes alltid også på sonemerker, så de teller som deltakelse og vises per hendelse.

## Del 3: Automatisk tildeling

I `mark_event_completed` og `reevaluate_event_badges`:

- `type = 'lapper'`: ett merke per `zone_claims`-rad på hendelsen. 18 hvis `zones.area = 'NORD'`, 20 hvis `'SOR'`.
- `type = 'bottle_collection'`: ett merke 86 per `zone_claims`-rad.
- Bare soner som er meldt ferdig: `zone_assignments.status` er `completed` eller `picked_up` (inkludert tatt med selv). En sone som er tatt, men aldri gått, gir ikke merke (Tor Martin 12.10). Per 12.10 er alle soner på fullførte hendelser ferdige.
- Lodd per person, ikke per familie: to som deler en sone (også to foreldre i samme familie), får ett merke hver. Hjelpere (`via_help`) får merke som alle andre. Ingen grense for antall sonemerker per dugnad (Tor Martin 12.10).
- `on conflict do nothing`. Idempotent ved ny kjøring.
- Rekkefølge: før `award_participation_badges`, slik at alt er på plass når tersklene regnes.

## Del 4: Tilbakefylling (alle fullførte hendelser)

**Ingen sletting.** Eksisterende manuelle Lappemester-rader gjenbrukes:

1. For hver lappeclaim på en fullført hendelse: finnes det en rad med samme `user_id` og riktig merke (18/20) som ennå ikke er koblet til en sone, og som enten mangler `event_id` eller har samme `event_id`? Oppdater raden med `event_id` og `zone_assignment_id`. Ellers sett inn en ny rad.
2. Flaskeclaims: sett inn 86 per claim.
3. Rader som ikke lar seg koble til en sone, blir liggende som de er, og rapporteres.
4. Kjør `award_participation_badges(null)` til slutt.

Forventet resultat (sjekk mot faktiske tall i rollback): 24 Lappemester-rader totalt, koblet til sone, hvorav ca. 7 nye (6 for Nord 29.09 og én for Sør 14.04). 136 Pantejeger-rader.

Merk: dette gir ca. 145 nye lodd før julekonserten. Det er villet, men Tor Martin bekrefter tilbakefyllingen eksplisitt før commit.

Utrulling i to steg (Tor Martin 12.10): først migreringen alene (kan angres uten sletting), deretter tilbakefyllingen med egen godkjenning.

Admin "Slett hendelse" sjekker først om hendelsen har merker, og sier da "Hendelsen har N merker og kan ikke slettes" i stedet for å slette soner og feile halvveis.

## Del 5: Visning

- Mobil: bruk `STACKABLE_BADGE_CATEGORIES` i stedet for `category === 'aktivitet'` for ×N-merket, slik desktop gjør. Etter Del 1 til 4 vil Lappemester og Pantejeger vise ×N.
- Detaljvisningen: vis "Opptjent ×N", og vis gjerne en liste over hvilke dugnader (og soner for sonemerker) merket kommer fra. Dette er ønsket "se hvor mange av samme merke".
- Ulest-prikken: tell rader (f.eks. sammenlign antall per `badge_id`, eller lagre sist sette `awarded_at`), så et nytt eksemplar av et merke man har fra før også gir prikk.
- Valgfritt, egen sak: flytt Makker (3) og Heldekkende (9) inn i `mark_event_completed`, så de ikke venter på at brukeren åpner appen.

## Del 6: Synk av definisjoner

Oppdater `lib/badges/definitions.ts` (beskrivelser for 18/20, nytt 86), `badges`-tabellen og eventuelle mock-data. 18/20/86 deles ut helt automatisk. Admin-panelets manuelle tildeling (`app/admin/medlemmer`) beholdes bare som reserve for unntak (f.eks. en sone som ikke ble registrert i appen), og skal fortsatt virke uten sone.
