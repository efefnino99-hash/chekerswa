create table if not exists public.profiles (
  telegram_id bigint primary key,
  username text,
  premium_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.usage_daily (
  telegram_id bigint not null references public.profiles(telegram_id) on delete cascade,
  usage_date date not null,
  used integer not null default 0 check (used >= 0),
  primary key (telegram_id, usage_date)
);

alter table public.profiles enable row level security;
alter table public.usage_daily enable row level security;

-- The backend uses the Supabase service role key. Do not expose it to clients.
revoke all on public.profiles from anon, authenticated;
revoke all on public.usage_daily from anon, authenticated;

create or replace function public.consume_quota(
  p_telegram_id bigint,
  p_usage_date date,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  if p_limit < 1 then
    return false;
  end if;

  insert into public.usage_daily (telegram_id, usage_date, used)
  values (p_telegram_id, p_usage_date, 1)
  on conflict (telegram_id, usage_date)
  do update
    set used = public.usage_daily.used + 1
    where public.usage_daily.used < p_limit;

  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

revoke all on function public.consume_quota(bigint, date, integer)
from public, anon, authenticated;

grant execute on function public.consume_quota(bigint, date, integer)
to service_role;
