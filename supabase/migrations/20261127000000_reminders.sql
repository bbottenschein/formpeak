-- FormPeak – Push-Erinnerungen für Morgen- und Abend-Check-in.
--
-- Einmalig in Supabase (SQL Editor) die beiden Vault-Secrets anlegen, sonst tut der Job nichts:
--   select vault.create_secret('https://<deine-app>.vercel.app', 'formpeak_app_url');
--   select vault.create_secret('<JOBS_SECRET aus Vercel>', 'formpeak_jobs_secret');

-- Erinnerungen einzeln abschaltbar (Uhrzeiten stehen schon in profiles).
alter table public.profiles
  add column push_morning boolean not null default true,
  add column push_evening boolean not null default true;

-- Verhindert doppelte Pushes (jede Erinnerung höchstens einmal pro Tag). Nur serverseitig.
create table public.notification_log (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  ref text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, ref)
);
alter table public.notification_log enable row level security;
grant all on public.notification_log to service_role;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Ruft eine geschützte Job-Route der App auf (Authorization: Bearer JOBS_SECRET).
create function public.call_job(p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'formpeak_app_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'formpeak_jobs_secret';

  if v_url is null or v_secret is null then
    raise notice 'call_job(%): Vault-Secrets formpeak_app_url / formpeak_jobs_secret fehlen', p_path;
    return;
  end if;

  perform net.http_post(
    url := rtrim(v_url, '/') || p_path,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end;
$$;

revoke execute on function public.call_job(text) from public, anon, authenticated;

-- Alle 15 Minuten. Die Route prüft pro Nutzer die Uhrzeit in seiner Zeitzone (idempotent).
select cron.schedule('formpeak-reminders', '*/15 * * * *', $$select public.call_job('/api/jobs/reminders')$$);
