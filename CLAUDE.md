# Dugnadshub - driftskritiske fakta

- Delt prod-database for lokal utvikling og prod. Deploy kun via push til `main`.
- Merkene er lodd i julekonserttrekningen. Ingen sletting i `user_badges` uten Tor Martins OK.

## Automatisk merkeutdeling i databasen (siden 2026-09-29)

- **`award_participation_badges(p_user_ids uuid[])`** eier terskelmerkene Frøspire (1),
  Tre på rad (4), Ringrev (8) og Maskin (12). Den teller fullførte hendelser fra alle kilder:
  sone-claims, vakter, sjåfør/stripser/vert, musikanter og event-koblede merker i kategoriene
  aktivitet, 17mai, sommerkonsert og seminar. `null` = alle brukere. Setter bare inn, sletter
  aldri. Kun `service_role` kan kalle den direkte.
- **Usynlig oppførsel:** triggeren `user_badges_award_participation` (etter insert på
  `user_badges`, statement-nivå) kaller funksjonen når et deltakelsesmerke med `event_id` på en
  fullført hendelse settes inn. Det gjelder også REST-skript og SQL: en bulk-tildeling kan
  derfor gi flere rader enn du satte inn.
- `mark_event_completed` er eneste fullføringsvei og kaller funksjonen for alle deltakere.
  "Oppdater merker" i admin/hendelser kjører `reevaluate_event_badges` ved etterregistrering.
- Unik indeks `user_badges_once_uniq` på engangsmerkene. Bruk `on conflict do nothing`
  uten kolonneliste (partial index).
- Ny deltakelseskategori må inn fire steder: `award_participation_badges`,
  `event_participant_ids`, triggerfunksjonen og `PARTICIPATION_CATEGORIES` i
  `lib/badges/definitions.ts`.
- Kilde: `scripts/migrate-deltakelsesmerker-i-db.sql`. Reserve: `scripts/backfill-deltakelse-merker.sql`.

## Soner

- `zone_claims` skrives bare via RPC-er. Bare `notes` kan oppdateres direkte.
- Tatt med selv = `status = 'picked_up'` + `self_delivered = true`. Ingen ny statusverdi.
- Hjelpeforespørsel = `zone_assignments.help_requested_at` satt. Se `scripts/migrate-sone-sikkerhet-og-hjelp.sql`.
- Migreringer i `scripts/migrate-*.sql`, rollback-tester i `scripts/tester/`.
