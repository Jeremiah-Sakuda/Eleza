create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  source_text text not null,
  created_at timestamptz not null default now()
);

create table if not exists claim_graphs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  graph jsonb not null,
  prompt_version text not null default 'claim-graph-v1',
  created_at timestamptz not null default now()
);

create index if not exists claim_graphs_submission_id_idx on claim_graphs (submission_id);
