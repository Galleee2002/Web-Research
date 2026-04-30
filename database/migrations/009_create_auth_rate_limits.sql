begin;

create table if not exists auth_rate_limits (
  scope text not null,
  key_hash text not null,
  window_start timestamptz not null,
  count integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (scope, key_hash, window_start)
);

create index if not exists idx_auth_rate_limits_updated_at
  on auth_rate_limits(updated_at);

commit;
