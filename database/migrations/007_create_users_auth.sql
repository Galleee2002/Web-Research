begin;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  email text not null,
  first_name text not null,
  last_name text not null,
  phone text,
  password_hash text not null,
  role text not null default 'user',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint users_username_not_empty check (length(btrim(username)) > 0),
  constraint users_email_not_empty check (length(btrim(email)) > 0),
  constraint users_first_name_not_empty check (length(btrim(first_name)) > 0),
  constraint users_last_name_not_empty check (length(btrim(last_name)) > 0),
  constraint users_role_allowed check (role in ('admin', 'user'))
);

create unique index if not exists idx_users_username_lower
  on users(lower(username));

create unique index if not exists idx_users_email_lower
  on users(lower(email));

create index if not exists idx_users_role
  on users(role);

create index if not exists idx_users_created_at
  on users(created_at);

commit;
