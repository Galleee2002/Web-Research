begin;

alter table search_runs
  add column if not exists correlation_id text,
  add column if not exists error_code text,
  add column if not exists error_stage text,
  add column if not exists observability jsonb not null default '{}'::jsonb;

create index if not exists idx_search_runs_correlation_id
  on search_runs(correlation_id);

commit;
