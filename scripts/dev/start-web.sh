#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/../.."
npm --workspace apps/web run dev
