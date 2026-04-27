#!/usr/bin/env sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

load_env_file() {
  env_file="$1"
  if [ -f "$env_file" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$env_file"
    set +a
  fi
}

# Load base env first, then local overrides.
load_env_file "$ROOT_DIR/.env"
load_env_file "$ROOT_DIR/.env.local"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "warning: DATABASE_URL is not set; database-backed API routes may fail." >&2
fi

exec pnpm --filter @business-lead-finder/web dev
