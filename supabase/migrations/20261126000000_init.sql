-- FormPeak – initiales Schema (Phase 1, Vorbereitung Phase 2/3).
-- Tabellen, Row Level Security und Hilfsfunktionen. Siehe SPEC.md › Datenmodell.
--
-- Grundsatz: Jede Tabelle mit Nutzerdaten hat user_id und RLS nur für den Besitzer.
-- Der Admin sieht Profile und Einladungen, aber keine Gesundheitsdaten anderer Nutzer.

-- ---------------------------------------------------------------------------
-- Profile, Rollen, Einladungen, Einwilligung
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  role text not null default 'user' check (role in ('user', 'admin')),
  timezone text not null default 'Europe/Berlin',
  locale text not null default 'de' check (locale in ('de', 'en')),
  morning_reminder time not null default '07:30',
  evening_reminder time not null default '21:00',
  -- Einstellungen für Zusatzeinheiten (vom Nutzer frei einzugeben)
  available_weekdays smallint[] not null default '{1,2,3,4,5,6,0}'
    check (available_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  time_budget_min smallint check (time_budget_min is null or time_budget_min between 5 and 240),
  equipment text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Prüft, ob der angemeldete Nutzer Admin ist. SECURITY DEFINER, damit die Abfrage
-- nicht selbst an der RLS von profiles hängen bleibt.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- Rolle nur aus app_metadata (serverseitig gesetzt). Alles außer 'admin' ist 'user'.
create function public.role_from_app_metadata(meta jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when meta ->> 'role' = 'admin' then 'admin' else 'user' end;
$$;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    public.role_from_app_metadata(new.raw_app_meta_data)
  );
  return new;
end;
$$;

create function public.handle_user_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set role = public.role_from_app_metadata(new.raw_app_meta_data)
   where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger on_auth_user_role_changed
  after update of raw_app_meta_data on auth.users
  for each row
  when (old.raw_app_meta_data is distinct from new.raw_app_meta_data)
  execute function public.handle_user_role_change();

-- Rolle darf aus dem Client nicht geändert werden.
create function public.protect_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and current_user = 'authenticated' then
    raise exception 'role can only be changed via app_metadata';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  email text,
  note text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  redeemed_by uuid references public.profiles (id) on delete set null,
  redeemed_at timestamptz
);

-- Einwilligung zur Verarbeitung von Gesundheitsdaten (Art. 9 DSGVO).
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'health_data' check (kind in ('health_data')),
  version text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index consents_user_idx on public.consents (user_id, kind);

-- Vorbereitung Trainer-Modus (Phase 3) – vorerst ungenutzt, keine Policies außer Admin.
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'player' check (role in ('player', 'coach')),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- Kalender: Saisonphasen, Serien, Einheiten
-- ---------------------------------------------------------------------------

create table public.season_phases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('preseason', 'season', 'break')),
  starts_on date not null,
  ends_on date not null,
  check (ends_on >= starts_on)
);
create index season_phases_user_idx on public.season_phases (user_id, starts_on);

create table public.fixture_series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('training', 'match')),
  title text not null default '',
  weekdays smallint[] not null check (
    cardinality(weekdays) > 0 and weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
  ),
  start_time time,
  duration_min smallint not null check (duration_min between 1 and 300),
  expected_intensity text not null default 'medium'
    check (expected_intensity in ('low', 'medium', 'high')),
  default_rpe smallint not null check (default_rpe between 0 and 10),
  valid_from date not null,
  valid_until date,
  season_phase_kind text check (season_phase_kind in ('preseason', 'season', 'break')),
  created_at timestamptz not null default now(),
  check (valid_until is null or valid_until >= valid_from)
);
create index fixture_series_user_idx on public.fixture_series (user_id);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  start_time time,
  type text not null check (
    type in ('training', 'match', 'gym', 'run_intervals', 'mobility', 'recovery')
  ),
  status text not null default 'planned' check (status in ('planned', 'done', 'cancelled')),
  -- Gesetzt bei Fußballterminen aus einer Serie; Einzeltermine (Pokal, Turnier) ohne Serie.
  series_id uuid references public.fixture_series (id) on delete set null,
  -- Ursprüngliches Serien-Datum, wenn ein Termin verschoben wurde (verhindert Doppelung).
  series_date date,
  is_fixture boolean not null default false,
  expected_intensity text check (expected_intensity in ('low', 'medium', 'high')),
  gym_focus text check (gym_focus in ('lower', 'upper', 'full')),
  duration_min smallint not null check (duration_min between 0 and 600),
  target_rpe smallint check (target_rpe between 0 and 10),
  default_rpe smallint not null check (default_rpe between 0 and 10),
  rpe smallint check (rpe between 0 and 10),
  fatigue smallint check (fatigue between 1 and 5),
  match_minutes smallint check (match_minutes between 0 and 150),
  planned_by text not null default 'user' check (planned_by in ('user', 'rules', 'ai')),
  rationale text,
  against_recommendation boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, series_id, series_date),
  check (match_minutes is null or type = 'match'),
  check (gym_focus is null or type = 'gym'),
  check (is_fixture = (type in ('training', 'match')))
);
create index sessions_user_date_idx on public.sessions (user_id, date);

