begin;

alter table dashboard_todos
  add column if not exists description text;

commit;
