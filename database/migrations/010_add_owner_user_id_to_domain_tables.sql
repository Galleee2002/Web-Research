begin;

do $$
declare
  admin_count integer;
begin
  select count(*)::int
  into admin_count
  from users
  where role = 'admin';

  if admin_count <> 2 then
    raise exception 'Expected exactly 2 admin users for legacy 50/50 assignment, found %', admin_count;
  end if;
end $$;

alter table search_runs
  add column if not exists owner_user_id uuid;

alter table businesses
  add column if not exists owner_user_id uuid;

alter table opportunities
  add column if not exists owner_user_id uuid;

with admin_users as (
  select id, row_number() over (order by created_at asc, id asc) as admin_rank
  from users
  where role = 'admin'
),
ranked_search_runs as (
  select id, row_number() over (order by created_at asc, id asc) as row_rank
  from search_runs
  where owner_user_id is null
)
update search_runs
set owner_user_id = admin_users.id,
    updated_at = now()
from ranked_search_runs
join admin_users on admin_users.admin_rank = ((ranked_search_runs.row_rank - 1) % 2) + 1
where search_runs.id = ranked_search_runs.id;

with admin_users as (
  select id, row_number() over (order by created_at asc, id asc) as admin_rank
  from users
  where role = 'admin'
)
update businesses
set owner_user_id = search_runs.owner_user_id,
    updated_at = now()
from search_runs
where businesses.search_run_id = search_runs.id
  and businesses.owner_user_id is null
  and search_runs.owner_user_id is not null;

with admin_users as (
  select id, row_number() over (order by created_at asc, id asc) as admin_rank
  from users
  where role = 'admin'
),
orphan_businesses as (
  select id, row_number() over (order by created_at asc, id asc) as row_rank
  from businesses
  where owner_user_id is null
)
update businesses
set owner_user_id = admin_users.id,
    updated_at = now()
from orphan_businesses
join admin_users on admin_users.admin_rank = ((orphan_businesses.row_rank - 1) % 2) + 1
where businesses.id = orphan_businesses.id;

update opportunities
set owner_user_id = businesses.owner_user_id,
    updated_at = now()
from businesses
where opportunities.business_id = businesses.id
  and opportunities.owner_user_id is null
  and businesses.owner_user_id is not null;

alter table search_runs
  alter column owner_user_id set not null;

alter table businesses
  alter column owner_user_id set not null;

alter table opportunities
  alter column owner_user_id set not null;

alter table search_runs
  add constraint fk_search_runs_owner_user
  foreign key (owner_user_id)
  references users(id)
  on delete restrict;

alter table businesses
  add constraint fk_businesses_owner_user
  foreign key (owner_user_id)
  references users(id)
  on delete restrict;

alter table opportunities
  add constraint fk_opportunities_owner_user
  foreign key (owner_user_id)
  references users(id)
  on delete restrict;

create index if not exists idx_search_runs_owner_user_created_at
  on search_runs(owner_user_id, created_at desc);

create index if not exists idx_businesses_owner_user_created_at
  on businesses(owner_user_id, created_at desc);

create index if not exists idx_opportunities_owner_user_updated_at
  on opportunities(owner_user_id, updated_at desc);

create index if not exists idx_businesses_owner_user_status
  on businesses(owner_user_id, status);

create index if not exists idx_opportunities_owner_user_is_selected
  on opportunities(owner_user_id, is_selected);

commit;
