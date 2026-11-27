-- FormPeak – KI-Wochenplan (SPEC 7.2): Plan pro Woche, Einheiten mit Titel und erklärten Übungen.
-- Die vorgeschlagenen Einheiten sind normale Zeilen in `sessions` (planned_by = 'ai' bzw. 'rules').

alter table public.sessions
  add column title text check (char_length(title) <= 60);

-- Ein Plan pro Nutzer und Woche (Montag). `pending` dient als Sperre gegen doppelte Erstellung.
create table public.week_plans (
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  source text check (source in ('ai', 'rules')),
  -- Wochenfokus in einem Satz.
  focus text check (char_length(focus) <= 300),
  -- true, wenn die Leitplanken den Vorschlag korrigieren mussten.
  adjusted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, week_start)
);
create trigger week_plans_touch before update on public.week_plans
  for each row execute function public.touch_updated_at();

-- Übungen einer vorgeschlagenen Einheit, jede mit Vorgabe und einem Satz Erklärung.
create table public.planned_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid not null,
  position smallint not null check (position between 0 and 20),
  name text not null check (char_length(name) between 1 and 80),
  prescription text check (char_length(prescription) <= 60),
  how text check (char_length(how) <= 300),
  -- Verknüpfung zur Gym-Bibliothek (für das Gym-Log), sonst null.
  exercise_id uuid references public.exercises (id) on delete set null,
  unique (session_id, position),
  foreign key (session_id, user_id) references public.sessions (id, user_id) on delete cascade
);

alter table public.week_plans enable row level security;
alter table public.planned_exercises enable row level security;
create policy week_plans_owner on public.week_plans for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy planned_exercises_owner on public.planned_exercises for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.week_plans, public.planned_exercises to authenticated;
grant all on public.week_plans, public.planned_exercises to service_role;

-- KI-Anfragen protokolliert der Server mit dem Token des Nutzers (RLS: nur eigene Zeilen).
grant insert on public.ai_plans to authenticated;
