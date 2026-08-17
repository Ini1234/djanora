#!/bin/sh
set -eu
export PORT="${PORT:-8080}"
export HOST="${HOST:-0.0.0.0}"
cd "$(dirname "$0")"
echo "cwd=$(pwd) HOST=$HOST PORT=$PORT"
if [ ! -f dist/main.js ]; then
  echo "dist/main.js not found" >&2
  ls -la
  ls -la dist 2>/dev/null || true
  ls -la dist/src 2>/dev/null || true
  exit 1
fi
exec node dist/main.js
