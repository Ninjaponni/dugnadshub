# Flaskeinnsamling: "Tatt med selv", "Be om en ekstra hånd" og automatiske deltakelsesmerker

Dato: 2026-09-28 (v2, etter review fra tre sub-agenter: arkitektur, database/merker og UX).
Bestiller: Tor Martin. Bakgrunn: tilbakemeldinger etter Flaskeinnsamling Sør 28.09, pluss feilsøk av merkeutdeling.

Appen er i drift for ca. 130 familier, og merkene er lodd i julekonserttrekningen.
**Frist: deployet og testet innen 5. oktober**, en uke før Tiller Nord 12. oktober.

Arbeidsmåte:
- Lag først en implementeringsplan.
- Vis meg alle migreringer før de kjøres.
- Test i mock-modus og med `begin ... rollback` mot prod-data.
- Bump versjon som vanlig.

Del 1 og 2 gjelder kun `zone_type = 'bottle'`. Lapper og plast skal være uendret.

Designkrav: dette skal ikke rote til UX eller design.
- Ingen nye hovedknapper.
- Ingen endring i fyllfarger.
- Samme antall trykk som i dag for vanlig flyt.

---

## Del 0: Deploy-rekkefølge og gamle klienter

Folk har PWA-en cachet. Under deploy kjører gamle og nye klienter samtidig. Derfor gjelder dette:

1. Migreringer er additive og bakoverkompatible. En gammel klient som kaller eksisterende RPC-er med gamle parametre, skal fortsatt fungere, eller feile tydelig. Den skal ikke feile stille.
2. Ingen ny verdi i `zone_assignments.status`. Gamle `ZoneLayer` faller ellers gjennom til "ledig" (rød).
3. Rekkefølge:
   1. migrering
   2. `notify pgrst, 'reload schema'`
   3. frontend med versjonsbump

---

## Del 1: Ferdig, men skal sonen hentes?

### Behov
Plukkeren velger ved ferdigmelding mellom:
- Klar for henting (som i dag)
- Jeg har tatt med alt selv, det er ingenting å hente

### Datamodell
- Ny kolonne: `zone_assignments.self_delivered boolean not null default false`.
- Ved "tatt med selv": `status = 'picked_up'` og `self_delivered = true`.
- Da fungerer alle tellere, fremdrift, Makker-merket og eksport uten omskriving. Lilla betyr allerede "ingenting å hente" for sjåfører. Gamle klienter viser sonen som hentet, og det er riktig nok.

### RPC
`mark_zone_complete(p_assignment_id uuid, p_self_delivered boolean default false)`:
- **Viktig:** `DROP FUNCTION mark_zone_complete(uuid)` i samme migrering før den nye opprettes. `CREATE OR REPLACE` med ny signatur lager en overload ved siden av den gamle. Da blir den gamle, usikrede versjonen liggende, og PostgREST feiler med PGRST203 på tvetydig kall. Gamle klienter som sender bare `p_assignment_id`, treffer den nye via default-verdien.
- Kaller må ha claim på sonen eller være admin.
- Lås raden med `select ... for update`.
- Avvis hvis sonen allerede er `completed`/`picked_up`.
- `p_self_delivered = true` er kun lov for bottle-soner.
- Nullstill åpen hjelpeforespørsel (se Del 2).
- `set search_path = public`, `revoke execute ... from public, anon`, `grant execute ... to authenticated`.

`uncomplete_zone` og `admin_uncomplete_zone`:
- Skal også kunne angre fra `picked_up` når `self_delivered = true`. Aldri fra sjåførhentet `picked_up`.
- Nullstill `self_delivered`.
- Sett status til `claimed` hvis sonen er full, ellers `available`. I dag settes alltid `claimed`.

### UI i ZoneClaimSheet (bottle)
"Marker som ferdig" som i dag. Bekreftelsesboksen spør om hvor panten er, ikke om hva brukeren har gjort:

