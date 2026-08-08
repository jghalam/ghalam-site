"""
Fetch Commitments of Traders reports from the CFTC's public Socrata API and
write site-ready JSON into data/. No API key required.

Usage:
    python fetch_cftc.py --report legacy_futures_only --commodity gold
    python fetch_cftc.py --report legacy_futures_only   # no filter, all commodities

Output:
    data/<report>_<commodity_or_all>.json

Note: run once with no --commodity filter first and check the exact
commodity_name spelling in the output before relying on the filter —
Socrata's $where match is exact and case-sensitive-ish (we upper() both
sides, but the underlying string still needs to match).
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
import urllib.request

from config import CFTC_COMMODITY_FILTERS, CFTC_DATASETS, CFTC_VALUE_FIELDS
from site_data import write_series

API_BASE = "https://publicreporting.cftc.gov/resource"
LIMIT = 50000


def fetch_raw_rows(dataset_id: str, commodity_name: str | None) -> list:
    params = {"$limit": LIMIT, "$order": "report_date_as_yyyy_mm_dd DESC"}
    if commodity_name:
        params["$where"] = f"upper(commodity_name) = '{commodity_name.upper()}'"

    url = f"{API_BASE}/{dataset_id}.json?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(
        url, headers={"User-Agent": "econ-dashboard/0.1 (contact: you@example.com)"}
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def to_slim_records(raw_rows: list) -> list:
    records = []
    for row in raw_rows:
        record = {}
        for out_key, source_col in CFTC_VALUE_FIELDS.items():
            val = row.get(source_col)
            try:
                val = float(val)
            except (TypeError, ValueError):
                pass  # date field stays a string
            record[out_key] = val
        records.append(record)
    records.sort(key=lambda r: r.get("date") or "")
    return records


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", required=True, choices=list(CFTC_DATASETS.keys()))
    parser.add_argument(
        "--commodity", help="Internal key from config.CFTC_COMMODITY_FILTERS (omit for no filter)"
    )
    args = parser.parse_args()

    dataset_id = CFTC_DATASETS[args.report]
    commodity_name = None
    if args.commodity:
        if args.commodity not in CFTC_COMMODITY_FILTERS:
            sys.exit(f"Unknown commodity key '{args.commodity}'. Check config.CFTC_COMMODITY_FILTERS.")
        commodity_name = CFTC_COMMODITY_FILTERS[args.commodity]

    label = f"filtered to {commodity_name}" if commodity_name else "all commodities"
    print(f"Fetching {args.report} ({label})...")

    raw_rows = fetch_raw_rows(dataset_id, commodity_name)
    records = to_slim_records(raw_rows)

    internal_id = f"{args.report}_{args.commodity if args.commodity else 'all'}"
    out_path = write_series(internal_id, source="CFTC", records=records)
    print(f"{len(records)} records -> {out_path}")


if __name__ == "__main__":
    main()
