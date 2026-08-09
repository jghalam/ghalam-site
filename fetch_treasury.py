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

MTS_TABLE_1_ENDPOINT = "/v1/accounting/mts/mts_table_1"

# Federal fiscal years run Oct 1 -> Sep 30, so Oct/Nov/Dec of fiscal year FY
# actually fall in calendar year FY-1, while Jan-Sep fall in calendar year FY.
MONTH_NAME_TO_NUM = {
    "January": 1, "February": 2, "March": 3, "April": 4, "May": 5, "June": 6,
    "July": 7, "August": 8, "September": 9, "October": 10, "November": 11, "December": 12,
}


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


def fiscal_month_to_calendar_date(fiscal_year: str, month_name: str):
    """Converts an MTS row's (record_fiscal_year, classification_desc) into
    the real calendar date it describes. Returns None for classification_desc
    values that aren't actual month names (the table also carries category
    rows like fiscal-year totals, which this correctly filters out)."""
    month_num = MONTH_NAME_TO_NUM.get(month_name)
    if month_num is None:
        return None
    fy = int(fiscal_year)
    calendar_year = fy - 1 if month_num >= 10 else fy
    return f"{calendar_year:04d}-{month_num:02d}-01"


def fetch_deficit() -> list:
    """MTS table 1 is a cumulative snapshot, not a plain time series — each
    monthly publication re-lists every month of the fiscal year so far, so
    the same real month appears across many different record_dates (and can
    be revised between them). This fetches everything, converts each row to
    its real calendar month, and keeps only the most recent (most final)
    figure per month."""
    raw_rows = fetch_raw_rows(MTS_TABLE_1_ENDPOINT, {"sort": "-record_date"})

    best_by_month = {}   # calendar_date -> (record_date seen, value)
    for row in raw_rows:
        calendar_date = fiscal_month_to_calendar_date(
            row.get("record_fiscal_year", ""), row.get("classification_desc", "")
        )
        if calendar_date is None:
            continue
        value = row.get("current_month_dfct_sur_amt")
        if value is None:
            continue
        try:
            value = float(value)
        except (TypeError, ValueError):
            continue

        snapshot_date = row.get("record_date", "")
        existing = best_by_month.get(calendar_date)
        if existing is None or snapshot_date > existing[0]:
            best_by_month[calendar_date] = (snapshot_date, value)

    records = [{"date": d, "value": v} for d, (_, v) in best_by_month.items()]
    records.sort(key=lambda r: r["date"])
    return records


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

    targets = args.dataset if args.dataset else list(TREASURY_ENDPOINTS.keys()) + ["deficit"]
    unknown = [t for t in targets if t not in TREASURY_ENDPOINTS and t != "deficit"]
    if unknown:
        sys.exit(f"Unknown dataset id(s): {unknown}. Check config.TREASURY_ENDPOINTS.")

    for internal_id in targets:
        if internal_id == "deficit":
            print(f"Fetching deficit ({MTS_TABLE_1_ENDPOINT})...")
            try:
                records = fetch_deficit()
            except Exception as e:
                print(f"  FAILED: {e}", file=sys.stderr)
                continue
            out_path = write_series(internal_id, source="Treasury Fiscal Data", records=records, extra_meta={
                "label": "Monthly federal deficit (positive) or surplus (negative), USD — Treasury's own sign convention, opposite of a personal bank balance",
                "method": "MTS table 1, deduplicated to the most recent reported figure per real calendar month",
            })
            print(f"  {len(records)} records -> {out_path}")
            continue

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
