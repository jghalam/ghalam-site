"""
Computes derived economic metrics from the raw series in data/ and writes
them back into data/ in the same shape, so the frontend treats derived and
raw series identically. Run this AFTER the fetch_*.py scripts, since it
reads their output.

Usage:
    python3 calculate.py

Output (added to data/, alongside the raw series):
    data/cpi_yoy.json           — headline CPI, % change vs. 12 months prior
    data/cpi_core_yoy.json      — core CPI, % change vs. 12 months prior
    data/real_yield_10y.json    — 10Y Treasury yield minus headline CPI YoY
    data/debt_to_gdp.json       — total public debt as % of nominal GDP

Each function tolerates missing/misaligned dates (different series update
on different schedules) by matching to the nearest available point within
a bounded window, rather than requiring exact date matches.
"""
import json
import math
import os
import sys
from bisect import bisect_left
from datetime import date, datetime

from site_data import write_series

DATA_DIR = "data"

# Recession probability model (Estrella & Mishkin, 1998, "Predicting U.S.
# Recessions: Financial Variables as Leading Indicators", Review of
# Economics and Statistics 80(1)). Estimates the probability of an
# NBER-dated recession within the next 12 months from the 10Y-3M Treasury
# term spread alone.
#
# HONESTY NOTE ON THESE COEFFICIENTS: multiple independent tools that
# specifically claim to replicate the NY Fed's published monthly series
# consistently cite ALPHA=-0.5333, BETA=-0.6629, with technical details
# (1959-1995 sample, pseudo-R^2 ~0.30) matching the known original paper.
# That is meaningful corroboration, but the NY Fed's own page renders its
# chart via JavaScript, so the live figures could not be extracted
# directly to confirm this to the decimal, and FRED does not host this
# specific series as a fetchable data point (their "Recession
# Probabilities" category has the Sahm Rule and a different Chauvet-Piger
# model instead). Treat this as a well-sourced approximation of the
# published methodology, not a guaranteed exact replication — and see
# https://www.newyorkfed.org/research/capital_markets/ycfaq for the
# authoritative live number to compare against.
RECESSION_MODEL_ALPHA = -0.5333
RECESSION_MODEL_BETA = -0.6629


def norm_cdf(x: float) -> float:
    """Standard normal CDF, via the stdlib's erf — no scipy dependency,
    consistent with the rest of this project."""
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def load_records(internal_id: str) -> list:
    """Loads data/<internal_id>.json and returns its records list, or None
    if the file doesn't exist yet (e.g. that fetcher hasn't been run)."""
    path = os.path.join(DATA_DIR, f"{internal_id}.json")
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f)["records"]


def parse_date(s: str) -> date:
    return datetime.strptime(s[:10], "%Y-%m-%d").date()


def build_day_index(records: list, value_key: str):
    """Parses every record's date exactly once and returns two parallel,
    ascending-sorted lists (epoch-day ints, values) suitable for binary
    search. `records` is assumed already sorted ascending by date (true
    for anything write_series produced)."""
    days = []
    values = []
    for r in records:
        v = r.get(value_key)
        if v is None:
            continue
        days.append(parse_date(r["date"]).toordinal())
        values.append(v)
    return days, values


def nearest_value_indexed(days: list, values: list, target_day: int, max_days: int = 15):
    """Binary-searches a (days, values) index built by build_day_index for
    the value closest to target_day, within max_days. O(log n) instead of
    the O(n) full scan this replaced — matters because this gets called
    once per row of the *other* series (e.g. once per month of CPI data
    against a daily Treasury series with ~16,000 points)."""
    if not days:
        return None
    idx = bisect_left(days, target_day)
    best = None
    best_diff = None
    for candidate_idx in (idx - 1, idx, idx + 1):
        if 0 <= candidate_idx < len(days):
            diff = abs(days[candidate_idx] - target_day)
            if diff <= max_days and (best_diff is None or diff < best_diff):
                best, best_diff = values[candidate_idx], diff
    return best


def compute_yoy(source_id: str, out_id: str, label: str) -> int:
    """YoY % change for a monthly series, computed by shifting 12 rows
    back (these FRED series are one row per month, so index-12 is exactly
    12 months prior). Returns the number of output records written."""
    records = load_records(source_id)
    if records is None:
        print(f"  skip {out_id}: {source_id}.json not found (run its fetcher first)")
        return 0

    out = []
    for i in range(12, len(records)):
        prev_val = records[i - 12]["value"]
        cur_val = records[i]["value"]
        if prev_val == 0:
            continue
        pct = (cur_val / prev_val - 1) * 100
        out.append({"date": records[i]["date"], "value": round(pct, 3)})

    write_series(out_id, source="Derived", records=out, extra_meta={
        "label": label, "derived_from": source_id, "method": "12-month lag % change",
    })
    return len(out)


def compute_real_yield(cpi_yoy_id: str, treasury_id: str, out_id: str) -> int:
    """Real 10Y yield = nominal 10Y yield (daily) minus headline CPI YoY
    (monthly) on the CPI series' own date grid, matching each CPI date to
    the nearest available Treasury yield within 15 days."""
    cpi_yoy = load_records(cpi_yoy_id)
    treasury = load_records(treasury_id)
    if cpi_yoy is None or treasury is None:
        missing = cpi_yoy_id if cpi_yoy is None else treasury_id
        print(f"  skip {out_id}: {missing}.json not found")
        return 0

    treasury_days, treasury_vals = build_day_index(treasury, "value")

    out = []
    for row in cpi_yoy:
        target_day = parse_date(row["date"]).toordinal()
        yield_val = nearest_value_indexed(treasury_days, treasury_vals, target_day)
        if yield_val is None:
            continue
        out.append({"date": row["date"], "value": round(yield_val - row["value"], 3)})

    write_series(out_id, source="Derived", records=out, extra_meta={
        "label": "10Y Treasury yield minus headline CPI YoY",
        "derived_from": [cpi_yoy_id, treasury_id],
    })
    return len(out)