-- ---------------------------------------------------------------------------
-- Check-ins und Schmerz
-- ---------------------------------------------------------------------------

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('morning', 'evening')),
  -- Morgen
  sleep_hours numeric(3, 1) check (sleep_hours between 0 and 16),
  sleep_quality smallint check (sleep_quality between 1 and 5),
  energy smallint check (energy between 1 and 5),
  soreness smallint check (soreness between 1 and 5),
  stress smallint check (stress between 1 and 5),
  -- 10-Sekunden-Zählung × 6
  resting_hr smallint check (resting_hr between 24 and 240),
  -- Abend
  daily_load smallint check (daily_load between 1 and 5),
  evening_stress smallint check (evening_stress between 1 and 5),
  evening_energy smallint check (evening_energy between 1 and 5),
  steps integer check (steps between 0 and 200000),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date, kind),
  unique (id, user_id),
  check (
    kind = 'evening' or (
      sleep_hours is not null and sleep_quality is not null and energy is not null
      and soreness is not null and stress is not null
    )
  ),
  check (
    kind = 'morning' or (
      daily_load is not null and evening_stress is not null and evening_energy is not null
    )
  )
);

create table public.pain_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  checkin_id uuid,
  session_id uuid,
  region text not null check (region in (
    'head_neck', 'shoulder', 'chest', 'abdomen', 'upper_back', 'lower_back',
    'elbow_upper_arm', 'wrist_hand', 'hip', 'groin', 'adductors', 'glutes',
    'thigh_front', 'thigh_back', 'knee', 'shin', 'calf', 'achilles', 'ankle', 'foot_heel'
  )),
  side text not null check (side in ('left', 'right', 'center')),
  intensity smallint not null check (intensity between 0 and 10),
  kind text not null default 'unclear' check (kind in ('muscle', 'joint', 'tendon', 'unclear')),
  swollen boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (checkin_id, user_id) references public.checkins (id, user_id) on delete cascade,
  foreign key (session_id, user_id) references public.sessions (id, user_id) on delete cascade,
  check ((checkin_id is null) <> (session_id is null))
);
create index pain_entries_user_date_idx on public.pain_entries (user_id, date);

-- ---------------------------------------------------------------------------
-- Gym-Log
-- ---------------------------------------------------------------------------

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  -- null = globale Bibliothek, sonst eigene Übung des Nutzers
  user_id uuid references public.profiles (id) on delete cascade,
  name text not null,
  muscle_group text not null check (muscle_group in (
    'legs', 'posterior_chain', 'adductors', 'calves', 'core', 'chest', 'back', 'shoulders', 'arms', 'full_body'
  )),
  equipment text not null check (equipment in (
    'barbell', 'dumbbell', 'kettlebell', 'machine', 'cable', 'band', 'bodyweight', 'other'
  )),
  lower_body boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index exercises_global_name_idx on public.exercises (lower(name)) where user_id is null;
create unique index exercises_user_name_idx on public.exercises (user_id, lower(name)) where user_id is not null;

