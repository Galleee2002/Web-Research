begin;

alter table opportunities
  add column if not exists is_selected boolean not null default false;

create index if not exists idx_opportunities_is_selected
  on opportunities(is_selected);

commit;
