"""
Fetch daily price series from Stooq's free CSV endpoint. No API key,
no registration, no rate-limit headaches — this is what gold price now
comes from instead of FRED (see config.py for why).

Usage:
    python fetch_stooq.py                        # all symbols in config.py
    python fetch_stooq.py --symbol gold_price

Output:
    data/<internal_id>.json   — same shape as the other fetchers:
                                 {"id", "source", "updated", "count",
                                  "records": [{"date": "YYYY-MM-DD", "value": 1.23}, ...]}
"""
import argparse
import csv
import io
import sys
import urllib.request

from config import STOOQ_SYMBOLS
from site_data import write_series

# %s = Stooq ticker, e.g. "xauusd". i=d requests daily bars.
URL_TEMPLATE = "https://stooq.com/q/d/l/?s=%s&i=d"


def fetch_csv_text(symbol: str) -> str:
    url = URL_TEMPLATE % symbol
    req = urllib.request.Request(url, headers={"User-Agent": "econ-dashboard/0.1"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8")


def to_slim_records(csv_text: str) -> list:
    reader = csv.DictReader(io.StringIO(csv_text))
    records = []
    for row in reader:
        date = row.get("Date")
        close = row.get("Close")
        if not date or not close:
            continue
        try:
            value = float(close)
        except ValueError:
            continue
        records.append({"date": date, "value": value})
    records.sort(key=lambda r: r["date"])
    return records


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--symbol", nargs="*", help="Internal ids to fetch (default: all)")
    args = parser.parse_args()

    targets = args.symbol if args.symbol else list(STOOQ_SYMBOLS.keys())
    unknown = [t for t in targets if t not in STOOQ_SYMBOLS]
    if unknown:
        sys.exit(f"Unknown symbol id(s): {unknown}. Check config.STOOQ_SYMBOLS.")

    for internal_id in targets:
        ticker = STOOQ_SYMBOLS[internal_id]
        print(f"Fetching {internal_id} ({ticker})...")
        try:
            csv_text = fetch_csv_text(ticker)
            records = to_slim_records(csv_text)
        except Exception as e:
            print(f"  FAILED: {e}", file=sys.stderr)
            continue

        if not records:
            print(f"  WARNING: 0 records parsed — check the ticker symbol is valid on stooq.com", file=sys.stderr)
            continue

        out_path = write_series(internal_id, source="Stooq", records=records, extra_meta={"ticker": ticker})
        print(f"  {len(records)} records -> {out_path}")

    print("\nDone.")


if __name__ == "__main__":
    main()
