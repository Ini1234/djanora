#!/bin/sh
set -eu
export PORT="${PORT:-8080}"
cd "$(dirname "$0")"
echo "cwd=$(pwd) PORT=$PORT"
if [ ! -f dist/main.js ]; then
  echo "dist/main.js not found" >&2
  ls -la
  ls -la dist 2>/dev/null || true
  exit 1
fi
exec node dist/main.js
