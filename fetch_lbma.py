"""
Fetch precious metal prices from LBMA's public JSON feed. No API key, no
registration — this is the feed that powers LBMA's own price chart on
their website, distinct from their formal historical data portal (which
now requires a paid ICE Benchmark Administration licence).

Usage:
    python fetch_lbma.py                    # all feeds in config.py
    python fetch_lbma.py --feed gold_price

Output:
    data/<internal_id>.json — same shape as the other fetchers:
                               {"id", "source", "updated", "count",
                                "records": [{"date": "YYYY-MM-DD", "value": 1.23}, ...]}

Note: the feed's raw shape is a JSON array of
    {"is_cms_locked": 0, "d": "YYYY-MM-DD", "v": [usd, gbp, eur]}
We keep only the USD value (index 0 of "v"). Some early dates have a null
for EUR (pre-euro) — that's fine since we don't use that field, but it's
worth knowing if you extend this to pull GBP/EUR too.
"""
import argparse
import json
import sys
import urllib.request

from config import LBMA_FEEDS
from site_data import write_series


def fetch_raw(url: str) -> list:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json, text/plain, */*",
            "Referer": "https://www.lbma.org.uk/prices-and-data/lbma-precious-metal-prices",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = resp.read().decode("utf-8")
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        # Surface what actually came back instead of a bare "Expecting value"
        # error, so a future failure is diagnosable from the Actions log
        # alone rather than needing another round of guessing.
        preview = body[:300].replace("\n", " | ")
        raise RuntimeError(f"Response wasn't valid JSON. Body started with: {preview}")


def to_slim_records(raw: list) -> list:
    records = []
    for entry in raw:
        date = entry.get("d")
        values = entry.get("v") or []
        if not date or not values:
            continue
        usd = values[0]
        if usd is None:
            continue
        records.append({"date": date, "value": float(usd)})
    records.sort(key=lambda r: r["date"])
    return records


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--feed", nargs="*", help="Internal ids to fetch (default: all)")
    args = parser.parse_args()

    targets = args.feed if args.feed else list(LBMA_FEEDS.keys())
    unknown = [t for t in targets if t not in LBMA_FEEDS]
    if unknown:
        sys.exit(f"Unknown feed id(s): {unknown}. Check config.LBMA_FEEDS.")

    for internal_id in targets:
        url = LBMA_FEEDS[internal_id]
        print(f"Fetching {internal_id} ({url})...")
        try:
            raw = fetch_raw(url)
            records = to_slim_records(raw)
        except Exception as e:
            print(f"  FAILED: {e}", file=sys.stderr)
            continue

        if not records:
            print("  WARNING: 0 records parsed — feed shape may have changed", file=sys.stderr)
            continue

        out_path = write_series(internal_id, source="LBMA", records=records, extra_meta={"feed_url": url})
        print(f"  {len(records)} records -> {out_path}")

    print("\nDone.")


if __name__ == "__main__":
    main()
