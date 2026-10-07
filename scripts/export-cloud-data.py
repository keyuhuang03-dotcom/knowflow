#!/usr/bin/env python3
"""Export a consistent SQLite snapshot plus uploaded files for a new server."""

import argparse
import os
import shutil
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
    with tempfile.TemporaryDirectory(prefix="kaoyan-export-") as temp:
        root = Path(temp)
        with sqlite3.connect(args.database) as source, sqlite3.connect(root / "kaoyan.db") as target:
            source.backup(target)
        for source, name in ((args.uploads, "uploads"), (args.skill_data, "mistake-skill")):
            if source.is_dir():
                shutil.copytree(source, root / name, symlinks=False)
            else:
                (root / name).mkdir()
        old_umask = os.umask(0o077)
        try:
            with tarfile.open(args.output, "x:gz") as archive:
                for name in ("kaoyan.db", "uploads", "mistake-skill"):
                    archive.add(root / name, arcname=name)
        finally:
            os.umask(old_umask)
    print(f"Saved private export: {args.output}")


if __name__ == "__main__":
    main()
