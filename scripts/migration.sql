-- Dugnadshub — Database-migrasjon for Supabase
-- Kjør denne i Supabase SQL Editor (dashboard.supabase.com → SQL)

-- ============================================================
-- TABELLER
-- ============================================================

-- Profiler (utvider Supabase auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text not null,
  phone text,
  children jsonb default '[]'::jsonb,
  role text not null default 'collector' check (role in ('admin', 'collector', 'driver', 'strapper')),
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Soner (35 stk — N1-N15, S1-S20)
create table public.zones (
  id text primary key,
  name text not null,
  area text not null check (area in ('NORD', 'SOR')),
  households int not null default 0,
  collectors_needed int not null default 2,
  trailer_group int not null default 1,
  geometry jsonb,
  notes text
);

-- Oppsamlingspunkter
create table public.drop_points (
  id text primary key,
  name text not null,
  area text not null check (area in ('NORD', 'SOR')),
  lat double precision not null,
  lng double precision not null
);

-- Hendelser (dugnader, lotterier etc.)
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null default 'bottle_collection' check (type in ('bottle_collection', 'lottery', 'baking', 'other')),
  date date not null,
  start_time time,
  status text not null default 'upcoming' check (status in ('upcoming', 'active', 'completed')),
  description text,
  created_by uuid references public.profiles(id)
);

-- Sone-tilordning per hendelse
create table public.zone_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  zone_id text not null references public.zones(id),
  status text not null default 'available' check (status in ('available', 'claimed', 'in_progress', 'completed', 'picked_up')),
  unique(event_id, zone_id)
);

-- Hvem har tatt hvilken sone
create table public.zone_claims (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.zone_assignments(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  claimed_at timestamptz not null default now(),
  unique(assignment_id, user_id)
);

-- Sjåfør-tilordninger
create table public.driver_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  trailer_group int not null,
  area text not null check (area in ('NORD', 'SOR'))
);

-- Deltakelseslogg (for badge-beregning)
create table public.participation_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  event_id uuid not null references public.events(id),
  role text not null default 'collector',
  zones_completed int not null default 0,
  completed_at timestamptz not null default now()
);

-- Badges (15 forhåndsdefinerte)
create table public.badges (
  id int primary key,
  name text not null,
  description text not null,
  icon text not null,
  category text not null check (category in ('starter', 'vanlig', 'veteran', 'elite', 'rolle')),
  auto_criteria text
);

-- Bruker-badges
create table public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  badge_id int not null references public.badges(id),
  awarded_at timestamptz not null default now(),
  event_id uuid references public.events(id)
);

-- Push-abonnementer
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

alter table public.profiles enable row level security;
alter table public.zones enable row level security;
alter table public.drop_points enable row level security;
alter table public.events enable row level security;
alter table public.zone_assignments enable row level security;
alter table public.zone_claims enable row level security;
alter table public.driver_assignments enable row level security;
alter table public.participation_log enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.push_subscriptions enable row level security;

-- Hjelpefunksjon: sjekk om bruker er admin
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer;

-- PROFILES: alle kan se, kun eier kan oppdatere
create policy "profiles: alle kan lese" on public.profiles for select using (true);
create policy "profiles: eier kan oppdatere" on public.profiles for update using (auth.uid() = id);
create policy "profiles: eier kan sette inn" on public.profiles for insert with check (auth.uid() = id);

-- ZONES: alle kan lese, admin kan endre
create policy "zones: alle kan lese" on public.zones for select using (true);
create policy "zones: admin kan endre" on public.zones for all using (public.is_admin());

-- DROP_POINTS: alle kan lese
create policy "drop_points: alle kan lese" on public.drop_points for select using (true);
create policy "drop_points: admin kan endre" on public.drop_points for all using (public.is_admin());

-- EVENTS: alle kan lese, admin kan opprette/endre
create policy "events: alle kan lese" on public.events for select using (true);
create policy "events: admin kan endre" on public.events for all using (public.is_admin());

-- ZONE_ASSIGNMENTS: alle kan lese, admin + RPC kan endre
create policy "zone_assignments: alle kan lese" on public.zone_assignments for select using (true);
create policy "zone_assignments: admin kan endre" on public.zone_assignments for all using (public.is_admin());

-- ZONE_CLAIMS: alle kan lese, innloggede kan sette inn/slette egne
create policy "zone_claims: alle kan lese" on public.zone_claims for select using (true);
create policy "zone_claims: bruker kan sette inn" on public.zone_claims for insert with check (auth.uid() = user_id);
create policy "zone_claims: bruker kan slette egne" on public.zone_claims for delete using (auth.uid() = user_id);

-- DRIVER_ASSIGNMENTS: alle kan lese, admin kan endre
create policy "driver_assignments: alle kan lese" on public.driver_assignments for select using (true);
create policy "driver_assignments: admin kan endre" on public.driver_assignments for all using (public.is_admin());

-- PARTICIPATION_LOG: alle kan lese, admin kan endre
create policy "participation_log: alle kan lese" on public.participation_log for select using (true);
create policy "participation_log: admin kan endre" on public.participation_log for all using (public.is_admin());

-- BADGES: alle kan lese
create policy "badges: alle kan lese" on public.badges for select using (true);
create policy "badges: admin kan endre" on public.badges for all using (public.is_admin());

