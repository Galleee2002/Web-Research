alter table businesses drop constraint if exists businesses_source_allowed;

alter table businesses
  add constraint businesses_source_allowed
  check (source in ('google_places', 'manual'));

alter table businesses
  add column if not exists email text;

alter table businesses
  add column if not exists social_links text[] not null default '{}'::text[];

create index if not exists idx_businesses_email_lower
  on businesses (lower(email))
  where email is not null;
