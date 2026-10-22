#!/bin/sh
# Run manually on the server. Pauses only previously running Web/Worker.
set -eu
project=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project"
if [ "${KNOWFLOW_LOCK_HELD:-0}" != 1 ]; then
  exec 9> .knowflow-maintenance.lock
  flock -n 9 || { echo "Another maintenance operation is active"; exit 1; }
fi
[ -f deploy/app.env ] && [ -f data/kaoyan.db ] || { echo 'Server configuration or database missing'; exit 1; }
running=$(docker compose ps --status running --services)
resume_web=false; resume_worker=false
case "\n$running\n" in *web*) resume_web=true;; esac
case "\n$running\n" in *worker*) resume_worker=true;; esac
resume() {
  if [ "$resume_web" = true ]; then docker compose start --wait --wait-timeout 120 web; fi
  if [ "$resume_worker" = true ]; then docker compose start worker; fi
}
stopped=false
cleanup() { if [ "$stopped" = true ] && [ "${KNOWFLOW_KEEP_STOPPED:-0}" != 1 ]; then resume; fi; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
estimate=$(du -sk data/uploads data/mistake-skill data/kaoyan.db | awk '{s+=$1} END {print s}')
available=$(df -Pk data | awk 'NR==2 {print $4}')
[ "$available" -gt "$((estimate * 2 + 1048576))" ] || { echo 'Not enough free space for a safe backup; existing backups were retained'; exit 1; }
stopped=true
docker compose stop web worker
stamp="$(date -u +%Y%m%dT%H%M%SZ)-$$"
archive="/data/backups/snapshot-$stamp.tar.gz"
docker compose run --rm --no-deps backup python3 /app/tools/export-cloud-data.py "$archive" --database /data/kaoyan.db --uploads /data/uploads --skill-data /data/mistake-skill
docker compose run --rm --no-deps backup python3 /app/tools/verify-backup.py "$archive"
echo "Verified server backup: data/backups/snapshot-$stamp.tar.gz"
