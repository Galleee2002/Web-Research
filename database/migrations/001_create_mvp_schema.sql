begin;

create extension if not exists pgcrypto;

create table if not exists search_runs (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  location text not null,
  source text not null default 'google_places',
  status text not null default 'pending',
  total_found integer not null default 0,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint search_runs_query_not_empty check (length(btrim(query)) > 0),
  constraint search_runs_location_not_empty check (length(btrim(location)) > 0),
  constraint search_runs_source_allowed check (source in ('google_places')),
  constraint search_runs_status_allowed check (
    status in ('pending', 'processing', 'completed', 'failed')
  ),
  constraint search_runs_total_found_non_negative check (total_found >= 0)
);

create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  search_run_id uuid references search_runs(id) on delete set null,
  external_id text,
  source text not null default 'google_places',
  name text not null,
  category text,
  address text,
  city text,
  region text,
  country text,
  lat numeric(10, 7),
  lng numeric(10, 7),
  phone text,
  website text,
  has_website boolean not null default false,
  maps_url text,
  status text not null default 'new',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint businesses_source_allowed check (source in ('google_places')),
  constraint businesses_name_not_empty check (length(btrim(name)) > 0),
  constraint businesses_status_allowed check (
    status in ('new', 'reviewed', 'contacted', 'discarded')
  ),
  constraint businesses_lat_range check (lat is null or (lat >= -90 and lat <= 90)),
  constraint businesses_lng_range check (lng is null or (lng >= -180 and lng <= 180)),
  constraint businesses_website_presence_consistent check (
    website is not null or has_website = false
  )
);

create index if not exists idx_search_runs_status
  on search_runs(status);

create index if not exists idx_search_runs_created_at
  on search_runs(created_at);

create index if not exists idx_search_runs_source
  on search_runs(source);

create unique index if not exists idx_businesses_external_id_source
  on businesses(source, external_id)
  where external_id is not null;

create index if not exists idx_businesses_has_website
  on businesses(has_website);

create index if not exists idx_businesses_status
  on businesses(status);

create index if not exists idx_businesses_city
  on businesses(city);

create index if not exists idx_businesses_category
  on businesses(category);

create index if not exists idx_businesses_created_at
  on businesses(created_at);

create index if not exists idx_businesses_name_address
  on businesses(lower(name), lower(coalesce(address, '')));

commit;
