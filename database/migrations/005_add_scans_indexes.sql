begin;

-- Índices para mejorar performance de consultas de scans/search_runs
create index if not exists idx_search_runs_started_at
  on search_runs(started_at desc);

create index if not exists idx_search_runs_status_started_at
  on search_runs(status, started_at desc);

create index if not exists idx_search_runs_source_started_at
  on search_runs(source, started_at desc);

commit;
