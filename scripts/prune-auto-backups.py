#!/usr/bin/env python3
"""Retain recent automatic snapshots; never prune manual/deployment backups."""
import re
import sys
import time
from pathlib import Path


def prune(directory: Path, now=None):
    now = time.time() if now is None else now
    snapshots = sorted(
        (p for p in directory.iterdir() if not p.is_symlink() and p.is_file()
         and re.fullmatch(r'auto-snapshot-\d{8}T\d{6}Z-\d+\.tar\.gz', p.name)),
        key=lambda p: p.name, reverse=True,
    )
    for snapshot in snapshots[14:]:
        if now - snapshot.stat().st_mtime >= 14 * 86400:
            snapshot.unlink()
            print(f'Removed expired automatic snapshot: {snapshot.name}')


if __name__ == '__main__':
    prune(Path(sys.argv[1]))