-- USER_BADGES: alle kan lese, admin kan endre
create policy "user_badges: alle kan lese" on public.user_badges for select using (true);
create policy "user_badges: admin kan endre" on public.user_badges for all using (public.is_admin());

-- PUSH_SUBSCRIPTIONS: kun eier kan lese/endre
create policy "push: eier kan lese" on public.push_subscriptions for select using (auth.uid() = user_id);
create policy "push: eier kan sette inn" on public.push_subscriptions for insert with check (auth.uid() = user_id);
create policy "push: eier kan slette" on public.push_subscriptions for delete using (auth.uid() = user_id);

-- ============================================================
-- REALTIME
-- ============================================================

-- Aktiver realtime for sone-oppdateringer
alter publication supabase_realtime add table public.zone_assignments;
alter publication supabase_realtime add table public.zone_claims;
alter publication supabase_realtime add table public.user_badges;

-- ============================================================
-- RPC-FUNKSJONER (atomiske operasjoner)
-- ============================================================

-- Claim en sone (atomisk — sjekker maks claims)
create or replace function public.claim_zone(p_event_id uuid, p_zone_id text)
returns void as $$
declare
  v_assignment_id uuid;
  v_max int;
  v_current int;
begin
  -- Finn assignment
  select za.id into v_assignment_id
  from public.zone_assignments za
  where za.event_id = p_event_id and za.zone_id = p_zone_id;

  if v_assignment_id is null then
    raise exception 'Sone ikke funnet for denne hendelsen';
  end if;

  -- Hent maks antall samlere
  select z.collectors_needed into v_max
  from public.zones z
  where z.id = p_zone_id;

  -- Tell nåværende claims
  select count(*) into v_current
  from public.zone_claims zc
  where zc.assignment_id = v_assignment_id;

  if v_current >= v_max then
    raise exception 'Sonen er allerede full';
  end if;

  -- Sett inn claim
  insert into public.zone_claims (assignment_id, user_id)
  values (v_assignment_id, auth.uid());

  -- Oppdater status
  if v_current + 1 >= v_max then
    update public.zone_assignments set status = 'claimed' where id = v_assignment_id;
  end if;
end;
$$ language plpgsql security definer;

-- Unclaim en sone
create or replace function public.unclaim_zone(p_event_id uuid, p_zone_id text)
returns void as $$
declare
  v_assignment_id uuid;
  v_remaining int;
begin
  select za.id into v_assignment_id
  from public.zone_assignments za
  where za.event_id = p_event_id and za.zone_id = p_zone_id;

  -- Slett brukerens claim
  delete from public.zone_claims
  where assignment_id = v_assignment_id and user_id = auth.uid();

  -- Tell gjenværende claims
  select count(*) into v_remaining
  from public.zone_claims zc
  where zc.assignment_id = v_assignment_id;

  -- Oppdater status tilbake til available hvis ingen claims
  if v_remaining = 0 then
    update public.zone_assignments set status = 'available' where id = v_assignment_id;
  end if;
end;
$$ language plpgsql security definer;

-- Marker sone som ferdig
create or replace function public.mark_zone_complete(p_assignment_id uuid)
returns void as $$
begin
  update public.zone_assignments
  set status = 'completed'
  where id = p_assignment_id;
end;
$$ language plpgsql security definer;

-- Sjåfør markerer sone som hentet
create or replace function public.mark_zone_picked_up(p_assignment_id uuid)
returns void as $$
begin
  update public.zone_assignments
  set status = 'picked_up'
  where id = p_assignment_id;
end;
$$ language plpgsql security definer;

-- ============================================================
-- TRIGGER: Opprett profil automatisk ved ny bruker
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- SEED: Badges
-- ============================================================

insert into public.badges (id, name, description, icon, category, auto_criteria) values
(1, 'Spire', 'Fullførte din første dugnad', '🌱', 'starter', 'first_event'),
(2, 'Kartleser', 'Tok en sone for første gang', '🗺️', 'starter', 'first_zone_claim'),
(3, 'Lagspiller', 'Fullførte sone med en partner', '🤝', 'starter', 'paired_completion'),
(4, 'Dugnadssoldat', '3 dugnader fullført', '⭐', 'vanlig', 'events_3'),
(5, 'Nordmester', '5 soner i Nord', '🧭', 'vanlig', 'nord_zones_5'),
(6, 'Sørmester', '5 soner i Sør', '🏔️', 'vanlig', 'sor_zones_5'),
(7, 'Regnvæksjer', 'Stilte opp i dårlig vær', '🌧️', 'vanlig', null),
(8, 'Veteran', '10 dugnader fullført', '🎖️', 'veteran', 'events_10'),
(9, 'Alle soner', 'Minst én sone i hvert område', '🌍', 'veteran', 'both_areas'),
(10, 'Mentor', 'Paret med nybegynner', '🎓', 'veteran', null),
(11, 'Årgangsamler', 'Alle 4 innsamlinger i ett år', '🏆', 'elite', 'all_yearly'),
(12, 'Ustoppelig', '20+ dugnader totalt', '💎', 'elite', 'events_20'),
(13, 'Legende', 'Spesiell anerkjennelse', '👑', 'elite', null),
(14, 'Veiviser', '10 hentinger som sjåfør', '🚗', 'rolle', 'driver_pickups_10'),
(15, 'Stripsemester', '5 ganger som stripser', '🔧', 'rolle', 'strapper_5');
