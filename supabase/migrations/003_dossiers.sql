alter table viva_sessions add column if not exists source_text text;
alter table viva_sessions add column if not exists title text;

create table if not exists transcript_turns (
  id uuid primary key default gen_random_uuid(),
  viva_session_id uuid not null references viva_sessions(id) on delete cascade,
  sequence integer not null check (sequence >= 0),
  speaker text not null check (speaker in ('examiner', 'student')),
  text text not null,
  elapsed_ms integer not null check (elapsed_ms >= 0),
  target_claim_id text,
  question_kind text check (question_kind is null or question_kind in ('opening', 'bridge', 'adaptive')),
  created_at timestamptz not null default now(),
  unique (viva_session_id, sequence)
);

create index if not exists transcript_turns_session_sequence_idx on transcript_turns (viva_session_id, sequence);

create table if not exists dossiers (
  id uuid primary key default gen_random_uuid(),
  viva_session_id uuid not null unique references viva_sessions(id) on delete cascade,
  prompt_version text not null default 'divergence-v1',
  analysis jsonb not null,
  analysis_attempts integer not null default 1 check (analysis_attempts > 0),
  created_at timestamptz not null default now()
);

create index if not exists dossiers_created_at_idx on dossiers (created_at desc);
