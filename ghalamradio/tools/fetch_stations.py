#!/usr/bin/env python3
"""
Full pipeline, in one command: fetch -> build DB -> gzip -> write meta.

Pulls the full station list from radio-browser.info's LIVE API (the same one
https://www.radio-browser.info/search uses under the hood) rather than the
daily snapshot at backups.radio-browser.info — the live API returns a much
richer field set per station (state, hls, votes, full-name country/language,
etc.), where the backup snapshot only has ISO codes and URLs.

Running this with no arguments leaves you with two files in the CURRENT
directory, ready to copy/push to the site repo:

    stations.db.gz       (gzipped SQLite DB, via conv.py's stations_to_db)
    stations_meta.json    (version/url/sha256, via generate_stations_meta.py)

Both are overwritten if already present. The intermediate uncompressed
stations.db this builds along the way is deleted once it's been gzipped —
pass --keep-intermediate-db to keep it around instead.

IMPORTANT about "overwrite": stations_meta.json's `version` field has to
keep INCREASING run over run, or the iOS app never sees a run as an update.
So this does NOT wipe stations_meta.json back to version 1 each time — it
reads whatever version is already there (if any) and writes one higher,
same as generate_stations_meta.py always did. "Overwrite" here means the
file's *content* is replaced with fresh, correct data — not that its
version history is reset. If you genuinely want to reset to version 1
(e.g. starting a new deployment target), delete stations_meta.json by hand
first.

Usage:
    python3 fetch_stations.py
    python3 fetch_stations.py --include-broken
    python3 fetch_stations.py --base-url https://ghalam.net/ghalamradio/web-app/data/stations.db.gz
    python3 fetch_stations.py --json                    # old raw-JSON-only mode, see below

Full option list: --help
"""
import argparse
import gzip
import json
import os
import shutil
import sys
import time
import urllib.request
import urllib.error

# radio-browser.info asks API clients to identify themselves with a
# descriptive User-Agent (app name + contact/URL) rather than a generic one —
# stated in their docs as good etiquette, and some mirrors are stricter about
# it than others. Update the URL below to something that identifies this tool
# if you want to be a good citizen of their (free, volunteer-run) service.
USER_AGENT = "GhalamRadio-conv/1.0 (+https://ghalam.net/ghalamradio)"

# Any working mirror works — https://api.radio-browser.info/ lists current
# ones. de1 matches the server your browser URL was already using.
API_BASE = "https://de1.api.radio-browser.info"

PAGE_SIZE = 5000  # stations per request; radio-browser's servers handle this fine
REQUEST_TIMEOUT = 30
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 5

DEFAULT_DB_GZ = "stations.db.gz"
DEFAULT_META = "stations_meta.json"
DEFAULT_BASE_URL = "https://ghalam.net/ghalamradio/web-app/data/stations.db.gz"


def fetch_page(offset, hidebroken):
    url = (
        f"{API_BASE}/json/stations/search"
        f"?limit={PAGE_SIZE}&offset={offset}&hidebroken={'true' if hidebroken else 'false'}"
        f"&order=clickcount&reverse=true"
    )
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    last_err = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as res:
                return json.loads(res.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as err:
            last_err = err
            print(f"  Attempt {attempt}/{MAX_RETRIES} failed for offset {offset}: {err}")
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY_SECONDS)
    raise RuntimeError(f"Giving up on offset {offset} after {MAX_RETRIES} attempts") from last_err


def fetch_all_stations(hidebroken=True):
    all_stations = []
    offset = 0
    while True:
        print(f"Fetching stations {offset}-{offset + PAGE_SIZE}...")
        page = fetch_page(offset, hidebroken)
        if not page:
            break
        all_stations.extend(page)
        if len(page) < PAGE_SIZE:
            break  # last page was partial — we've reached the end
        offset += PAGE_SIZE
    return all_stations


def gzip_file(src_path, dst_path):
    """Gzip src_path to dst_path, overwriting dst_path if it already exists."""
    if os.path.exists(dst_path):
        os.remove(dst_path)
    with open(src_path, "rb") as f_in, gzip.open(dst_path, "wb") as f_out:
        shutil.copyfileobj(f_in, f_out)


