#!/usr/bin/env python3
"""Verify private snapshots and optionally extract into a NEW empty staging directory."""
import argparse
import hashlib
import json
import shutil
import sqlite3
import tarfile
import tempfile
from pathlib import Path, PurePosixPath

def digest(stream):
    h = hashlib.sha256()
    for block in iter(lambda: stream.read(262144), b""): h.update(block)
    return h.hexdigest()

def main():
    p = argparse.ArgumentParser(); p.add_argument("archive", type=Path); p.add_argument("--extract", type=Path); args = p.parse_args()
    checksum = Path(str(args.archive) + ".sha256")
    if checksum.exists():
        expected = checksum.read_text().split()[0]
        with args.archive.open("rb") as f:
            if digest(f) != expected: raise ValueError("Archive checksum mismatch")
    with tarfile.open(args.archive, "r:gz") as archive, tempfile.TemporaryDirectory(prefix="knowflow-verify-", dir=args.archive.parent) as scratch:
        members = archive.getmembers(); seen = set()
        if len(members) > 100000 or sum(m.size for m in members) > 40 * 1024 ** 3: raise ValueError("Snapshot exceeds safe limits")
        for member in members:
            name = PurePosixPath(member.name)
            if name.is_absolute() or ".." in name.parts or member.name in seen or not (member.isdir() or member.isfile()) or not name.parts or name.parts[0] not in {"kaoyan.db", "uploads", "mistake-skill", "manifest.json"}: raise ValueError("Unsafe or duplicate archive entry")
            seen.add(member.name)
        if archive.getmember("manifest.json").size > 16 * 1024 ** 2: raise ValueError("Manifest is too large")
        manifest = json.load(archive.extractfile("manifest.json"))
        files = manifest.get("files")
        if manifest.get("version") != 1 or not isinstance(files, dict) or set(files) != {m.name for m in members if m.isfile() and m.name != "manifest.json"}: raise ValueError("Snapshot manifest mismatch")
        for name, expected in files.items():
            with archive.extractfile(name) as f:
                if digest(f) != expected: raise ValueError("Component checksum mismatch")
        target = Path(scratch) / "kaoyan.db"
        with archive.extractfile("kaoyan.db") as f, target.open("xb") as o: shutil.copyfileobj(f, o, 262144)
        with sqlite3.connect(f"file:{target}?mode=ro", uri=True) as db:
            if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok" or db.execute("PRAGMA foreign_key_check").fetchall(): raise ValueError("SQLite snapshot integrity failed")
        if args.extract:
            if args.extract.is_symlink() or args.extract.exists() and any(args.extract.iterdir()): raise ValueError("Extraction requires an empty staging directory")
            args.extract.mkdir(mode=0o700, parents=True, exist_ok=True)
            for member in members:
                target = args.extract / member.name
                if member.isdir(): target.mkdir(mode=0o700, parents=True, exist_ok=True)
                else:
                    target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
                    with archive.extractfile(member) as f, target.open("xb") as o: shutil.copyfileobj(f, o, 262144)
                    target.chmod(0o600)
    print("PASS archive paths, component checksums and SQLite integrity")
if __name__ == "__main__": main()
