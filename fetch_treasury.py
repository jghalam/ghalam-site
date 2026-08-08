"""
Fetch datasets from the Treasury Fiscal Data API and write site-ready JSON
into data/. No API key required.

Usage:
    python fetch_treasury.py                          # all datasets in config.py
    python fetch_treasury.py --dataset debt_to_penny

Output:
    data/<internal_id>.json   — {"id", "source", "updated", "count",
                                  "records": [{...only the configured
                                  value_fields, plus "date"...}, ...]}
"""
import argparse
import json
import sys
import urllib.parse
import urllib.request

from config import TREASURY_ENDPOINTS
from site_data import write_series

API_BASE = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service"
PAGE_SIZE = 1000


def fetch_raw_rows(path: str, extra_params: dict) -> list:
    all_rows = []
    page_number = 1
    while True:
        params = {**extra_params, "page[size]": PAGE_SIZE, "page[number]": page_number}
        url = f"{API_BASE}{path}?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, headers={"User-Agent": "econ-dashboard/0.1"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = json.loads(resp.read().decode("utf-8"))

        rows = payload.get("data", [])
        all_rows.extend(rows)

        total_pages = payload.get("meta", {}).get("total-pages", 1)
        if page_number >= total_pages or not rows:
            break
        page_number += 1

    return all_rows


def to_slim_records(raw_rows: list, date_field: str, value_fields: dict) -> list:
    records = []
    for row in raw_rows:
        record = {"date": row.get(date_field)}
        for out_key, source_col in value_fields.items():
            val = row.get(source_col)
            # Try numeric conversion; leave as string if it's not (e.g. category labels)
            try:
                val = float(val)
            except (TypeError, ValueError):
                pass
            record[out_key] = val
        records.append(record)
    records.sort(key=lambda r: r["date"] or "")
    return records


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", nargs="*", help="Internal ids to fetch (default: all)")
    args = parser.parse_args()

    targets = args.dataset if args.dataset else list(TREASURY_ENDPOINTS.keys())
    unknown = [t for t in targets if t not in TREASURY_ENDPOINTS]
    if unknown:
        sys.exit(f"Unknown dataset id(s): {unknown}. Check config.TREASURY_ENDPOINTS.")

    for internal_id in targets:
        cfg = TREASURY_ENDPOINTS[internal_id]
        print(f"Fetching {internal_id} ({cfg['endpoint']})...")
        try:
            raw_rows = fetch_raw_rows(cfg["endpoint"], cfg["params"])
            records = to_slim_records(raw_rows, cfg["date_field"], cfg["value_fields"])
        except Exception as e:
            print(f"  FAILED: {e}", file=sys.stderr)
            continue

        out_path = write_series(internal_id, source="Treasury Fiscal Data", records=records)
        print(f"  {len(records)} records -> {out_path}")

    print("\nDone.")


if __name__ == "__main__":
    main()
