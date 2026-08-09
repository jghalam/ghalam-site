"""
Fetches the USD/EUR/JPY/GBP/CNY share of allocated global foreign
exchange reserves (COFER) from the IMF's SDMX 3.0 API. No API key
required — the legacy dataservices.imf.org API was retired November 5,
2025; this uses the current api.imf.org endpoint, which is open for
public data.

Usage:
    python3 fetch_cofer.py

Output:
    data/cofer_usd_share.json, cofer_eur_share.json, cofer_jpy_share.json,
    cofer_gbp_share.json, cofer_cny_share.json — each {date, value} where
    value is a percent share of allocated reserves, quarterly.

How the data key was determined (for future reference if this ever needs
revisiting): dataflow IMF.STA:COFER, key dimension order is
COUNTRY.INDICATOR.FXR_CURRENCY.TYPE_OF_TRANSFORMATION.FREQUENCY.
  COUNTRY=G001              (World)
  INDICATOR=AFXRA           (Allocated foreign exchange reserves)
  FXR_CURRENCY=CI_<code>    (e.g. CI_USD)
  TYPE_OF_TRANSFORMATION=SHRO_PT  (Shares, i.e. percent — not NV_USD,
                                    which is the raw dollar amount)
  FREQUENCY=Q               (Quarterly — COFER isn't published more often)
"""
import json
import sys
import urllib.request
from datetime import date

from site_data import write_series

API_BASE = "https://api.imf.org/external/sdmx/3.0/data/dataflow/IMF.STA/COFER/+"

# Internal id -> FXR_CURRENCY code
COFER_SERIES = {
    "cofer_usd_share": "CI_USD",
    "cofer_eur_share": "CI_EUR",
    "cofer_jpy_share": "CI_JPY",
    "cofer_gbp_share": "CI_GBP",
    "cofer_cny_share": "CI_CNY",
}

QUARTER_TO_MONTH = {"Q1": "01", "Q2": "04", "Q3": "07", "Q4": "10"}


def build_key() -> str:
    currency_codes = "+".join(COFER_SERIES.values())
    return f"G001.AFXRA.{currency_codes}.SHRO_PT.Q"


def fetch_raw() -> dict:
    url = f"{API_BASE}/{build_key()}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "econ-dashboard/0.1", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def quarter_to_date(period: str) -> str:
    """'2026-Q1' -> '2026-01-01' (first day of the quarter's first month)."""
    year, q = period.split("-")
    return f"{year}-{QUARTER_TO_MONTH[q]}-01"


def parse_response(raw: dict) -> dict:
    """Returns {FXR_CURRENCY code: [{date, value}, ...]}. The series-key
    format is a colon-separated tuple of dimension VALUE INDICES (not the
    codes themselves), decoded against the dimension value lists included
    in the response — and critically, those value lists are sorted
    alphabetically by code, not in request order, so the index position
    for e.g. CI_USD has to be looked up dynamically, never assumed."""
    structure = raw["data"]["structures"][0]
    series_dims = structure["dimensions"]["series"]
    obs_dims = structure["dimensions"]["observation"]

    currency_dim_position = next(i for i, d in enumerate(series_dims) if d["id"] == "FXR_CURRENCY")
    currency_values = [v["id"] for v in series_dims[currency_dim_position]["values"]]
    time_values = [v["value"] for v in obs_dims[0]["values"]]

    series = raw["data"]["dataSets"][0]["series"]
    results = {}
    for series_key, series_data in series.items():
        indices = series_key.split(":")
        currency_code = currency_values[int(indices[currency_dim_position])]
        records = []
        for obs_idx, obs_val in series_data["observations"].items():
            if obs_val[0] is None:
                continue
            records.append({"date": quarter_to_date(time_values[int(obs_idx)]), "value": float(obs_val[0])})
        records.sort(key=lambda r: r["date"])
        results[currency_code] = records

    return results


def main():
    print(f"Fetching COFER reserve shares ({build_key()})...")
    try:
        raw = fetch_raw()
    except Exception as e:
        sys.exit(f"FAILED: {e}")

    by_currency = parse_response(raw)

    for internal_id, currency_code in COFER_SERIES.items():
        records = by_currency.get(currency_code)
        if not records:
            print(f"  WARNING: no data found for {currency_code} ({internal_id})")
            continue
        out_path = write_series(internal_id, source="IMF COFER", records=records, extra_meta={
            "label": f"{currency_code.replace('CI_', '')} share of allocated global FX reserves, %",
            "method": "IMF SDMX 3.0 API, World/Allocated reserves/Shares/Quarterly",
        })
        print(f"  {len(records)} records -> {out_path}")

    print("\nDone.")


if __name__ == "__main__":
    main()
