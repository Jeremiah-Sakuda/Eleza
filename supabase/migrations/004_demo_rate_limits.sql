create table if not exists demo_ip_daily_limits (
  limit_day date not null,
  ip_hash text not null,
  session_count integer not null default 0 check (session_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (limit_day, ip_hash)
);

create table if not exists demo_global_daily_limits (
  limit_day date primary key,
  session_count integer not null default 0 check (session_count >= 0),
  updated_at timestamptz not null default now()
);

create or replace function claim_demo_session(
  p_ip_hash text,
  p_ip_limit integer default 5,
  p_global_limit integer default 100
)
returns table (allowed boolean, reason text, ip_count integer, global_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_ip_count integer;
  v_global_count integer;
begin
  insert into demo_ip_daily_limits (limit_day, ip_hash, session_count)
  values (v_day, p_ip_hash, 1)
  on conflict (limit_day, ip_hash) do update
    set session_count = demo_ip_daily_limits.session_count + 1,
        updated_at = now()
  returning session_count into v_ip_count;

  select session_count into v_global_count
  from demo_global_daily_limits
  where limit_day = v_day;
  v_global_count := coalesce(v_global_count, 0);

  if v_ip_count > p_ip_limit then
    return query select false, 'ip_daily_cap'::text, v_ip_count, v_global_count;
    return;
  end if;

  insert into demo_global_daily_limits (limit_day, session_count)
  values (v_day, 1)
  on conflict (limit_day) do update
    set session_count = demo_global_daily_limits.session_count + 1,
        updated_at = now()
  returning session_count into v_global_count;

  if v_global_count > p_global_limit then
    return query select false, 'global_daily_cap'::text, v_ip_count, v_global_count;
    return;
  end if;

  return query select true, 'allowed'::text, v_ip_count, v_global_count;
end;
$$;

revoke all on function claim_demo_session(text, integer, integer) from public;
grant execute on function claim_demo_session(text, integer, integer) to service_role;
