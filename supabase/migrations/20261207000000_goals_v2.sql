-- FormPeak – Ziele v2: mehrere Schwerpunkte pro Ziel, Zeitraum, Archiv mit Ergebnis.
-- `type` und `test_key` bleiben als erster Schwerpunkt bzw. erster Test (Kompatibilität).

alter table public.goals
  add column focuses text[] not null default '{}'
    check (focuses <@ array['endurance', 'speed', 'strength', 'muscle_gain', 'weight_loss', 'prevention', 'comeback']::text[]),
  add column test_keys text[] not null default '{}',
  -- Zielwerte pro Test, z. B. {"sprint10": 1.85}
  add column targets jsonb not null default '{}',
  add column starts_on date,
  add column ended_on date,
  add column outcome text check (outcome in ('achieved', 'partly', 'missed', 'open'));

update public.goals
set focuses = array[type],
    test_keys = case when test_key is null then '{}' else array[test_key] end,
    targets = case when test_key is not null and target_value is not null
                   then jsonb_build_object(test_key, target_value) else '{}' end,
    starts_on = created_at::date;

create index goals_user_archive_idx on public.goals (user_id, ended_on desc) where not active;