- Tittel: **"Hvor er panten nå?"**
- Hovedvalg, grønn og fylt, der tommelen nettopp trykket: **"Klar for henting"**, undertekst "Sjåførene får beskjed."
- Sekundærvalg, tekstknapp under: **"Jeg har tatt med alt selv"**, undertekst "Ingenting å hente."
- "Avbryt" som liten lenke.
- Minst 12 px luft mellom valgene, og minst 44 px trykkflate på begge.
- Feiltrykk på "tatt med selv" er det dyreste utfallet, fordi sekker blir stående igjen. Etter et slikt valg vises derfor en toast i 5 sekunder: "Registrert: ingenting å hente. **Angre**".
- Ingen `notifyDrivers` ved tatt med selv.
- Statuslabel: `picked_up` + `self_delivered` gir **"Tatt med selv"**, samme farge som Hentet.
- "Angre ferdigmelding" vises også for tatt med selv.

### Andre steder som må oppdateres
- `useRealtimeZones`: ta med `self_delivered` (og feltene fra Del 2) i `ZoneWithStatus` og mappingen. I dag kopieres bare `status`.
- Sjåførsiden:
  - Legg de nye feltene i select og `DriverZone`.
  - Vis tatt med selv-soner dempet med "Tatt med av plukker", ikke som noe sjåføren har hentet.
- Hjem: soneraden viser "Ferdig" bare for `completed`. Den må også dekke `picked_up`, ellers ser plukkeren sin egen sone som uferdig.
- CSV-eksport: kolonnen "Hentet" viser "Tatt med selv" i stedet for "Ja".
- Typer (`lib/supabase/types.ts`) og mock-data.

---

## Del 2: "Be om en ekstra hånd"

### Behov
Den som har tatt en sone, eller admin, kan be om hjelp. Sonen markeres på kartet. Første som melder seg blir med, og så lukkes forespørselen. Det er én plass per forespørsel. Trengs det flere, kan man be igjen ("Be om én til"). Én plass er det enkleste og passer at 1-3 foreldre går per sone.

### Datamodell
Nye kolonner på `zone_assignments`:
- `help_requested_at timestamptz`
- `help_requested_by uuid references profiles(id)`
- `help_notified_at timestamptz` (brukes til push-cooldown)

Åpen forespørsel betyr `help_requested_at is not null`.

### RPC-er
Alle RPC-er som endrer claims eller hjelp, skal låse assignment-raden med `select ... for update`. Det gjelder `claim_zone`, `admin_claim_zone`, `unclaim_zone`, `admin_unclaim_zone`, `admin_reset_claims`, `request_zone_help`, `cancel_zone_help` og `mark_zone_complete`.

`request_zone_help(p_assignment_id)`:
- Kaller har claim på sonen eller er admin.
- Sonen har minst én plukker. På en tom sone er det "Tildel medlem" som gjelder.
- Bare bottle, bare aktiv hendelse, og sonen er ikke ferdig.
- Idempotent.

`cancel_zone_help(p_assignment_id)`:
- Kan kalles av en plukker på sonen eller admin.

`claim_zone` og `admin_claim_zone`:
- Tillat claim hvis det er ledig plass **eller** det finnes en åpen forespørsel.
- **Enhver** vellykket claim mens forespørselen er åpen, lukker den. Det gjelder også når sonen hadde en vanlig ledig plass.
- Avvis claim på `completed`/`picked_up`-soner. Det sjekkes ikke i dag.
- Taper man kappløpet, skal feilen komme som `raise exception` med fast kode i meldingen, f.eks. `HELP_TAKEN`, som UI-et matcher på. Ikke bytt til `{ok:false}`-retur, for gamle klienter sjekker bare `rpcError` og ville vist et mislykket claim som vellykket.

Forespørselen nullstilles automatisk når:
- sonen markeres ferdig
- siste plukker forlater sonen
- admin nullstiller claims
- hendelsen fullføres

### Kart
- Ny farge-token `help`, oransje (f.eks. `#EF7A1A`, hvit tekst), i `zone-colors.ts` og `globals.css`. Ikke bruk `warning`: `#FFD54F` er samme gul som "Delvis tatt", så omriss og label hadde blitt usynlige.
- Omriss: tynt og statisk, som et filtrert linjelag på den eksisterende `zones`-sourcen med property `helpOpen`. Ingen ny source og ingen animasjon i Mapbox.
- Markør: pille **"Hjelp ønskes"** med pulsring, gjenbruk av `nextBeacon` innenfor `prefers-reduced-motion: no-preference`.
  - Maks én markør per sone.
  - Andre ser pillen i stedet for ingenting.
  - Den som ba om hjelp, ser "DU" med en liten oransje prikk, så hen fortsatt finner sin egen sone.
  - Pillen og ferdighaken vises aldri samtidig.
  - Pillen trenger `onClick` som åpner arket, fordi HTML-markører sluker trykk.
