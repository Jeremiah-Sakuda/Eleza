create table if not exists viva_sessions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references submissions(id) on delete set null,
  graph jsonb not null,
  status text not null default 'live' check (status in ('live', 'complete', 'abandoned')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists decision_log (
  id uuid primary key default gen_random_uuid(),
  viva_session_id uuid not null references viva_sessions(id) on delete cascade,
  sequence integer not null check (sequence >= 0),
  transcript_segment text not null,
  answered_at_ms integer not null check (answered_at_ms >= 0),
  answer_summary text not null,
  target_claim_id text not null,
  assessment text not null check (assessment in ('strong', 'partial', 'unsupported', 'contradictory', 'off_topic')),
  action text not null check (action in ('probe', 'branch', 'advance')),
  next_claim_id text not null,
  next_question text not null,
  rationale text not null,
  created_at timestamptz not null default now(),
  unique (viva_session_id, sequence)
);

create index if not exists decision_log_session_sequence_idx on decision_log (viva_session_id, sequence);

create or replace function prevent_decision_log_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'decision_log is append-only';
end;
$$;

drop trigger if exists decision_log_no_update on decision_log;
create trigger decision_log_no_update before update on decision_log
for each row execute function prevent_decision_log_mutation();

drop trigger if exists decision_log_no_delete on decision_log;
create trigger decision_log_no_delete before delete on decision_log
for each row execute function prevent_decision_log_mutation();
