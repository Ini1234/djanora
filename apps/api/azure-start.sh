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
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi
# Prisma 7's .bin/prisma is a stub that require('./cli.js'). Azure/Oryx
# (and GitHub artifacts) flatten that symlink into .bin/, so invoke the
# real file so ./cli.js resolves next to it.
PRISMA_CLI="./node_modules/prisma/build/index.js"
if [ ! -f "$PRISMA_CLI" ]; then
  echo "prisma CLI not found at $PRISMA_CLI" >&2
  ls -la node_modules/prisma 2>/dev/null || true
  ls -la node_modules/prisma/build 2>/dev/null || true
  ls -la node_modules/.bin/prisma 2>/dev/null || true
  exit 1
fi
echo "Applying Prisma migrations..."
node "$PRISMA_CLI" migrate deploy
echo "Migrations applied."
exec node dist/main.js
