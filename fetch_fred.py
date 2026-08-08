"""
Fetch series from the FRED API and write site-ready JSON into data/.

Setup:
    Get a free key: https://fred.stlouisfed.org/docs/api/api_key.html
    export FRED_API_KEY=your_key_here

Usage:
    python fetch_fred.py                              # every series in config.py
    python fetch_fred.py --series cpi_headline fed_funds

Output:
    data/<internal_id>.json   — {"id", "source", "updated", "count",
                                  "records": [{"date": "YYYY-MM-DD", "value": 1.23}, ...]}
    data/manifest.json        — updated with an entry for each series fetched
"""
import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request

from config import FRED_SERIES
from site_data import write_series

API_BASE = "https://api.stlouisfed.org/fred/series/observations"


def fetch_raw(fred_id: str, api_key: str) -> dict:
    params = {"series_id": fred_id, "api_key": api_key, "file_type": "json"}
    url = f"{API_BASE}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": "econ-dashboard/0.1"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def to_slim_records(raw: dict) -> list:
    records = []
    for obs in raw.get("observations", []):
        if obs["value"] == ".":  # FRED's missing-value marker
            continue
        records.append({"date": obs["date"], "value": float(obs["value"])})
    records.sort(key=lambda r: r["date"])
    return records


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--series", nargs="*", help="Internal ids to fetch (default: all)")
    args = parser.parse_args()

    api_key = os.environ.get("FRED_API_KEY")
    if not api_key:
        sys.exit("Set FRED_API_KEY in your environment first (see file docstring).")

    targets = args.series if args.series else list(FRED_SERIES.keys())
    unknown = [t for t in targets if t not in FRED_SERIES]
    if unknown:
        sys.exit(f"Unknown series id(s): {unknown}. Check config.FRED_SERIES.")

    for internal_id in targets:
        fred_id = FRED_SERIES[internal_id]
        print(f"Fetching {internal_id} ({fred_id})...")
        try:
            raw = fetch_raw(fred_id, api_key)
            records = to_slim_records(raw)
        except Exception as e:
            print(f"  FAILED: {e}", file=sys.stderr)
            continue

        out_path = write_series(
            internal_id, source="FRED", records=records, extra_meta={"fred_id": fred_id}
        )
        print(f"  {len(records)} records -> {out_path}")
        time.sleep(0.5)  # polite pacing, not a hard rate-limit requirement

    print("\nDone.")


if __name__ == "__main__":
    main()
