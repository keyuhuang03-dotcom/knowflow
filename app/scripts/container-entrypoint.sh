#!/bin/sh
set -eu
case "${1:-web}" in
  web)
    node --import tsx scripts/validate-runtime.ts
    node scripts/prepare-database.mjs
    node node_modules/prisma/build/index.js migrate deploy
    node --import tsx scripts/bootstrap.ts
    exec node node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port 3000
    ;;
  worker) exec node --import tsx scripts/mistake-worker.ts ;;
  *) exec "$@" ;;
esac
