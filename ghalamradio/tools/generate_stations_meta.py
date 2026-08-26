#!/usr/bin/env python3
"""
Generates data/stations_meta.json next to data/stations.db.gz.

Run this as the last step of whatever already builds stations.db.gz
(alongside or right after conv.py), before committing/pushing to the
ghalam.net GitHub Pages repo.

version handling:
- If stations_meta.json already exists, this bumps `version` by 1.
- Otherwise it starts at 1.
This is a plain incrementing counter, not tied to APP_VERSION in the
web app's config.js — the iOS updater only cares whether the number
went up.

Usage:
    python3 generate_stations_meta.py \
        --db data/stations.db.gz \
        --base-url https://ghalam.net/ghalamradio/data/stations.db.gz \
        --out data/stations_meta.json
"""

import argparse
import hashlib
import json
import os
import sys


def sha256_of(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def next_version(meta_path: str) -> int:
    if not os.path.exists(meta_path):
        return 1
    try:
        with open(meta_path, "r") as f:
            current = json.load(f)
        return int(current.get("version", 0)) + 1
    except (json.JSONDecodeError, ValueError):
        return 1


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", required=True, help="path to stations.db.gz")
    parser.add_argument("--base-url", required=True, help="public URL the iOS app will download from")
    parser.add_argument("--out", required=True, help="path to write stations_meta.json")
    args = parser.parse_args()

    if not os.path.exists(args.db):
        print(f"error: {args.db} not found", file=sys.stderr)
        sys.exit(1)

    meta = {
        "version": next_version(args.out),
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