def write_meta(db_gz_path, base_url, meta_path, meta_gen):
    """
    Writes meta_path using generate_stations_meta.py's own sha256_of() /
    next_version() — same logic, same file, called directly instead of via
    a subprocess so there's exactly one implementation of the versioning
    rule to keep in sync.
    """
    meta = {
        "version": meta_gen.next_version(meta_path),
        "url": base_url,
        "sha256": meta_gen.sha256_of(db_gz_path),
    }
    out_dir = os.path.dirname(meta_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)
        f.write("\n")
    return meta


def main():
    parser = argparse.ArgumentParser(
        description="Fetch radio-browser stations and produce stations.db.gz + stations_meta.json",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--include-broken", action="store_true",
        help="keep stations radio-browser's health checks currently flag as dead (default: hide them)",
    )
    parser.add_argument(
        "--db-gz-out", default=DEFAULT_DB_GZ,
        help=f"path to write the gzipped station DB (default: {DEFAULT_DB_GZ})",
    )
    parser.add_argument(
        "--base-url", default=DEFAULT_BASE_URL,
        help=f"public URL the iOS app will download the DB from (default: {DEFAULT_BASE_URL})",
    )
    parser.add_argument(
        "--meta-out", default=DEFAULT_META,
        help=f"path to write stations_meta.json (default: {DEFAULT_META})",
    )
    parser.add_argument(
        "--skip-meta", action="store_true",
        help="only produce the gzipped DB; don't touch stations_meta.json",
    )
    parser.add_argument(
        "--keep-intermediate-db", action="store_true",
        help="keep the uncompressed .db file this builds along the way instead of deleting it",
    )
    parser.add_argument(
        "--json", action="store_true",
        help="old raw-JSON-only mode: write a gzipped JSON dump and stop — "
             "skips DB/meta generation entirely (for inspecting raw fetched data)",
    )
    parser.add_argument(
        "json_out", nargs="?", default="stations_live.json.gz",
        help="output path when --json is passed (default: stations_live.json.gz)",
    )
    args = parser.parse_args()

    hidebroken = not args.include_broken

    print(f"Fetching from {API_BASE} (hidebroken={hidebroken})...")
    stations = fetch_all_stations(hidebroken=hidebroken)
    print(f"\nFetched {len(stations)} stations total.")

    if args.json:
        print(f"Writing {args.json_out}...")
        with gzip.open(args.json_out, "wt", encoding="utf-8") as f:
            json.dump(stations, f)
        print(f"Done. Feed this into conv.py, e.g.:\n  python3 conv.py {args.json_out} stations.db")
        return

    try:
        import conv
    except ImportError:
        print("Error: couldn't import conv.py — this script expects it in the same directory.", file=sys.stderr)
        sys.exit(1)

    intermediate_db = "_stations_fetch_tmp.db"
    if os.path.exists(intermediate_db):
        os.remove(intermediate_db)

    print(f"Converting fetched stations into {intermediate_db}...")
    conv.stations_to_db(stations, intermediate_db)

    print(f"Compressing to {args.db_gz_out}...")
    gzip_file(intermediate_db, args.db_gz_out)

    if args.keep_intermediate_db:
        kept_name = "stations.db"
        if os.path.exists(kept_name):
            os.remove(kept_name)
        os.rename(intermediate_db, kept_name)
        print(f"Kept intermediate DB as {kept_name}")
    else:
        os.remove(intermediate_db)

    print(f"Wrote {args.db_gz_out} ({os.path.getsize(args.db_gz_out):,} bytes)")

    if args.skip_meta:
        print("Skipping stations_meta.json (--skip-meta passed).")
        return

    try:
        import generate_stations_meta as meta_gen
    except ImportError:
        print(
            "Error: couldn't import generate_stations_meta.py — this script "
            "expects it in the same directory. Your .db.gz was still produced; "
            "run generate_stations_meta.py separately if needed.",
            file=sys.stderr,
        )
        sys.exit(1)

    meta = write_meta(args.db_gz_out, args.base_url, args.meta_out, meta_gen)
    print(f"Wrote {args.meta_out}: version {meta['version']}, sha256 {meta['sha256'][:12]}...")

    print(f"\nDone. Ready to push:\n  {args.db_gz_out}\n  {args.meta_out}")


if __name__ == "__main__":
    main()
