#!/usr/bin/env python3
"""Isolated snapshot roundtrip and corruption/path-traversal rejection."""
import io, sqlite3, subprocess, sys, tarfile, tempfile
from pathlib import Path
scripts = Path(__file__).resolve().parent
with tempfile.TemporaryDirectory(prefix="knowflow-backup-test-") as temp:
    root = Path(temp); db = root / "source.db"; uploads = root / "uploads"; uploads.mkdir()
    (uploads / "page.png").write_bytes(b"original photo fixture")
    with sqlite3.connect(db) as c:
        c.execute("CREATE TABLE MistakeItem(id TEXT PRIMARY KEY, imageUrl TEXT, skillRecordId TEXT)")
        c.execute("INSERT INTO MistakeItem VALUES ('fixture','/uploads/page.png',NULL)")
    archive = root / "snapshot.tar.gz"
    subprocess.run([sys.executable,str(scripts/"export-cloud-data.py"),str(archive),"--database",str(db),"--uploads",str(uploads),"--skill-data",str(root/"skill")],check=True,stdout=subprocess.PIPE)
    restored = root / "restored"
    subprocess.run([sys.executable,str(scripts/"verify-backup.py"),str(archive),"--extract",str(restored)],check=True,stdout=subprocess.PIPE)
    assert (restored/"uploads/page.png").read_bytes() == (uploads/"page.png").read_bytes()
    with sqlite3.connect(restored/"kaoyan.db") as c: assert c.execute("SELECT count(*) FROM MistakeItem").fetchone()[0] == 1
    for kind in ["tampered", "traversal"]:
        bad = root / (kind+".tar.gz")
        with tarfile.open(archive,"r:gz") as src, tarfile.open(bad,"w:gz") as target:
            for member in src.getmembers():
                payload = src.extractfile(member).read() if member.isfile() else None
                if kind == "tampered" and member.name == "uploads/page.png": payload=b"modified"; member.size=len(payload)
                target.addfile(member,io.BytesIO(payload) if payload is not None else None)
            if kind == "traversal":
                member=tarfile.TarInfo("../escape"); member.size=1; target.addfile(member,io.BytesIO(b"x"))
        assert subprocess.run([sys.executable,str(scripts/"verify-backup.py"),str(bad)],stdout=subprocess.PIPE,stderr=subprocess.PIPE).returncode != 0
print("PASS backup roundtrip, attachment retention, tampered component and traversal rejection")
