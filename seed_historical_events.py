"""
Seeds a set of well-documented historical economic events — with real
names and precise dates, not statistical descriptions — directly into
data/events_draft.json as already-curated entries. Run this ONCE, before
your next detect_events.py run; after that, detect_events.py's merge
logic preserves them automatically (they behave exactly like anything
you'd curated by hand).

This list covers events well-established in economic history, each with
a specific date and enough context to be meaningful on its own. It is
NOT exhaustive — recent years (roughly since 2024) aren't included,
since I'd rather leave those to you than guess at framing for events
still close enough to be contested. Add your own the same way you would
any curated entry: same schema, same file.

Usage:
    python3 seed_historical_events.py
"""
import json
import os

DATA_DIR = "data"
DRAFT_PATH = os.path.join(DATA_DIR, "events_draft.json")

SEED_EVENTS = [
    {
        "date": "1971-08-15",
        "title": "The Nixon Shock",
        "narrative": "Nixon suspended the dollar's convertibility into gold, ending the Bretton Woods system and letting the dollar float freely for the first time since World War II.",
        "linked_series": ["gold_price", "usd_broad_index"],
    },
    {
        "date": "1973-10-17",
        "title": "The 1973 oil embargo",
        "narrative": "OPEC's embargo, in response to Western support for Israel in the Yom Kippur War, quadrupled oil prices and helped trigger the stagflation of the 1970s.",
        "linked_series": ["cpi_yoy"],
    },
    {
        "date": "1979-10-06",
        "title": "The Volcker Shock",
        "narrative": "Fed Chair Paul Volcker sharply tightened monetary policy to break double-digit inflation, driving the Fed Funds Rate above 19% by 1981 and triggering a deep recession.",
        "linked_series": ["fed_funds", "cpi_yoy"],
    },
    {
        "date": "1980-01-21",
        "title": "1980 gold price spike",
        "narrative": "Gold briefly hit an all-time high (in nominal terms) amid high inflation, the Soviet invasion of Afghanistan, and the Iranian Revolution.",
        "linked_series": ["gold_price"],
    },
    {
        "date": "1987-10-19",
        "title": "Black Monday",
        "narrative": "Global stock markets crashed, with the Dow falling over 22% in a single day — the largest one-day percentage decline in its history.",
        "linked_series": [],
    },
    {
        "date": "1990-08-02",
        "title": "Gulf War oil shock",
        "narrative": "Iraq's invasion of Kuwait sent oil prices spiking and contributed to the 1990-91 US recession.",
        "linked_series": ["cpi_yoy"],
    },
    {
        "date": "1994-02-04",
        "title": "The 1994 bond market rout",
        "narrative": "The Fed's rapid, unexpected rate hikes triggered one of the worst bond market selloffs in decades, later dubbed the \"bond massacre.\"",
        "linked_series": ["fed_funds", "treasury_10y"],
    },
    {
        "date": "1997-07-02",
        "title": "The Asian financial crisis",
        "narrative": "Thailand's currency collapse triggered a wave of devaluations and financial crises across East Asia, with ripple effects on global markets.",
        "linked_series": ["usd_broad_index"],
    },
    {
        "date": "1998-08-17",
        "title": "Russian default and LTCM collapse",
        "narrative": "Russia defaulted on its debt, and the resulting turmoil helped sink the hedge fund Long-Term Capital Management, prompting a Fed-orchestrated bailout to avert wider contagion.",
        "linked_series": ["treasury_10y"],
    },
    {
        "date": "2000-03-10",
        "title": "The dot-com bubble bursts",
        "narrative": "The Nasdaq peaked and began a two-and-a-half-year decline of nearly 80%, as speculative internet-era valuations unwound.",
        "linked_series": ["fed_funds"],
    },
    {
        "date": "2001-09-11",
        "title": "September 11 attacks",
        "narrative": "The attacks closed US financial markets for four trading days and accelerated Fed rate cuts already underway amid the dot-com downturn.",
        "linked_series": ["fed_funds"],
    },
    {
        "date": "2008-09-15",
        "title": "Lehman Brothers collapse",
        "narrative": "Lehman Brothers' bankruptcy — the largest in US history — marked the acute phase of the global financial crisis, freezing credit markets worldwide.",
        "linked_series": ["fed_funds", "treasury_10y", "unemployment"],
    },
    {
        "date": "2008-12-16",
        "title": "The Fed cuts rates to near zero",
        "narrative": "The Fed cut its target rate to 0-0.25% in response to the financial crisis, beginning nearly seven years of zero interest rate policy and the start of quantitative easing.",
        "linked_series": ["fed_funds"],
    },
    {
        "date": "2011-08-05",
        "title": "US credit rating downgrade",
        "narrative": "S&P stripped the United States of its AAA credit rating for the first time, amid a debt-ceiling standoff and the deepening European sovereign debt crisis.",
        "linked_series": ["treasury_10y", "debt_to_gdp"],
    },
    {
        "date": "2013-05-22",
        "title": "The taper tantrum",
        "narrative": "Bernanke's suggestion that the Fed might slow its bond-buying program triggered a sharp, rapid rise in Treasury yields as markets repriced expectations.",
        "linked_series": ["treasury_10y"],
    },
    {
        "date": "2014-11-27",
        "title": "The 2014-2016 oil price collapse",
        "narrative": "OPEC's decision not to cut production amid a US shale supply boom sent oil prices down more than 70% over the following year.",
        "linked_series": ["cpi_yoy"],
    },
    {
        "date": "2015-12-16",
        "title": "The Fed's first post-crisis rate hike",
        "narrative": "The Fed raised rates for the first time since 2006, ending seven years of near-zero interest rates.",
        "linked_series": ["fed_funds"],
    },
    {
        "date": "2020-03-23",
        "title": "The COVID-19 crash and response",
        "narrative": "Markets bottomed after a historically fast crash as COVID-19 lockdowns began; the Fed cut rates to zero and launched unprecedented asset purchases within days.",
        "linked_series": ["fed_funds", "unemployment", "treasury_10y"],
    },
    {
        "date": "2022-03-16",
        "title": "The Fed begins its 2022 hiking cycle",
        "narrative": "The Fed raised rates for the first time since 2018, the start of its fastest tightening cycle in decades as inflation ran at 40-year highs.",
        "linked_series": ["fed_funds", "cpi_yoy"],
    },
    {
        "date": "2023-03-10",
        "title": "Silicon Valley Bank collapse",
        "narrative": "SVB's failure — the second-largest bank failure in US history at the time — was triggered in part by losses on long-dated bonds as the Fed's rapid rate hikes eroded their value.",
        "linked_series": ["fed_funds", "treasury_10y"],
    },
]


