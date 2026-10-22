#!/bin/sh
# Run on Mac after explicitly selecting a server archive. Does not connect automatically.
set -eu
[ "$#" -eq 3 ] || { echo 'Usage: download-server-backup.sh user@host /opt/kaoyan-workbench/data/backups/snapshot-NAME.tar.gz /local/private/folder'; exit 1; }
remote=$1; archive=$2; destination=$3
case "$remote" in -*|*[!a-zA-Z0-9_.@:-]*) echo 'Invalid SSH destination'; exit 1;; esac
case "$archive" in /opt/kaoyan-workbench/data/backups/snapshot-*.tar.gz) ;; *) echo 'Select a server snapshot archive'; exit 1;; esac
case "$archive" in *[!a-zA-Z0-9_./-]*) exit 1;; esac
mkdir -p "$destination"; chmod 700 "$destination"
name=$(basename "$archive")
[ ! -e "$destination/$name" ] && [ ! -e "$destination/$name.sha256" ] || { echo 'Local backup already exists; refusing overwrite'; exit 1; }
staging=$(mktemp -d "$destination/.download.XXXXXX")
scp "$remote:$archive" "$remote:$archive.sha256" "$staging/"
project=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
python3 "$project/scripts/verify-backup.py" "$staging/$name"
mv "$staging/$name" "$staging/$name.sha256" "$destination/"
rmdir "$staging"
echo "Verified private download: $destination/$name"
