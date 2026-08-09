"""
Generates simple, transparent forecasts for a handful of key indicators
and writes them into data/ alongside the historical series, in the same
{date, value} shape plus "lower"/"upper" confidence-band fields.

Method: Holt's linear trend method (double exponential smoothing) — a
well-established, explainable classical technique, not a machine-learning
model. It tracks two things as new data arrives: a "level" (roughly,
where the series currently sits) and a "trend" (roughly, how fast it's
been moving), then projects forward by extending that trend. Smoothing
parameters (alpha for level, beta for trend) are chosen per series by a
small grid search that minimizes one-step-ahead prediction error on the
series' own history — not hand-tuned, not fit on withheld future data.

The confidence band widens with distance into the future
(± z * sigma * sqrt(h) for h steps ahead), which is standard practice
for this class of model and is the honest way to say "we're far less
sure about month 12 than month 1" rather than presenting a single
confident-looking line. This is deliberately conservative: it will not
predict recessions, turning points, or anything a straight-line
extension of recent behavior wouldn't already suggest. That's the
point — see the project notes on why forecasting stays modest here.

Usage:
    python3 forecast.py
"""
import json
import math
import os
import statistics
import sys
from datetime import date, timedelta

from site_data import write_series

DATA_DIR = "data"

# Per-series forecast config:
#   horizon        how many periods ahead to project
#   period_days    approximate days between data points (used to generate
#                   forecast dates) — doesn't need to be exact, just
#                   representative of the series' actual cadence
#   confidence_z    z-score for the confidence band (1.28 \u2248 80%, 1.96 \u2248 95%).
#                   80% is the default: a tighter, more honest band than a
#                   95% interval that can look reassuringly wide without
#                   actually being more useful.
FORECAST_CONFIG = {
    "cpi_yoy":         {"horizon": 24, "period_days": 30,  "confidence_z": 1.28},
    "cpi_core_yoy":    {"horizon": 24, "period_days": 30,  "confidence_z": 1.28},
    "fed_funds":       {"horizon": 24, "period_days": 30,  "confidence_z": 1.28},
    "treasury_10y":    {"horizon": 180, "period_days": 1,  "confidence_z": 1.28},
    "real_yield_10y":  {"horizon": 180, "period_days": 1,  "confidence_z": 1.28},
    "unemployment":    {"horizon": 24, "period_days": 30,  "confidence_z": 1.28},
    "debt_to_gdp":      {"horizon": 8,  "period_days": 91,  "confidence_z": 1.28},
    "gold_price":       {"horizon": 180, "period_days": 1,  "confidence_z": 1.28},
    "usd_broad_index":  {"horizon": 180, "period_days": 1,  "confidence_z": 1.28},
}

MIN_POINTS = 24   # not enough history to fit a trend reliably below this

ALPHA_GRID = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]
BETA_GRID = [0.05, 0.1, 0.2, 0.3]


def load_records(internal_id: str):
    path = os.path.join(DATA_DIR, f"{internal_id}.json")
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f)["records"]


def holt_fit(values: list, alpha: float, beta: float):
    """Fits Holt's linear trend method and returns (level, trend,
    one_step_errors) — the final level/trend estimates and the list of
    one-step-ahead prediction errors (actual - predicted) used both to
    pick alpha/beta and to estimate the forecast's uncertainty."""
    level = values[0]
    trend = values[1] - values[0] if len(values) > 1 else 0.0
    errors = []

    for t in range(1, len(values)):
        predicted = level + trend
        errors.append(values[t] - predicted)
        new_level = alpha * values[t] + (1 - alpha) * (level + trend)
        new_trend = beta * (new_level - level) + (1 - beta) * trend
        level, trend = new_level, new_trend

    return level, trend, errors


def fit_best_params(values: list):
    """Grid search over ALPHA_GRID x BETA_GRID, picking the combination
    with the lowest sum of squared one-step-ahead errors on the series'
    own history. Simple, deterministic, and reproducible — not an
    opaque optimizer."""
    best = None
    for alpha in ALPHA_GRID:
        for beta in BETA_GRID:
            level, trend, errors = holt_fit(values, alpha, beta)
            sse = sum(e ** 2 for e in errors)
            if best is None or sse < best["sse"]:
                best = {"alpha": alpha, "beta": beta, "level": level, "trend": trend, "errors": errors, "sse": sse}
    return best


def forecast_series(series_id: str, config: dict):
    records = load_records(series_id)
    if records is None:
        print(f"  skip {series_id}: data/{series_id}.json not found")
        return None
    if len(records) < MIN_POINTS:
        print(f"  skip {series_id}: only {len(records)} points, need at least {MIN_POINTS}")
        return None

    values = [r["value"] for r in records]
    fit = fit_best_params(values)

    residual_sigma = statistics.pstdev(fit["errors"]) if len(fit["errors"]) > 1 else 0.0

    last_date = date.fromisoformat(records[-1]["date"])
    horizon = config["horizon"]
    period_days = config["period_days"]
    z = config["confidence_z"]

    forecast_points = []
    for h in range(1, horizon + 1):
        point_value = fit["level"] + h * fit["trend"]
        band_width = z * residual_sigma * math.sqrt(h)
        forecast_date = last_date + timedelta(days=period_days * h)
        forecast_points.append({
            "date": forecast_date.isoformat(),
            "value": round(point_value, 4),
            "lower": round(point_value - band_width, 4),
            "upper": round(point_value + band_width, 4),
        })

    return {
        "points": forecast_points,
        "alpha": fit["alpha"],
        "beta": fit["beta"],
        "residual_sigma": round(residual_sigma, 4),
        "fit_points_used": len(values),
    }


def main():
    if not os.path.isdir(DATA_DIR):
        sys.exit(f"No {DATA_DIR}/ directory found. Run the fetch_*.py and calculate.py scripts first.")

    for series_id, config in FORECAST_CONFIG.items():
        print(f"Forecasting {series_id}...")
        result = forecast_series(series_id, config)
        if result is None:
            continue

        out_path = write_series(
            f"forecast_{series_id}",
            source="Forecast",
            records=result["points"],
            extra_meta={
                "method": "Holt linear trend (double exponential smoothing)",
                "forecast_of": series_id,
                "alpha": result["alpha"],
                "beta": result["beta"],
                "residual_sigma": result["residual_sigma"],
                "fit_points_used": result["fit_points_used"],
                "confidence_level": "~80%",
            },
        )
        print(f"  {len(result['points'])} point(s) -> {out_path}  (alpha={result['alpha']}, beta={result['beta']})")

    print("\nDone.")


if __name__ == "__main__":
    main()