- Brikke på egen linje under tellerprikkene: "1 sone trenger hjelp" / "N soner trenger hjelp". Den vises bare når noe er åpent. Trykk flyr til den eldste og åpner arket.
- `kart/page.tsx` holder i dag et snapshot av `selectedZone`. Lagre bare id-en og slå opp i `zones`, så et åpent ark oppdateres live.

### Ark (ZoneClaimSheet)
- Statuslabel **"Hjelp ønskes"** i help-farge. Den går foran "Fullt bemannet" og "Delvis tatt".
- For andre enn plukkerne på sonen, når en forespørsel er åpen: hovedknappen er **"Bli med som hjelper"**, også om sonen ellers er full. Da vises ikke "Sonen er full".
- For plukkere og admin uten åpen forespørsel: tekstknapp **"Be om en ekstra hånd"** i accent-farge, ikke rød, på nivå med "Gi opp sonen".
  - Bekreftelse: "Plukkerne i innsamlingen får varsel. Første som melder seg, blir med."
- Samme valg legges også inn i "Gi opp sonen"-boksen: "Heller få hjelp? **Be om en ekstra hånd**". Den som sliter, trykker oftere på gi opp enn den leter etter en hjelpeknapp.
- Mens forespørselen er åpen, ser plukkere og admin: "Venter på en ekstra hånd" + lenke "Avbryt".
- Når noen har meldt seg: pillen forsvinner, og hjelperen får merkingen "hjelper" i Samlere-lista.
- Tapt kappløp vises nøytralt, ikke i den røde feilboksen: "Noen kom deg i forkjøpet. Sonen har fått hjelp."
- Åpnet fra push etter at forespørselen er lukket: "De klarte seg likevel. Takk!" i stedet for "Sonen er full".
- "Tildel medlem" skal også virke mot hjelpeplassen. I dag skjules knappen når sonen er full.

### Push
Ny route `app/api/push/notify-zone-help/route.ts`:
- Klienten sender bare `assignmentId`. Sonenavn, hendelse og mottakere hentes på serveren.
- Serveren sjekker at forespørselen er åpen, og at kalleren er den som ba om hjelp, en plukker på sonen eller admin.
- Mottakere sendes som `userIds`: alle med zone_claim i samme hendelse, minus dem på sonen. Ikke bruk `eventId`-filteret i `lib/push/server.ts`, for det tar med sjåfører og musikanter.
- Cooldown: maks én push per sone per 10 minutter (`help_notified_at`), så be/avbryt/be ikke gir spam.
- Lenke: eksisterende `/kart?event=…&sone=…`.

Tekster:
- Forespørsel: tittel "[Sone] trenger en ekstra hånd", tekst "Har du krefter til en runde til? Første som melder seg, blir med."
- Noen meldte seg (til plukkerne på sonen): "Hjelpen er på vei", "[Fornavn] kommer til [sone]. Tusen takk!"

### Merker
Ingen nye merker nå. Hjelperen får vanlig claim og teller som før.

---

## Del 3: Sikkerhet i samme runde

- `mark_zone_complete`: se Del 1. Husk DROP av den gamle signaturen.
- `mark_zone_picked_up`: kaller må ha `driver_assignments` (driver eller strapper) på hendelsen, eller være admin. Sonen må være `completed`.
- **zone_claims RLS:**
  - Fjern INSERT- og DELETE-policyene. Klienten bruker bare RPC-er, og direkte INSERT/DELETE omgår kapasitet, hjelpelås og opprydding.
  - UPDATE-policyen lar en bruker flytte sitt claim til en full sone ved å endre `assignment_id`, siden RLS ikke kan begrense kolonner. Bruk `revoke update on zone_claims from authenticated; grant update (notes) on zone_claims to authenticated;`. Notater må fortsatt kunne lagres.
