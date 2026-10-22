#!/usr/bin/env python3
"""Export a consistent SQLite snapshot plus uploaded files for a new server."""

import argparse
import os
import hashlib
import json
from datetime import datetime, timezone
import subprocess
import sys
import sqlite3
import tarfile
import tempfile
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="Destination .tar.gz file")
    parser.add_argument("--database", type=Path, default=Path("app/prisma/prisma/dev.db"))
    parser.add_argument("--uploads", type=Path, default=Path("app/public/uploads"))
    parser.add_argument("--skill-data", type=Path, default=Path("app/data/mistake-skill"))
    args = parser.parse_args()
    if not args.database.is_file():
        parser.error(f"Database does not exist: {args.database}")
    if args.output.exists():
        parser.error(f"Output already exists: {args.output}")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="kaoyan-export-", dir=args.output.parent) as temp:
        root = Path(temp)
        with sqlite3.connect(args.database) as source, sqlite3.connect(root / "kaoyan.db") as target:
            source.backup(target)
            if target.execute("PRAGMA integrity_check").fetchone()[0] != "ok" or target.execute("PRAGMA foreign_key_check").fetchall():
                raise RuntimeError("Snapshot integrity check failed")
            needs_uploads = source.execute("SELECT COUNT(*) FROM MistakeItem WHERE imageUrl IS NOT NULL").fetchone()[0]
            columns = {row[1] for row in target.execute("PRAGMA table_info(MistakeItem)")}
            needs_skill = target.execute("SELECT COUNT(*) FROM MistakeItem WHERE skillRecordId IS NOT NULL").fetchone()[0] if "skillRecordId" in columns else 0
        if needs_uploads and not args.uploads.is_dir():
            parser.error("Referenced upload directory is missing; refusing an incomplete backup")
        if needs_skill and not args.skill_data.is_dir():
            parser.error("Referenced Skill directory is missing; refusing an incomplete backup")
        sources = {"kaoyan.db": root / "kaoyan.db"}
        for source, name in ((args.uploads, "uploads"), (args.skill_data, "mistake-skill")):
            if source.is_dir():
                if source.is_symlink() or any(p.is_symlink() for p in source.rglob("*")):
                    parser.error("Symlinks are not permitted in backup source directories")
                sources[name] = source
            else:
                (root / name).mkdir()
                sources[name] = root / name
        manifest = {"version": 1, "createdAt": datetime.now(timezone.utc).isoformat(), "files": {}}
        for name, source_path in sources.items():
            entries = [source_path] if source_path.is_file() else source_path.rglob("*")
            for file in entries:
                if not file.is_file(): continue
                hasher = hashlib.sha256()
                with file.open("rb") as stream:
                    for block in iter(lambda: stream.read(262144), b""): hasher.update(block)
                relative = name if source_path.is_file() else name + "/" + file.relative_to(source_path).as_posix()
                manifest["files"][relative] = hasher.hexdigest()
        (root / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf8")
        old_umask = os.umask(0o077)
        try:
            with tarfile.open(args.output, "x:gz") as archive:
                for name in ("kaoyan.db", "uploads", "mistake-skill", "manifest.json"):
                    archive.add(root / name if name == "manifest.json" else sources[name], arcname=name)
        finally:
            os.umask(old_umask)
    hasher = hashlib.sha256()
    with args.output.open("rb") as stream:
        for block in iter(lambda: stream.read(262144), b""): hasher.update(block)
    checksum = Path(str(args.output) + ".sha256")
    with checksum.open("x", encoding="ascii") as stream:
        stream.write(f"{hasher.hexdigest()}  {args.output.name}\n")
    checksum.chmod(0o600)
    subprocess.run([sys.executable, str(Path(__file__).with_name("verify-backup.py")), str(args.output)], check=True)
    print(f"Saved private export: {args.output}")


if __name__ == "__main__":
    main()
