"""
Central registry of what to pull and, for the multi-column sources, which
columns actually make it into the site-ready JSON. Add a new indicator by
adding one line here — fetcher code doesn't change.
"""

# --- FRED series ---------------------------------------------------------
# key = internal id (also the output filename), value = the FRED series_id
FRED_SERIES = {
    "cpi_headline": "CPIAUCSL",
    "cpi_core": "CPILFESL",
    "pce_headline": "PCEPI",
    "pce_core": "PCEPILFE",
    "fed_funds": "FEDFUNDS",
    "treasury_2y": "DGS2",
    "treasury_5y": "DGS5",
    "treasury_10y": "DGS10",
    "treasury_30y": "DGS30",
    "unemployment": "UNRATE",
    "gdp": "GDP",
    "m2": "M2SL",
    # NOTE: gold price removed from here — see STOOQ_SYMBOLS below.
    # FRED's LBMA-sourced gold series (GOLDAMGBD228NLBM, then GOLDPMGBD228NLBM)
    # have both returned HTTP 400 as of Aug 2026. This lines up with ICE
    # Benchmark Administration restricting historical LBMA gold data to a
    # paid licence in 2025, which appears to have cut off FRED's upstream
    # feed. Gold price is now sourced from Stooq instead (free, no key).

    "usd_broad_index": "DTWEXBGS",
    "usd_vs_eur": "DEXUSEU",
    "usd_vs_jpy": "DEXJPUS",
    "usd_vs_gbp": "DEXUSUK",
    "usd_vs_cny": "DEXCHUS",
}

# --- Treasury Fiscal Data API ---------------------------------------------
# key = internal id (also output filename)
# endpoint  = API path
# params    = extra query params (sort order etc.)
# date_field = which column is the record date
# value_fields = {output_key: source_column} — only these columns survive
#                into the slim JSON; everything else from the API is dropped
TREASURY_ENDPOINTS = {
    "debt_to_penny": {
        "endpoint": "/v2/accounting/od/debt_to_penny",
        "params": {"sort": "-record_date"},
        "date_field": "record_date",
        "value_fields": {
            "total_debt": "tot_pub_debt_out_amt",
            "debt_held_by_public": "debt_held_public_amt",
            "intragovernmental_holdings": "intragov_hold_amt",
        },
    },
    "interest_expense": {
        "endpoint": "/v2/accounting/od/interest_expense",
        "params": {"sort": "-record_date"},
        "date_field": "record_date",
        "value_fields": {
            "expense_category": "expense_catg_desc",
            "month_expense_amt": "month_expense_amt",
        },
    },
}

# --- CFTC Commitments of Traders (Socrata) --------------------------------
# key = internal id, value = Socrata dataset id
CFTC_DATASETS = {
    "legacy_futures_only": "6dca-aqww",
}

# Columns kept in the slim CFTC output. Left = output key, right = Socrata
# field name. Verify these field names against a raw pull if CFTC ever
# changes their schema — Socrata field names are the API's contract, but
# datasets do occasionally get revised.
CFTC_VALUE_FIELDS = {
    "date": "report_date_as_yyyy_mm_dd",
    "open_interest": "open_interest_all",
    "noncommercial_long": "noncomm_positions_long_all",
    "noncommercial_short": "noncomm_positions_short_all",
    "commercial_long": "comm_positions_long_all",
    "commercial_short": "comm_positions_short_all",
}

# Internal commodity key -> exact commodity_name value to filter on.
# Confirm the exact spelling by running fetch_cftc.py once with no
# --commodity filter and inspecting commodity_name in the raw output.
CFTC_COMMODITY_FILTERS = {
    "gold": "GOLD",
}

# --- Stooq (free, no-key CSV) ---------------------------------------------
# key = internal id (also output filename), value = Stooq's ticker symbol.
# Same source you'll likely add stock indices to later (e.g. "^spx" for
# S&P 500) — one less API to integrate.
STOOQ_SYMBOLS = {
    "gold_price": "xauusd",
}