def compute_recession_probability(treasury_10y_id: str, treasury_3mo_id: str, out_id: str) -> int:
    """12-month-ahead recession probability from the 10Y-3M term spread,
    via the Estrella-Mishkin probit model — see the module-level notes on
    RECESSION_MODEL_ALPHA/BETA for sourcing and honest caveats. Computed
    on the 10Y series' own (daily) date grid, matching each date to the
    nearest available 3-month yield within 5 days."""
    treasury_10y = load_records(treasury_10y_id)
    treasury_3mo = load_records(treasury_3mo_id)
    if treasury_10y is None or treasury_3mo is None:
        missing = treasury_10y_id if treasury_10y is None else treasury_3mo_id
        print(f"  skip {out_id}: {missing}.json not found")
        return 0

    days_3mo, vals_3mo = build_day_index(treasury_3mo, "value")

    out = []
    for row in treasury_10y:
        target_day = parse_date(row["date"]).toordinal()
        yield_3mo = nearest_value_indexed(days_3mo, vals_3mo, target_day, max_days=5)
        if yield_3mo is None:
            continue
        spread = row["value"] - yield_3mo
        z = RECESSION_MODEL_ALPHA + RECESSION_MODEL_BETA * spread
        probability_pct = round(norm_cdf(z) * 100, 2)
        out.append({"date": row["date"], "value": probability_pct})

    write_series(out_id, source="Derived", records=out, extra_meta={
        "label": "12-month-ahead recession probability (Estrella-Mishkin yield curve model), %",
        "method": "Probit on 10Y-3M Treasury term spread — see calculate.py source comments for coefficient sourcing and caveats",
        "reference": "https://www.newyorkfed.org/research/capital_markets/ycfaq",
        "derived_from": [treasury_10y_id, treasury_3mo_id],
    })
    return len(out)


def compute_debt_to_gdp(debt_id: str, gdp_id: str, out_id: str) -> int:
    """Debt-to-GDP % on GDP's own quarterly date grid, matching each GDP
    date to the nearest debt figure within 20 days. GDP (FRED series
    "GDP") is in billions of nominal USD; debt_to_penny's total_debt is
    in raw dollars, so it's divided by (gdp * 1e9)."""
    debt = load_records(debt_id)
    gdp = load_records(gdp_id)
    if debt is None or gdp is None:
        missing = debt_id if debt is None else gdp_id
        print(f"  skip {out_id}: {missing}.json not found")
        return 0

    debt_days, debt_vals = build_day_index(debt, "total_debt")

    out = []
    for row in gdp:
        target_day = parse_date(row["date"]).toordinal()
        debt_val = nearest_value_indexed(debt_days, debt_vals, target_day, max_days=20)
        if debt_val is None or row["value"] == 0:
            continue
        ratio = debt_val / (row["value"] * 1e9) * 100
        out.append({"date": row["date"], "value": round(ratio, 2)})

    write_series(out_id, source="Derived", records=out, extra_meta={
        "label": "Total public debt as % of nominal GDP",
        "derived_from": [debt_id, gdp_id],
    })
    return len(out)


def compute_total_debt(source_id: str, out_id: str) -> int:
    """Pass-through extraction — debt_to_penny's records already have a
    total_debt field, just bundled with debt_held_by_public and
    intragovernmental_holdings in one multi-field record. This pulls it
    out as its own plain {date, value} series so it's directly chartable,
    same as everything else."""
    records = load_records(source_id)
    if records is None:
        print(f"  skip {out_id}: {source_id}.json not found")
        return 0

    out = [{"date": r["date"], "value": r["total_debt"]} for r in records if "total_debt" in r]

    write_series(out_id, source="Derived", records=out, extra_meta={
        "label": "Total public debt outstanding (USD)",
        "derived_from": source_id,
        "method": "direct extraction, no calculation",
    })
    return len(out)


def main():
    if not os.path.isdir(DATA_DIR):
        sys.exit(f"No {DATA_DIR}/ directory found. Run the fetch_*.py scripts first.")

    print("Computing CPI YoY (headline)...")
    n = compute_yoy("cpi_headline", "cpi_yoy", "CPI, year-over-year % change")
    print(f"  {n} records -> data/cpi_yoy.json")

    print("Computing CPI YoY (core)...")
    n = compute_yoy("cpi_core", "cpi_core_yoy", "Core CPI, year-over-year % change")
    print(f"  {n} records -> data/cpi_core_yoy.json")

    print("Computing real 10Y yield...")
    n = compute_real_yield("cpi_yoy", "treasury_10y", "real_yield_10y")
    print(f"  {n} records -> data/real_yield_10y.json")

    print("Computing recession probability...")
    n = compute_recession_probability("treasury_10y", "treasury_3mo", "recession_probability")
    print(f"  {n} records -> data/recession_probability.json")

    print("Computing debt-to-GDP...")
    n = compute_debt_to_gdp("debt_to_penny", "gdp", "debt_to_gdp")
    print(f"  {n} records -> data/debt_to_gdp.json")

    print("Extracting total debt...")
    n = compute_total_debt("debt_to_penny", "total_debt")
    print(f"  {n} records -> data/total_debt.json")

    print("\nDone.")


if __name__ == "__main__":
    main()
