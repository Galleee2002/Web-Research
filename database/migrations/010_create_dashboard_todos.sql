begin;

create table if not exists dashboard_todos (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  status text not null default 'pending',
  start_date date,
  priority text not null default 'medium',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint dashboard_todos_name_not_empty check (length(btrim(name)) > 0),
  constraint dashboard_todos_status_check check (status in ('pending', 'completed')),
  constraint dashboard_todos_priority_check check (priority in ('low', 'medium', 'high'))
);

-- The migration was previously created with `title` and `completed` columns. The
-- block below upgrades any pre-existing installation in place (idempotent) so
-- environments that already applied an earlier revision converge to the new shape.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'dashboard_todos' and column_name = 'title'
  ) and not exists (
    select 1 from information_schema.columns
    where table_name = 'dashboard_todos' and column_name = 'name'
  ) then
    alter table dashboard_todos rename column title to name;
  end if;

  if exists (
    select 1 from pg_constraint where conname = 'dashboard_todos_title_not_empty'
  ) then
    alter table dashboard_todos
      rename constraint dashboard_todos_title_not_empty to dashboard_todos_name_not_empty;
  end if;
end $$;

alter table dashboard_todos
  add column if not exists status text not null default 'pending',
  add column if not exists start_date date,
  add column if not exists priority text not null default 'medium';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'dashboard_todos_status_check'
  ) then
    alter table dashboard_todos
      add constraint dashboard_todos_status_check
      check (status in ('pending', 'completed'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'dashboard_todos_priority_check'
  ) then
    alter table dashboard_todos
      add constraint dashboard_todos_priority_check
      check (priority in ('low', 'medium', 'high'));
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'dashboard_todos' and column_name = 'completed'
  ) then
    update dashboard_todos
    set status = case when completed then 'completed' else 'pending' end
    where (completed = true and status <> 'completed')
       or (completed = false and status <> 'pending');
  end if;
end $$;

drop index if exists idx_dashboard_todos_completed;
alter table dashboard_todos drop column if exists completed;

create index if not exists idx_dashboard_todos_business_id
  on dashboard_todos(business_id);

create index if not exists idx_dashboard_todos_created_at
  on dashboard_todos(created_at);

create index if not exists idx_dashboard_todos_status
  on dashboard_todos(status);

create index if not exists idx_dashboard_todos_priority
  on dashboard_todos(priority);

create index if not exists idx_dashboard_todos_start_date
  on dashboard_todos(start_date);

commit;