def load_existing_draft():
    if not os.path.exists(DRAFT_PATH):
        return []
    with open(DRAFT_PATH) as f:
        return json.load(f)


def next_id_number(existing_entries: list) -> int:
    max_n = -1
    for e in existing_entries:
        try:
            n = int(e["id"].split("_")[-1])
            max_n = max(max_n, n)
        except (ValueError, KeyError, IndexError):
            continue
    return max_n + 1


def already_seeded(existing_entries: list, seed_date: str) -> bool:
    """Avoids adding duplicates if this script is run more than once."""
    return any(e.get("date") == seed_date and e.get("title") for e in existing_entries)


def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    existing = load_existing_draft()
    next_id = next_id_number(existing)

    added = 0
    skipped = 0
    for seed in SEED_EVENTS:
        if already_seeded(existing, seed["date"]):
            skipped += 1
            continue
        existing.append({
            "id": f"draft_{next_id:04d}",
            "date": seed["date"],
            "significance": None,   # not detector-derived — this is a known historical event
            "what_triggered_this": ["Manually seeded historical event, not statistically detected"],
            "title": seed["title"],
            "narrative": seed["narrative"],
            "candidates": [{"series": s, "date": seed["date"], "change": 0, "z_score": 0, "description": ""} for s in seed["linked_series"]],
        })
        next_id += 1
        added += 1

    existing.sort(key=lambda e: e["date"])

    with open(DRAFT_PATH, "w") as f:
        json.dump(existing, f, indent=2)

    print(f"Added {added} historical event(s), skipped {skipped} already present")
    print(f"Wrote {len(existing)} total entries to {DRAFT_PATH}")
    print("\nRun publish_events.py to make these live, or detect_events.py first")
    print("if you also want fresh statistical candidates alongside them.")


if __name__ == "__main__":
    main()
