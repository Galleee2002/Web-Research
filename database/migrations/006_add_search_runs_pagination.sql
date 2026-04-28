begin;

alter table search_runs
  add column if not exists parent_search_run_id uuid references search_runs(id) on delete set null,
  add column if not exists page_number integer not null default 1,
  add column if not exists provider_page_token text,
  add column if not exists provider_next_page_token text;

alter table search_runs
  drop constraint if exists search_runs_page_number_positive;

alter table search_runs
  add constraint search_runs_page_number_positive check (page_number >= 1);

create index if not exists idx_search_runs_parent_search_run_id
  on search_runs(parent_search_run_id);

create unique index if not exists idx_search_runs_single_child_per_parent
  on search_runs(parent_search_run_id)
  where parent_search_run_id is not null;

commit;