create table public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid not null,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position smallint not null check (position >= 0),
  -- Vorschlag (Progression / später KI)
  target_weight_kg numeric(5, 1),
  target_reps smallint,
  target_sets smallint,
  note text,
  unique (id, user_id),
  foreign key (session_id, user_id) references public.sessions (id, user_id) on delete cascade
);
create index session_exercises_session_idx on public.session_exercises (session_id, position);

create table public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_exercise_id uuid not null,
  position smallint not null check (position >= 0),
  -- kg in 0,5er-Schritten; bei Körpergewicht 0 oder Zusatzgewicht
  weight_kg numeric(5, 1) not null default 0 check (weight_kg >= 0 and weight_kg * 2 = round(weight_kg * 2)),
  reps smallint not null check (reps between 0 and 200),
  rir smallint check (rir between 0 and 4),
  set_type text not null default 'working' check (set_type in ('warmup', 'working')),
  created_at timestamptz not null default now(),
  foreign key (session_exercise_id, user_id)
    references public.session_exercises (id, user_id) on delete cascade
);
create index exercise_sets_parent_idx on public.exercise_sets (session_exercise_id, position);

-- ---------------------------------------------------------------------------
-- Berechnete Kennzahlen, Ziele, KI (Phase 2)
-- ---------------------------------------------------------------------------

create table public.daily_metrics (
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  day_load integer not null default 0,
  acute_load integer not null default 0,
  chronic_load numeric(8, 2) not null default 0,
  acwr numeric(4, 2),
  ewma_ratio numeric(4, 2),
  calibration_days_left smallint not null default 0,
  readiness smallint check (readiness between 0 and 100),
  light text not null check (light in ('grey', 'green', 'yellow', 'red')),
  reasons jsonb not null default '[]'::jsonb,
  pain_spots jsonb not null default '[]'::jsonb,
  computed_at timestamptz not null default now(),
  primary key (user_id, date)
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('endurance', 'speed', 'strength', 'prevention', 'comeback')),
  test_name text,
  baseline_value numeric,
  target_value numeric,
  unit text,
  target_date date,
  priority smallint not null default 1 check (priority between 1 and 3),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.goal_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  goal_id uuid not null,
  date date not null,
  value numeric not null,
  note text,
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete cascade
);

create table public.ai_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('week', 'day', 'tips', 'month')),
  for_date date not null,
  prompt_version text not null,
  model text not null,
  context jsonb not null,
  response jsonb,
  validation jsonb,
  created_at timestamptz not null default now()
);
create index ai_plans_user_idx on public.ai_plans (user_id, for_date desc);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger sessions_touch before update on public.sessions
  for each row execute function public.touch_updated_at();
create trigger checkins_touch before update on public.checkins
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.invitations enable row level security;
alter table public.consents enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.season_phases enable row level security;
alter table public.fixture_series enable row level security;
alter table public.sessions enable row level security;
alter table public.checkins enable row level security;
alter table public.pain_entries enable row level security;
alter table public.exercises enable row level security;
alter table public.session_exercises enable row level security;
alter table public.exercise_sets enable row level security;
alter table public.daily_metrics enable row level security;
alter table public.goals enable row level security;
alter table public.goal_tests enable row level security;
alter table public.ai_plans enable row level security;

-- Profile: eigenes Profil lesen/ändern; Admin liest alle Profile (keine Gesundheitsdaten).
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Einladungen: nur Admin. Eingelöst wird serverseitig mit dem Secret Key.
create policy invitations_admin on public.invitations for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Teams: vorerst nur Admin (Trainer-Modus folgt in Phase 3).
create policy teams_admin on public.teams for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy team_members_admin on public.team_members for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Übungen: globale Bibliothek für alle lesbar, eigene Übungen nur für den Besitzer.
create policy exercises_select on public.exercises for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy exercises_insert on public.exercises for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy exercises_update on public.exercises for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy exercises_delete on public.exercises for delete to authenticated
  using (user_id = (select auth.uid()));

-- Alle übrigen Nutzertabellen: nur der Besitzer, ohne Admin-Ausnahme.
do $$
declare
  t text;