- `notify-drivers`: i dag holder det med et hvilket som helst historisk claim, og `zoneName` er fritekst fra klienten. Kreve claim på akkurat den sonen, og hent navnet fra databasen.
- Alle nye og endrede security definer-funksjoner: `set search_path = public`, og `revoke execute ... from public, anon`.

---

## Del 4: Deltakelsesmerker skal deles ut automatisk

### Diagnose (verifisert)
- `evaluateBadges(userId)` (`lib/badges/evaluator.ts`) sender ikke `userId`. Ruten evaluerer alltid den innloggede. Fullfør i `admin/hendelser` evaluerer derfor admin N ganger parallelt, ikke deltakerne.
- Deltakerlista der hentes bare fra `zone_claims`. Selve ruten teller alle fem kilder.
- `admin/oversikt` sin Fullfør oppdaterer `events.status` direkte og sjekker ikke feil. Da blir det ingen sjåfør- og stripsermerker, ingen rollesynk og ingen Førstemann.
- Manuelle merker i `admin/medlemmer` får `event_id = null` og teller dermed aldri som deltakelse.
- `mark_event_completed` gir merke 15 (Stripsern) også til `role = 'host'` (plast-vert), gjennom `ELSE 15`. Latent feil: ingen har fått det ennå (sjekket 28.09).
- `app/api/events/finalize-drivers/route.ts` er død kode.
- Terskelmerker med `event_id = null` er ikke unike i databasen. Ingen duplikater finnes i dag (sjekket 28.09), men parallelle evalueringer kan lage dem.

### Løsning: terskellogikken flyttes til databasen, med én kilde til sannhet
1. **Unik indeks:** `create unique index user_badges_once_uniq on user_badges(user_id, badge_id) where event_id is null and badge_id in (1,2,3,4,5,6,8,9,12,16);`. Alle innsettinger av disse bruker `on conflict do nothing`. TS-ruten må ignorere feilkode 23505, fordi supabase-js ikke kan peke på en partial index.
2. **`award_participation_badges(p_user_ids uuid[])`:**
   - Security definer, `set search_path = ''`, schema-kvalifiserte navn.
   - Logikken er backfill-skriptets. `null` betyr alle brukere.
   - Returnerer de innsatte radene.
   - `revoke all ... from public, anon, authenticated; grant execute ... to service_role`. Revoke fra anon/authenticated alene holder ikke, fordi PUBLIC har execute som standard.
3. **`mark_event_completed`:**
   - Rett host-feilen til `where role in ('driver','strapper')`.
   - Sett `search_path`.
   - Avslutt med å kalle award-funksjonen for alle deltakere fra alle kilder: sone, vakt, sjåfør, stripser, vert, musikant og event-koblede merker.
   - Nullstill åpne hjelpeforespørsler.
4. **Trigger:** statement-nivå `after insert on user_badges`, med transition table og security definer. Ellers feiler en manuell tildeling gjort av admin via RLS, og hele tildelingen rulles tilbake. Triggeren filtrerer til rader med `event_id` på en fullført hendelse og et merke i deltakelseskategori, og kaller award-funksjonen for de berørte brukerne. Funksjonen setter bare inn `event_id = null`-rader, så gjenkall blir no-op. Kommenter triggeren godt, og nevn den i repoets CLAUDE.md, siden den er "usynlig" oppførsel.
5. **Ingen triggere** på `zone_claims`, `shift_claims`, `driver_assignments` eller `event_musicians`. I stedet kommer en admin-RPC `reevaluate_event_badges(p_event_id)` med en knapp i admin/hendelser for etterregistrering.
6. **`admin/oversikt`** sin Fullfør kaller `mark_event_completed` og viser feil. Det skal bare finnes én fullføringsvei.
7. **TS:**
   - `/api/badges/evaluate` beholder 2, 3, 5, 6, 9 og 16, og kaller SQL-funksjonen via service role for 1, 4, 8 og 12.
   - Gi `evaluateBadges()` nytt navn, `evaluateMyBadges()`, uten argument.
   - Fjern løkka i `admin/hendelser`.
8. Slett `finalize-drivers`. Skriv om backfill-skriptet til `select award_participation_badges(null)`, som reserve.

### Bevisste avgrensninger (dokumenteres)
- Merker fjernes aldri automatisk, heller ikke når en hendelse settes tilbake fra fullført.
- Fjerner admin et terskelmerke fra noen som fortsatt kvalifiserer, kommer det tilbake ved neste evaluering.

