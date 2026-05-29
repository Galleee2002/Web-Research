begin;

alter table dashboard_todos
  alter column business_id drop not null;

alter table dashboard_todos
  add column if not exists assigned_user_id uuid references users(id) on delete set null;

create index if not exists idx_dashboard_todos_assigned_user_id
  on dashboard_todos(assigned_user_id);

commit;