begin
  foreach t in array array[
    'consents', 'push_subscriptions', 'season_phases', 'fixture_series', 'sessions',
    'checkins', 'pain_entries', 'session_exercises', 'exercise_sets', 'daily_metrics',
    'goals', 'goal_tests', 'ai_plans'
  ] loop
    execute format(
      'create policy %1$s_owner on public.%1$s for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechte für die Data API (neuere Projekte vergeben sie nicht mehr automatisch).
-- Welche Zeilen jemand sieht, regelt RLS.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
-- Profile werden per Trigger angelegt und nie aus dem Client gelöscht (Konto löschen läuft serverseitig).
revoke insert, delete on public.profiles from authenticated;
-- ai_plans schreibt nur der Server mit dem Secret Key.
revoke insert, update, delete on public.ai_plans from authenticated;
grant all on all tables in schema public to service_role;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Startbibliothek: Übungen (global)
-- ---------------------------------------------------------------------------

insert into public.exercises (name, muscle_group, equipment, lower_body) values
  -- Beine
  ('Kniebeuge (Back Squat)', 'legs', 'barbell', true),
  ('Frontkniebeuge', 'legs', 'barbell', true),
  ('Goblet Squat', 'legs', 'kettlebell', true),
  ('Bulgarian Split Squat', 'legs', 'dumbbell', true),
  ('Ausfallschritte (Lunges)', 'legs', 'dumbbell', true),
  ('Step-up', 'legs', 'dumbbell', true),
  ('Beinpresse', 'legs', 'machine', true),
  ('Beinstrecker', 'legs', 'machine', true),
  ('Spanish Squat', 'legs', 'band', true),
  ('Box Jump', 'legs', 'bodyweight', true),
  -- Hintere Kette
  ('Kreuzheben (Deadlift)', 'posterior_chain', 'barbell', true),
  ('Rumänisches Kreuzheben (RDL)', 'posterior_chain', 'barbell', true),
  ('Single-Leg RDL', 'posterior_chain', 'dumbbell', true),
  ('Hip Thrust', 'posterior_chain', 'barbell', true),
  ('Glute Bridge einbeinig', 'posterior_chain', 'bodyweight', true),
  ('Nordic Curl', 'posterior_chain', 'bodyweight', true),
  ('Beinbeuger (Leg Curl)', 'posterior_chain', 'machine', true),
  ('Kettlebell Swing', 'posterior_chain', 'kettlebell', true),
  -- Adduktoren, Waden
  ('Copenhagen Plank', 'adductors', 'bodyweight', true),
  ('Adduktoren-Maschine', 'adductors', 'machine', true),
  ('Wadenheben stehend', 'calves', 'machine', true),
  ('Wadenheben einbeinig', 'calves', 'bodyweight', true),
  ('Soleus-Wadenheben sitzend', 'calves', 'machine', true),
  -- Rumpf
  ('Plank', 'core', 'bodyweight', false),
  ('Seitstütz (Side Plank)', 'core', 'bodyweight', false),
  ('Pallof Press', 'core', 'cable', false),
  ('Dead Bug', 'core', 'bodyweight', false),
  ('Hanging Knee Raise', 'core', 'bodyweight', false),
  ('Rückenstrecker (Back Extension)', 'core', 'machine', false),
  -- Oberkörper
  ('Bankdrücken', 'chest', 'barbell', false),
  ('Kurzhantel-Bankdrücken', 'chest', 'dumbbell', false),
  ('Liegestütz', 'chest', 'bodyweight', false),
  ('Klimmzug', 'back', 'bodyweight', false),
  ('Latzug', 'back', 'cable', false),
  ('Rudern vorgebeugt', 'back', 'barbell', false),
  ('Kurzhantel-Rudern einarmig', 'back', 'dumbbell', false),
  ('Schulterdrücken', 'shoulders', 'dumbbell', false),
  ('Face Pull', 'shoulders', 'cable', false),
  ('Bizepscurl', 'arms', 'dumbbell', false),
  ('Trizepsdrücken am Kabel', 'arms', 'cable', false),
  -- Ganzkörper
  ('Farmer''s Walk', 'full_body', 'dumbbell', false),
  ('Medizinball-Wurf', 'full_body', 'other', false);
