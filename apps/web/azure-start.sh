#!/bin/sh
set -eu
export HOSTNAME=0.0.0.0
export PORT="${PORT:-8080}"
cd "$(dirname "$0")"
echo "cwd=$(pwd) PORT=$PORT"
if [ -f apps/web/server.js ]; then
  exec node apps/web/server.js
fi
if [ -f server.js ]; then
  exec node server.js
fi
echo "Next standalone server.js not found" >&2
ls -la
find . -name 'server.js' | head
exit 1
