alter table submissions add column if not exists profile_id text not null default 'essay';
alter table viva_sessions add column if not exists profile_id text not null default 'essay';
alter table dossiers add column if not exists profile_id text not null default 'essay';

create index if not exists submissions_profile_created_idx on submissions (profile_id, created_at desc);
create index if not exists viva_sessions_profile_created_idx on viva_sessions (profile_id, created_at desc);
create index if not exists dossiers_profile_created_idx on dossiers (profile_id, created_at desc);

drop function if exists create_public_viva_session(text, jsonb, text, text, uuid, integer, text, integer, text, integer);

create function create_public_viva_session(
  p_ip_hash text,
  p_graph jsonb,
  p_source_text text,
  p_title text,
  p_submission_id uuid default null,
  p_profile_id text default 'essay',
  p_duration_limit_ms integer default 120000,
  p_session_kind text default 'judge',
  p_global_limit integer default 200,
  p_rate_limit_tier text default 'public',
  p_judge_limit integer default 50
)
returns table (
  allowed boolean,
  reason text,
  viva_session_id uuid,
  ip_count integer,
  global_count integer,
  applied_duration_limit_ms integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  v_ip_count integer;
  v_public_count integer;
  v_judge_count integer;
  v_session_id uuid;
  v_duration integer := least(greatest(p_duration_limit_ms, 30000), 150000);
  v_profile_id text := p_profile_id;
begin
  if p_rate_limit_tier not in ('public', 'judge_code') then
    raise exception 'Unknown rate-limit tier';
  end if;
  perform pg_advisory_xact_lock(hashtext('eleza-public-viva-' || v_day_start::text));

  select count(*)::integer into v_ip_count
  from viva_sessions
  where request_ip_hash = p_ip_hash and rate_limit_tier = 'public' and created_at >= v_day_start;

  select count(*)::integer into v_public_count
  from viva_sessions
  where request_ip_hash is not null and rate_limit_tier = 'public' and created_at >= v_day_start;

  select count(*)::integer into v_judge_count
  from viva_sessions
  where rate_limit_tier = 'judge_code' and created_at >= v_day_start;

  if p_rate_limit_tier = 'judge_code' then
    if v_judge_count >= p_judge_limit then
      return query select false, 'judge_daily_cap'::text, null::uuid, v_ip_count, v_judge_count, v_duration;
      return;
    end if;
  else
    if v_ip_count >= 5 then
      return query select false, 'ip_daily_cap'::text, null::uuid, v_ip_count, v_public_count, v_duration;
      return;
    end if;
    if v_public_count >= p_global_limit then
      return query select false, 'global_daily_cap'::text, null::uuid, v_ip_count, v_public_count, v_duration;
      return;
    end if;
  end if;

  if p_submission_id is not null then
    select profile_id into v_profile_id from submissions where id = p_submission_id;
    if v_profile_id is null then
      raise exception 'Submission profile is not available';
    end if;
  end if;

  insert into viva_sessions (
    submission_id, profile_id, graph, source_text, title, status, request_ip_hash,
    duration_limit_ms, session_kind, rate_limit_tier
  ) values (
    p_submission_id, v_profile_id, p_graph, p_source_text, p_title, 'live', p_ip_hash,
    v_duration, p_session_kind, p_rate_limit_tier
  ) returning id into v_session_id;

  if p_rate_limit_tier = 'judge_code' then
    return query select true, 'allowed'::text, v_session_id, v_ip_count, v_judge_count + 1, v_duration;
  end if;
  return query select true, 'allowed'::text, v_session_id, v_ip_count + 1, v_public_count + 1, v_duration;
end;
$$;

revoke all on function create_public_viva_session(text, jsonb, text, text, uuid, text, integer, text, integer, text, integer) from public;
grant execute on function create_public_viva_session(text, jsonb, text, text, uuid, text, integer, text, integer, text, integer) to service_role;
