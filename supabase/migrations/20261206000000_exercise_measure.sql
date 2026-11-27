-- FormPeak – Art der Eingabe pro geplanter Übung: Gewicht × Wdh, nur Wdh, Zeit oder nur abhaken.
alter table public.planned_exercises
  add column measure text check (measure in ('weight_reps', 'reps', 'time', 'check'));
