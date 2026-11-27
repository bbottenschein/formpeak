-- FormPeak – Inhalte vorgeschlagener Einheiten (für Verschieben/Tauschen mit Pflichtinhalten)
-- und Wochen-/Monatsrückblicke.

alter table public.sessions
  add column focus text[] not null default '{}';

-- Rückblick pro Woche (Montag) bzw. Monat (1. des Monats): Kennzahlen und ein KI-Satz.
create table public.reviews (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('week', 'month')),
  period_start date not null,
  stats jsonb not null,
  text text check (char_length(text) <= 1200),
  source text check (source in ('ai', 'rules')),
  created_at timestamptz not null default now(),
  primary key (user_id, kind, period_start)
);
alter table public.reviews enable row level security;
create policy reviews_owner on public.reviews for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.reviews to authenticated;
grant all on public.reviews to service_role;
