#!/usr/bin/env python3
"""Import only AI settings into an existing private deployment environment."""
import argparse
import json
import os
from pathlib import Path
import re
import tempfile
from urllib.parse import urlsplit
from uuid import uuid4


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('target', type=Path)
    args = parser.parse_args()
    allowed = {'DEEPSEEK_API_KEY', 'MISTAKE_AI_API_KEY', 'MISTAKE_AI_BASE_URL', 'MISTAKE_AI_MODEL'}
    values = json.loads(args.source.read_text())
    if not isinstance(values, dict) or not values or set(values) - allowed:
        raise ValueError('Unexpected AI configuration fields')
    for value in values.values():
        if not isinstance(value, str) or not value or len(value) > 4096 or any(c in value for c in "\r\n'\\\x00"):
            raise ValueError('Invalid AI configuration value')
    if not values.get('MISTAKE_AI_API_KEY') or not values.get('MISTAKE_AI_MODEL'):
        raise ValueError('Missing image AI key or model')
    url = urlsplit(values.get('MISTAKE_AI_BASE_URL', 'https://api.openai.com/v1'))
    if url.scheme != 'https' or not url.hostname or url.username or url.password:
        raise ValueError('Image AI requires an HTTPS endpoint without embedded credentials')
    if args.target.is_symlink() or not args.target.is_file():
        raise ValueError('Expected an existing regular deployment environment file')
    existing = args.target.read_text()
    lines = []
    for line in existing.splitlines():
        match = re.match(r'^\s*(?:export\s+)?([A-Z_]+)\s*=', line)
        if not match or match[1] not in values:
            lines.append(line)
    lines += [key + "='" + value + "'" for key, value in values.items()]
    backups = args.target.parent.parent / 'data' / 'backups'
    backups.mkdir(parents=True, exist_ok=True, mode=0o700)
    old_mask = os.umask(0o077)
    temp = None
    try:
        backup = backups / ('app-env-before-ai-' + uuid4().hex + '.private')
        with backup.open('x') as stream: stream.write(existing)
        fd, temp = tempfile.mkstemp(prefix='.ai-import-', dir=args.target.parent)
        with os.fdopen(fd, 'w') as stream: stream.write('\n'.join(lines) + '\n')
        os.replace(temp, args.target)
        temp = None
    finally:
        if temp is not None: Path(temp).unlink(missing_ok=True)
        os.umask(old_mask)
    print('PASS AI settings imported; login settings retained; private configuration backup saved')

if __name__ == '__main__':
    main()
