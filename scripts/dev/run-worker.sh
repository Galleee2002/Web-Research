#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/../.."

if command -v python3 >/dev/null 2>&1; then
  python3 -m workers
elif command -v py >/dev/null 2>&1; then
  py -m workers
else
  echo "error: Python runtime not found (python3/py)." >&2
  exit 1
fi
