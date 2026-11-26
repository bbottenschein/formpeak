-- FormPeak – Ziel mit Trainingsrahmen und Feedback-Erinnerung.

-- Trainingsrahmen: wie viele Zusatzeinheiten pro Woche neben dem Fußball.
-- (Verfügbare Tage, Zeitbudget und Equipment stehen schon in profiles.)
alter table public.profiles
  add column extra_sessions_per_week smallint check (extra_sessions_per_week between 0 and 7),
  add column push_feedback boolean not null default true;

-- „Was willst du erreichen?“ in eigenen Worten.
alter table public.goals
  add column description text check (char_length(description) <= 500);

-- Vorerst genau ein aktives Ziel pro Nutzer.
create unique index goals_one_active_idx on public.goals (user_id) where active;