### Manuelle merker i admin/medlemmer skal kunne kobles til hendelse (avklart med Tor Martin 28.09)
Å bake kake, lage kaffe osv. til en dugnad skal telle som å ha deltatt på den dugnaden. I dag setter `handleAwardBadge` alltid `event_id = null`. Det gjelder 531 aktivitetsmerker, mot 267 som er koblet.
- For merker i deltakelseskategoriene (`aktivitet`, `17mai`, `sommerkonsert`, `seminar`): vis en nedtrekksliste med hendelser når merket deles ut.
  - Forhåndsvalgt er siste fullførte hendelse, eventuelt aktiv hendelse hvis den finnes.
  - Lista viser de siste 10 hendelsene, nyeste først, med tittel og dato.
  - Valget "Ingen hendelse" skal finnes, men ikke være forhåndsvalgt.
- For andre merker (starter, vanlig, veteran, elite, styret o.l.): ingen nedtrekksliste, uendret oppførsel.
- Stablebare merker med `event_id`: den eksisterende unike indeksen `(user_id, badge_id, event_id)` hindrer samme merke to ganger på samme hendelse. Vis en vennlig melding ("Hun har allerede dette merket for denne dugnaden"), ikke en stille feil.
- Innsettingen trigger automatisk terskelsjekken (punkt 4 over), så Tre på rad osv. kommer med en gang.
- Gjelder både mobil (MemberDetailOverlay) og desktop (MemberDetailDesktop), der merker deles ut.
- **De 531 eksisterende ukoblede merkene røres ikke.** Ingen forsøk på å koble dem til hendelser i ettertid.

### Test (prod-data, bare med rollback)
0. Før migrering: kjør duplikatsjekk og host-15-sjekk på nytt. Begge var 0 den 28.09. Rydder vi noe, må Tor Martin godkjenne det først, fordi merkene er lodd.
1. Ekvivalens: i `begin`, lagre backfill-skriptets SELECT i en temp-tabell, kjør migreringen og `award_participation_badges(null)`, og kjør `except` begge veier. Forventet resultat er 0 rader. Kjente tilfeller skal være med: Hanne, Tesfagabir og Edel. Andre kjøring skal gi 0 nye rader. `rollback`.
2. Bulk: sett inn 5 event-koblede aktivitetsmerker i én statement. Tersklene skal krysses nøyaktig én gang, og det skal ikke gå i løkke. `rollback`.
3. Fullfør to ganger som admin (`set local role authenticated` + jwt-claims). Andre gang skal gi 0 nye rader. `rollback`.
4. Grants: kall som anon/authenticated skal gi "permission denied".
5. Samtidighet: to sesjoner setter inn merke 1 for samme bruker. Én vinner, og den andre gjør ingenting.

---

## Akseptkriterier
1. Vanlig flyt (ferdig, sjåfør henter) er uendret: samme antall trykk og samme push.
2. Tatt med selv:
   - gir ingen push til sjåfører
   - vises riktig i ark, sjåførside, Hjem og eksport
   - teller som ferdig overalt
   - kan angres, også via toast
3. En hjelpeforespørsel kan startes av en plukker på sonen og av admin (ikke på tom sone), bare for bottle-soner som ikke er ferdige.
4. To som trykker "Bli med som hjelper" samtidig: nøyaktig én kommer inn, og den andre får en vennlig melding.
5. Forespørselen lukkes ved hvert nytt claim, ved avbryt, når sonen er ferdig, når siste plukker går, og når hendelsen fullføres.
6. Pulsen er av med `prefers-reduced-motion`. Soner uten forespørsel ser ut akkurat som i dag.
7. Lapper og plast er uendret.
8. Det går ikke lenger an å markere andres soner som ferdig eller hentet, eller å omgå kapasitet via direkte tabelltilgang.
9. Etter Fullfør har alle deltakere riktige terskelmerker, fra alle kilder og uten backfill. Det gjelder også merker satt rett i databasen. Ingen duplikater er mulig.
10. En gammel cachet klient fungerer under og etter deploy.
11. Aktivitetsmerker delt ut i admin/medlemmer kan kobles til en hendelse og teller da som deltakelse med en gang.
