-- FormPeak – Off-Season (SPEC 7.3): Pause ohne Teamtraining und Spiele mit eigenem Trainingsrahmen.
-- Eine Pause ist eine Saisonphase vom Typ 'break'. Ende offen (null), solange der Start der
-- Vorbereitung nicht feststeht.

alter table public.season_phases alter column ends_on drop not null;

alter table public.season_phases
  -- Erholungswochen zu Beginn (vom Nutzer gewählt).
  add column recovery_weeks smallint not null default 0 check (recovery_weeks between 0 and 2),
  -- Rahmen während der Pause (ersetzt den Saison-Rahmen aus profiles, solange die Pause läuft).
  add column extra_sessions_per_week smallint check (extra_sessions_per_week between 0 and 7),
  add column available_weekdays smallint[] not null default '{}'
    check (available_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  add column time_budget_min smallint check (time_budget_min between 10 and 240),
  add column equipment text[] not null default '{}',
  add column created_at timestamptz not null default now();

-- Wissenschaftliche Grundlage einer vorgeschlagenen Einheit (Schlüssel aus einer festen Liste
-- geprüfter Quellen, siehe src/features/plan/basis.ts).
alter table public.sessions
  add column basis text[] not null default '{}';
