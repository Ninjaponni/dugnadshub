# Tilbakemeldinger og ønsker fra brukere

Innboks for innspill fra foreldre og soneledere til Dugnadshub. Ikke en plan: punkter blir liggende her til de enten er løftet til en spec i `docs/superpowers/specs/` eller avvist. Ingen navn eller kontaktinfo på innsendere.

Status: `ny` / `vurderes` / `planlagt` / `gjort` / `avvist`

## 2026-10-07 - forelder, om merker

### 1. Samme merke flere ganger, med oppgradering
Status: gjort (×N-delen, v10.43.x, 12.10), se `docs/superpowers/specs/2026-10-12-merke-per-sone-design.md`. Nivåer på enkeltmerker er ikke med.

Ønske: merker som kan tas flere ganger i året (lappeutdeling, kakebaking, sjåfør o.l.) bør kunne tjenes på nytt, og eventuelt "oppgraderes" i nivå.

Notat: `user_badges` har `event_id` og en unik indeks kun for engangsmerker (`user_badges_once_uniq`), så datamodellen tåler trolig gjentak. Det som mangler er visning (teller/nivå på merket) og regler for hva som er nivåene.

### 2. Merker for dugnaden på Tillerdagen
Status: ny

Spørsmål om det kommer merker for lørdagens dugnad på Tillerdagen. Tillerdagen er et nytt arrangement, så det er ikke laget merker til det ennå. Tidligere arrangement har fått egne merker via migrasjon (17. mai, sommerkonsert, seminar, korpstur).

### 3. Merke for mer enn én sone på samme flaskeinnsamling
Status: gjort (v10.43.x, 12.10), løst som ett merke per sone (Pantejeger), se `docs/superpowers/specs/2026-10-12-merke-per-sone-design.md`

Ønske: eget merke for å ha tatt flere soner i én innsamling.

Notat: finnes ikke i dag. Nærmeste er Nordmester/Sørmester (5 soner i ett område, akkumulert) og Alle soner (minst én i både Nord og Sør), se `app/api/badges/evaluate/route.ts`.

### 4. Uklart hvordan man får appen på hjemskjermen
Status: ny

Innsender så at en annen forelder hadde appen på hjemskjermen, men fikk det ikke til selv. Trolig tolkning (Tor Martin): det handler om å legge Dugnadshub til på hjemskjermen, ikke om et merke. Signal om at installasjonen ikke er lett nok å finne.

Notat: installasjonsveiledningen finnes bare som steg 3 i onboarding (`components/features/onboarding/InstallStep.tsx`, brukt kun i `OnboardingWizard.tsx`). Hopper man forbi der, er det ingen vei tilbake til den. Mulig tiltak: gjenbruk `InstallStep` fra profilsiden, skjult når `isStandalone` er sann.

## 2026-10-10 - Tor Martin, om sjåfør i sonearket

### 5. Vis henter (sjåfør) for sonen i sonearket
Status: gjort (v10.41.11, 10.10)

Ønske: når man trykker på en flaskesone, skal man under "Samlere" også se hvem som henter sonen (sjåføren på hengeren), med mulighet til å ringe.

Beslutninger (Tor Martin 10.10):
- Telefon/ring: samme regel som for medplukkere. Plukkerne på sonen og admin kan ringe, andre ser bare navnet.
- Ingen sjåfør på hengeren ennå: skjul seksjonen.
- Flere sjåfører på samme henger: vis alle.
- Bare flaskeinnsamling. Stripsere (`trailer_group = 0`) er ikke knyttet til soner og vises ikke.

Notat: ingen databaseendring. Koblingen er `zones.trailer_group` + `zones.area` mot `driver_assignments` (event_id, area, trailer_group, role = 'driver'), samme kobling som `app/api/push/notify-drivers/route.ts` bruker. Vises i `components/features/ZoneClaimSheet.tsx`.

## 2026-10-10 - Tor Martin, om bunnarket på iPhone

### 6. Dra-håndtaket på bunnark lar seg ikke dra ned
Status: gjort (v10.42.1, 10.10)

Problem: på iPhone (appen lagt på hjemskjermen) reagerte den grå streken øverst på sonekortet så vidt på fingeren, men kortet lot seg aldri dra ned. Eneste måte å lukke på var å trykke på kartet over kortet.

Årsak: håndtaket starter dra-bevegelsen manuelt (`dragControls.start`), men manglet `touch-action: none`. iOS Safari tolket berøringen som scroll, tok den over og avbrøt dra-bevegelsen. Treffflaten var også bare rundt 28 px høy.

Tiltak: `touch-none` og `py-4` (i stedet for `py-3`) på håndtaket i `components/ui/BottomSheet.tsx`. Gjelder alle bunnark i appen. Testet og bekreftet av Tor Martin på iPhone 10.10.

## 2026-10-12 - soneleder og foreldre, om merker etter Flaskeinnsamling Nord

### 7. Lappeutdelere i Nord fikk ikke Lappemester Nord
Status: gjort (v10.43.x, 12.10), se `docs/superpowers/specs/2026-10-12-merke-per-sone-design.md`

Problem: de 6 som delte ut lapper i Nord 29.09 fikk ikke merket. Lappemester Nord og Sør deles aldri ut automatisk, og har vært gitt manuelt og ulikt (våren uten `event_id`, Sør høst med, Nord høst ikke i det hele tatt).

### 8. Ett merke per sone, og se hvor mange av samme merke man har
Status: gjort (v10.43.x, 12.10), se `docs/superpowers/specs/2026-10-12-merke-per-sone-design.md`

Ønske: å ta en sone er krevende, så hver sone skal gi et merke, både på lappeutdeling og flaskeinnsamling. Man vil også se hvor mange av samme merke man har. ×N vises i dag bare for aktivitetsmerker på mobil.


## 2026-10-12 - Tor Martin, om menyen og medlemsvisningen på iPhone

### 9. Bunnmenyen flytter seg ved scrolling, og medlemsdetaljen vises bak medlemslista
Status: vurderes (12.10: borte etter at appen ble lukket helt og åpnet igjen, trolig iOS-feilen. Følg med om den kommer tilbake.)

Problem: på iPhone (appen på hjemskjermen) flytter bunnmenyen seg opp på skjermen når man scroller, f.eks. på Merker. I admin under Medlemmer vises detaljvisningen for en person bak lista i stedet for over.

Notat: koden for `BottomNav`, `MemberDetailOverlay` og layoutene er ikke endret siden 29.09, og strukturen er riktig (menyen ligger utenfor alt som kan forskyve den, overlayet er `fixed inset-0 z-[45]` og låser scroll). Trolig WebKit-feilen i iOS 26 der `position: fixed`-elementer forskyves når man scroller (WebKit bug 297779, flyttet til Apple). Test først: lukk appen helt og åpne igjen. Er feilen borte en stund og kommer tilbake, er det iOS-feilen. Mulig tiltak i appen hvis den varer: la innholdet scrolle i en egen container (`h-dvh overflow-y-auto`) i stedet for hele dokumentet, så `fixed`-elementene ikke påvirkes av dokumentscroll.
