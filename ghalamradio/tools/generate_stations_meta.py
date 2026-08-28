#!/usr/bin/env python3
"""
Generates data/stations_meta.json next to data/stations.db.gz.

Run this as the last step of whatever already builds stations.db.gz
(alongside or right after conv.py), before committing/pushing to the
ghalam.net GitHub Pages repo — or before bundling stations.db as db_sql.db
in the iOS app (in which case, also copy this file into the Xcode project
as db_sql_meta.json — see stations.swift's reconcileBundledVersionIfNewer).

version handling:
- Reads whatever version is in the local file at --out, if it exists.
- ALSO fetches the currently-live production stations_meta.json (unless
  --offline-meta is passed) and reads its version too.
- Uses the higher of the two, +1.
This matters because a bare --out file with no local history (e.g. a
fresh checkout, or a machine that's never run this before) would otherwise
silently start back at version 1 -- which looks harmless right up until
you push it and it's LOWER than whatever's already live, at which point
every device that already has the current version just ignores it
forever, with no error anywhere. The live fetch closes that gap: the
version can only go up relative to what's actually deployed, regardless
of what this particular machine's local file (or lack of one) says.
This is a plain incrementing counter, not tied to APP_VERSION in the
web app's config.js -- the iOS updater only cares whether the number
went up.

Usage:
    python3 generate_stations_meta.py \
        --db data/stations.db.gz \
        --base-url https://ghalam.net/ghalamradio/web-app/data/stations.db.gz \
        --out data/stations_meta.json
"""

import argparse
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request

DEFAULT_LIVE_META_URL = "https://ghalam.net/ghalamradio/web-app/data/stations_meta.json"
REQUEST_TIMEOUT = 10


def sha256_of(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def local_version(meta_path: str):
    if not os.path.exists(meta_path):
        return None
    try:
        with open(meta_path, "r") as f:
            current = json.load(f)
        return int(current.get("version", 0))
    except (json.JSONDecodeError, ValueError, TypeError):
        return None


def live_version(live_meta_url: str):
    if not live_meta_url:
        return None
    try:
        req = urllib.request.Request(live_meta_url, headers={"User-Agent": "GhalamRadio-conv/1.0"})
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as res:
            data = json.loads(res.read().decode("utf-8"))
        return int(data.get("version", 0))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError, TypeError) as err:
        print(f"warning: couldn't fetch live version from {live_meta_url} ({err}) -- "
              f"falling back to local file only", file=sys.stderr)
        return None


def next_version(meta_path: str, live_meta_url: str) -> int:
    candidates = [v for v in (local_version(meta_path), live_version(live_meta_url)) if v is not None]
    return (max(candidates) if candidates else 0) + 1


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", required=True, help="path to stations.db.gz")
    parser.add_argument("--base-url", required=True, help="public URL the iOS app will download from")
    parser.add_argument("--out", required=True, help="path to write stations_meta.json")
    parser.add_argument("--live-meta-url", default=DEFAULT_LIVE_META_URL,
                         help=f"live stations_meta.json to check the version floor against (default: {DEFAULT_LIVE_META_URL})")
    parser.add_argument("--offline-meta", action="store_true",
                         help="skip the live version check entirely (local file only) -- use if you know you're offline")
    args = parser.parse_args()

    if not os.path.exists(args.db):
        print(f"error: {args.db} not found", file=sys.stderr)
        sys.exit(1)

    meta = {
        "version": next_version(args.out, "" if args.offline_meta else args.live_meta_url),
        "url": args.base_url,
        "sha256": sha256_of(args.db),
    }

    out_dir = os.path.dirname(args.out)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    with open(args.out, "w") as f:
        json.dump(meta, f, indent=2)
        f.write("\n")

    print(f"wrote {args.out}: version {meta['version']}, sha256 {meta['sha256'][:12]}...")


if __name__ == "__main__":
    main()
