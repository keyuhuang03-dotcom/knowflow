#!/bin/sh
# Read-only checks on the server. No installs, no firewall changes, no migrations.
set -eu
project=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project"
command -v docker >/dev/null
command -v python3 >/dev/null
command -v flock >/dev/null
docker compose version
docker compose start --help | grep -q -- --wait-timeout || { echo 'Update Docker Compose to a version supporting start --wait-timeout'; exit 1; }
[ -f deploy/app.env ] && [ -f deploy/Caddyfile ] || { echo 'Create private deployment configuration first'; exit 1; }
python3 - <<'PY'
from pathlib import Path
import re, stat
values={}
p=Path('deploy/app.env')
if stat.S_IMODE(p.stat().st_mode) & 0o077: raise SystemExit('deploy/app.env must have private permissions (chmod 600)')
for line in p.read_text().splitlines():
    if line.strip() and not line.lstrip().startswith('#') and '=' in line:
        key,value=line.split('=',1); values[key.strip()]=value.strip().strip('"\'')
config=Path('deploy/Caddyfile').read_text()
if 'study.example.com' in config or 'REPLACE_WITH' in config: raise SystemExit('Caddy still contains deployment placeholders')
if values.get('AUTH_TRUST_PROXY_IP')=='true' and 'header_up X-KnowFlow-Client-IP' not in config: raise SystemExit('Update the Caddy trusted client-IP header before enabling proxy-IP login limits')
if values.get('APP_ORIGIN')!='https://www.koayan.cn': raise SystemExit('APP_ORIGIN must match the intended HTTPS site')
if not values.get('AUTH_USERNAME') or not re.fullmatch(r'scrypt:[a-f0-9]{32}:[a-f0-9]{128}',values.get('AUTH_PASSWORD_HASH','')) or len(values.get('AUTH_SECRET',''))<32: raise SystemExit('Single-user login configuration incomplete')
if not Path('data').is_dir(): raise SystemExit('Prepare data directories owned by UID 1000 before deployment')
if Path('data').stat().st_uid !=1000: raise SystemExit('The non-root image requires data owned by UID 1000')
print('PASS private deployment configuration and persistent-directory owner')
PY
docker compose config --quiet
docker compose run --rm --no-deps --entrypoint caddy caddy validate --config /etc/caddy/Caddyfile
df -h .
echo 'Local server checks passed. Still verify external DNS, TLS, ICP status and blocked port 3000 separately.'
