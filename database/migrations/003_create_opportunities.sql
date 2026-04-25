begin;

create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references businesses(id) on delete cascade,
  rating smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint opportunities_rating_allowed check (
    rating is null or rating between 1 and 5
  )
);

create index if not exists idx_opportunities_business_id
  on opportunities(business_id);

create index if not exists idx_opportunities_rating
  on opportunities(rating);

insert into opportunities (business_id, rating)
select businesses.id, null
from businesses
where businesses.has_website = false
on conflict (business_id) do nothing;

commit;
