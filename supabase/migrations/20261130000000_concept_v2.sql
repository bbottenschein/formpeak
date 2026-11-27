-- FormPeak – Konzept v2 (docs/AENDERUNGEN.md):
-- neue Ziele, Referenztests mit Termin und Ergebnis, Körpermaße,
-- Vorbereitung Trainer-Modus (Rollen und Freigaben pro Spieler).

-- ---------------------------------------------------------------------------
-- Ziele: Muskelaufbau und Gewichtsabnahme, neuer Testkatalog
-- ---------------------------------------------------------------------------

alter table public.goals drop constraint goals_type_check;
alter table public.goals add constraint goals_type_check check (
  type in ('endurance', 'speed', 'strength', 'muscle_gain', 'weight_loss', 'prevention', 'comeback')
);

-- Alte Testschlüssel auf den neuen Katalog abbilden.
update public.goals set test_key = 'run3k', unit = 'min' where test_key = 'cooper12';
update public.goals set test_key = 'sprint20' where test_key = 'sprint30';

alter table public.goals drop constraint goals_test_key_check;
alter table public.goals add constraint goals_test_key_check check (
  test_key in (
    'yoyo_ir1', 'run3k', 'sprint10', 'sprint20', 'cmj', 'squat_5rm', 'bench_5rm',
    'body_weight', 'waist', 'single_leg_hop', 'y_balance'
  )
);

-- ---------------------------------------------------------------------------
-- Referenztests: Termin, Status, Ergebnis
-- ---------------------------------------------------------------------------

alter table public.goal_tests
  alter column date drop not null,
  alter column value drop not null,
  add column test_key text not null default 'yoyo_ir1',
  add column scheduled_for date,
  add column status text not null default 'done' check (status in ('planned', 'done', 'skipped')),
  add column created_at timestamptz not null default now();
alter table public.goal_tests alter column test_key drop default;
alter table public.goal_tests add constraint goal_tests_test_key_check check (
  test_key in (
    'yoyo_ir1', 'run3k', 'sprint10', 'sprint20', 'cmj', 'squat_5rm', 'bench_5rm',
    'body_weight', 'waist', 'single_leg_hop', 'y_balance'
  )
);
alter table public.goal_tests add constraint goal_tests_done_has_value check (
  status <> 'done' or (value is not null and date is not null)
);
create index goal_tests_goal_idx on public.goal_tests (goal_id, coalesce(date, scheduled_for));

-- ---------------------------------------------------------------------------
-- Körpermaße (Muskelaufbau, Gewichtsabnahme)
-- ---------------------------------------------------------------------------

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  weight_kg numeric(5, 1) check (weight_kg between 30 and 250),
  waist_cm numeric(5, 1) check (waist_cm between 40 and 200),
  created_at timestamptz not null default now(),
  unique (user_id, date),
  check (weight_kg is not null or waist_cm is not null)
);
alter table public.body_measurements enable row level security;
create policy body_measurements_owner on public.body_measurements for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Trainer-Modus (nur Datenmodell, noch keine Oberfläche)
-- ---------------------------------------------------------------------------
-- team_members.role: 'player' (Spieler) | 'coach' (Trainer) – existiert seit init.

-- Freigaben pro Spieler und Team. Ampel und Verfügbarkeit sind immer geteilt; Schmerzdetails und
-- Notizen nur mit ausdrücklicher Zustimmung. Trainer-Lesezugriff folgt mit dem Trainer-Modus
-- (eigene Policies, die diese Freigaben prüfen) – bis dahin sieht jeder nur seine eigenen Zeilen.
create table public.sharing_settings (
  team_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  share_light boolean not null default true check (share_light),
  share_availability boolean not null default true check (share_availability),
  share_pain_details boolean not null default false,
  share_notes boolean not null default false,
  pain_consent_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (team_id, user_id),
  foreign key (team_id, user_id) references public.team_members (team_id, user_id) on delete cascade,
  -- Schmerzdetails nur mit dokumentierter Einwilligung.
  check (not share_pain_details or pain_consent_at is not null)
);
alter table public.sharing_settings enable row level security;
create policy sharing_settings_owner on public.sharing_settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.body_measurements, public.sharing_settings to authenticated;
grant all on public.body_measurements, public.sharing_settings to service_role;
