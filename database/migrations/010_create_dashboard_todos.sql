begin;

create table if not exists dashboard_todos (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint dashboard_todos_title_not_empty check (length(btrim(title)) > 0)
);

create index if not exists idx_dashboard_todos_business_id
  on dashboard_todos(business_id);

create index if not exists idx_dashboard_todos_created_at
  on dashboard_todos(created_at);

create index if not exists idx_dashboard_todos_completed
  on dashboard_todos(completed);

commit;
