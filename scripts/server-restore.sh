#!/bin/sh
# Explicit offline recovery; retain the full previous data directory, never overwrite it.
set -eu
[ "$#" -eq 2 ] && [ "$2" = '--confirm-replace' ] || { echo 'Usage: server-restore.sh /absolute/backup.tar.gz --confirm-replace'; exit 1; }
[ "$(id -u)" -eq 0 ] || { echo "Run offline server recovery with sudo"; exit 1; }
project=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
archive=$(python3 -c 'import pathlib,sys; print(pathlib.Path(sys.argv[1]).resolve())' "$1")
[ -f "$archive" ] || exit 1
python3 "$project/scripts/verify-backup.py" "$archive"
cd "$project"
exec 9> .knowflow-maintenance.lock
flock -n 9 || { echo "Another maintenance operation is active"; exit 1; }
[ -d data ] && [ -f deploy/app.env ] || exit 1
available=$(df -Pk . | awk 'NR==2 {print $4}')
required=$(du -sk data/kaoyan.db data/uploads data/mistake-skill | awk '{s+=$1} END {print s}')
expanded=$(python3 -c 'import tarfile,sys; print((sum(m.size for m in tarfile.open(sys.argv[1], "r:gz").getmembers())+1023)//1024)' "$archive")
[ "$available" -gt "$((required * 2 + expanded + 1048576))" ] || { echo 'Not enough disk space; no data replaced'; exit 1; }
running=$(docker compose ps --status running --services)
old="$project/data-before-restore-$(date -u +%Y%m%dT%H%M%SZ)"
[ ! -e "$old" ] || exit 1
stage=$(mktemp -d "$project/.restore-staging.XXXXXX")
resume() {
  if [ ! -d "$project/data" ] && [ -d "$old" ]; then mv "$old" "$project/data"; fi
  case "$running" in *web*) docker compose start --wait --wait-timeout 120 web;; esac
  case "$running" in *worker*) docker compose start worker;; esac
}
trap resume EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
KNOWFLOW_LOCK_HELD=1 KNOWFLOW_KEEP_STOPPED=1 sh scripts/server-backup.sh
python3 scripts/verify-backup.py "$archive" --extract "$stage"
# UID 1000 is the non-root node user in the image; run this recovery via sudo.
chown -R 1000:1000 "$stage"
chmod 700 "$stage"
docker compose run --rm --no-deps -v "$stage:/restore" -e DATABASE_URL=file:/restore/kaoyan.db backup node node_modules/prisma/build/index.js migrate deploy
python3 - "$project/data/kaoyan.db" "$stage/kaoyan.db" <<'PYQUOTA'
import sqlite3, sys
with sqlite3.connect(sys.argv[1]) as old, sqlite3.connect(sys.argv[2]) as restored:
    tables = {r[0] for r in old.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if "AiUsageDay" in tables:
        for day, used in old.execute("SELECT day, used FROM AiUsageDay"):
            restored.execute("INSERT INTO AiUsageDay(day,used) VALUES (?,?) ON CONFLICT(day) DO UPDATE SET used=MAX(used,excluded.used)", (day,used))
PYQUOTA
mv data "$old"
mv "$stage" data
echo "Recovered data; previous complete directory retained at $old. Verify records and images before any cleanup."
