"""
Scans the series in data/ for statistically notable moments and writes a
SHORT, RANKED, plain-English shortlist for you to review — not a raw dump
of every statistical blip. This does NOT publish anything the frontend
reads — see publish_events.py for that step.

Workflow:
    1. python3 detect_events.py              -> writes data/events_draft.json
                                                  and data/events_review.md
    2. Open events_review.md first (plain text, ranked, easiest to skim).
       For any entry you recognize and want to keep, find its id (e.g.
       "draft_0007") and, in events_draft.json, fill in that entry's
       "title" and "narrative". Leave both null on anything you don't
       want — most entries, probably. You are not expected to research
       or explain every one; skip anything you don't immediately
       recognize the significance of.
    3. python3 publish_events.py             -> writes data/events.json
       (only entries with both title and narrative filled in survive)

Detection method: for each series, compute the change between consecutive
points, then flag points that are an unusual number of standard
deviations from their own recent trend (a per-series threshold — see
EVENT_CONFIG — since a fixed threshold flags routine noise in volatile
daily series like gold while missing real turning points in calm ones).
Nearby flags across different series get grouped into one cluster, since
a real event usually shows up in more than one series at once. Clusters
are ranked by a significance score — total statistical magnitude, boosted
when multiple series moved together — and only the top N (default 30)
are written out, so you're reviewing a shortlist, not several hundred
entries.
"""
import json
import os
import statistics
import sys
from datetime import datetime

DATA_DIR = "data"
CLUSTER_GAP_DAYS = 45     # candidates from different series within this many
                          # days of each other get grouped into one cluster
DEFAULT_TOP_N = 30        # how many ranked clusters to actually write out

# Display label and unit for plain-English descriptions.
# unit: '%' -> shown as a percentage; '$' -> shown as currency; '' -> shown
# as a bare number (e.g. an index).
LABELS = {
    "cpi_yoy":         ("CPI (YoY)", "%"),
    "cpi_core_yoy":    ("Core CPI (YoY)", "%"),
    "fed_funds":       ("Fed Funds Rate", "%"),
    "treasury_10y":    ("10Y Treasury Yield", "%"),
    "real_yield_10y":  ("Real 10Y Yield", "%"),
    "unemployment":    ("Unemployment Rate", "%"),
    "debt_to_gdp":     ("Debt / GDP", "%"),
    "gold_price":      ("Gold Price", "$"),
    "usd_broad_index": ("USD Broad Index", ""),
}

# Per-series detection config — see module docstring for the reasoning.
# Daily series (treasury_10y, real_yield_10y, gold_price, usd_broad_index)
# use a higher threshold and wider spacing than monthly/quarterly ones,
# since daily data is noisier and produces far more raw statistical
# outliers for the same underlying volatility.
EVENT_CONFIG = {
    "cpi_yoy":         {"method": "diff", "window": 36, "z_threshold": 2.0, "min_gap_days": 180},
    "cpi_core_yoy":    {"method": "diff", "window": 36, "z_threshold": 2.0, "min_gap_days": 180},
    "fed_funds":       {"method": "diff", "window": 24, "z_threshold": 1.8, "min_gap_days": 90},
    "treasury_10y":    {"method": "diff", "window": 60, "z_threshold": 3.0, "min_gap_days": 60},
    "real_yield_10y":  {"method": "diff", "window": 60, "z_threshold": 2.8, "min_gap_days": 60},
    "unemployment":    {"method": "diff", "window": 24, "z_threshold": 1.8, "min_gap_days": 90},
    "debt_to_gdp":     {"method": "diff", "window": 8,  "z_threshold": 1.5, "min_gap_days": 365},
    "gold_price":      {"method": "pct",  "window": 90, "z_threshold": 3.0, "min_gap_days": 60},
    "usd_broad_index": {"method": "pct",  "window": 90, "z_threshold": 3.0, "min_gap_days": 60},
}


def load_records(internal_id: str):
    path = os.path.join(DATA_DIR, f"{internal_id}.json")
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f)["records"]


def compute_changes(records: list, method: str):
    """Returns (date, change, prev_value, value) for consecutive points."""
    changes = []
    for i in range(1, len(records)):
        prev = records[i - 1]["value"]
        cur = records[i]["value"]
        if method == "pct":
            if prev == 0:
                continue
            change = (cur / prev - 1) * 100
        else:
            change = cur - prev
        changes.append((records[i]["date"], change, prev, cur))
    return changes


def rolling_zscores(changes: list, window: int):
    for i in range(window, len(changes)):
        trailing = [c[1] for c in changes[i - window:i]]
        mean = statistics.mean(trailing)
        stdev = statistics.pstdev(trailing)
        if stdev == 0:
            continue
        date, change, prev_value, value = changes[i]
        z = (change - mean) / stdev
        yield date, change, z, prev_value, value


def describe(series_id: str, prev_value: float, value: float, change: float) -> str:
    label, unit = LABELS.get(series_id, (series_id, ""))
    if unit == "%":
        return f"{label}: {prev_value:.2f}% \u2192 {value:.2f}%"
    if unit == "$":
        return f"{label}: ${prev_value:,.0f} \u2192 ${value:,.0f} ({change:+.1f}%)"
    return f"{label}: {prev_value:.2f} \u2192 {value:.2f}"


def detect_candidates(series_id: str, config: dict):
    records = load_records(series_id)
    if records is None:
        print(f"  skip {series_id}: data/{series_id}.json not found")
        return []

    changes = compute_changes(records, config["method"])
    flagged = [
        {
            "series": series_id,
            "date": d,
            "change": round(c, 3),
            "z_score": round(z, 2),
            "description": describe(series_id, pv, v, c),
        }
        for d, c, z, pv, v in rolling_zscores(changes, config["window"])
        if abs(z) >= config["z_threshold"]
    ]

    flagged.sort(key=lambda f: f["date"])
    deduped = []
    for f in flagged:
        f_day = datetime.strptime(f["date"], "%Y-%m-%d").toordinal()
        if deduped:
            last_day = datetime.strptime(deduped[-1]["date"], "%Y-%m-%d").toordinal()
            if f_day - last_day <= config["min_gap_days"]:
                if abs(f["z_score"]) > abs(deduped[-1]["z_score"]):
                    deduped[-1] = f
                continue
        deduped.append(f)

    return deduped


MAX_CLUSTER_SPAN_DAYS = 60   # a cluster can never span more than this from its
                             # first member to its last, even if each individual
                             # gap is within CLUSTER_GAP_DAYS — otherwise a long,
                             # sustained crisis chain-links into one unreadable
                             # mega-event spanning many months


def cluster_candidates(all_candidates: list, gap_days: int):
    all_candidates.sort(key=lambda c: c["date"])
    clusters = []
    for c in all_candidates:
        c_day = datetime.strptime(c["date"], "%Y-%m-%d").toordinal()
        if clusters:
            last_cluster = clusters[-1]
            last_day = datetime.strptime(last_cluster["members"][-1]["date"], "%Y-%m-%d").toordinal()
            first_day = datetime.strptime(last_cluster["members"][0]["date"], "%Y-%m-%d").toordinal()
            within_gap = c_day - last_day <= gap_days
            within_span = c_day - first_day <= MAX_CLUSTER_SPAN_DAYS
            if within_gap and within_span:
                last_cluster["members"].append(c)
                continue
        clusters.append({"members": [c]})
    return clusters


def score_cluster(members: list) -> float:
    """Higher = more likely to be a real event worth reviewing first.
    Rewards both raw statistical magnitude AND multiple series moving
    together — a single series spiking is often just noise; several
    series moving in the same window is the actual signal."""
    total_z = sum(abs(m["z_score"]) for m in members)
    distinct_series = len(set(m["series"] for m in members))
    return total_z * (1 + 0.4 * (distinct_series - 1))


def load_existing_draft():
    """Returns the current events_draft.json contents, or [] if this is
    the first run (nothing to preserve yet)."""
    path = os.path.join(DATA_DIR, "events_draft.json")
    if not os.path.exists(path):
        return []
    with open(path) as f:
        return json.load(f)


def entry_series_set(entry: dict) -> set:
    return set(m["series"] for m in entry.get("candidates", []))


def entry_is_curated(entry: dict) -> bool:
    title = entry.get("title")
    narrative = entry.get("narrative")
    return bool(title and title.strip()) and bool(narrative and narrative.strip())


def days_between(date_a: str, date_b: str) -> int:
    a = datetime.strptime(date_a, "%Y-%m-%d").toordinal()
    b = datetime.strptime(date_b, "%Y-%m-%d").toordinal()
    return abs(a - b)


def match_curated_to_new_clusters(curated_entries: list, new_clusters: list):
    """Greedily matches each curated (human-written) draft entry to the
    freshly detected cluster that most likely represents the same
    real-world event — same underlying series, date within
    CLUSTER_GAP_DAYS (the same window used to decide two candidates are
    "the same event" during clustering itself, so this stays consistent
    with that definition). A curated entry that matches gets its fresh
    detection data (date/significance/what-triggered-this) refreshed
    while its id/title/narrative are kept untouched. A curated entry
    that matches nothing is still preserved as-is — new data narrowing
    or shifting the statistical window should never make a human's
    already-written narrative disappear.

    Returns (updated_curated_entries, set of new_clusters indices consumed).
    """
    claimed_indices = set()
    updated = []

    for entry in curated_entries:
        entry_series = entry_series_set(entry)
        best_idx = None
        best_diff = None
        for i, cluster in enumerate(new_clusters):
            if i in claimed_indices:
                continue
            cluster_series = set(m["series"] for m in cluster["members"])
            if not (entry_series & cluster_series):   # must share at least one series
                continue
            anchor_date = min(m["date"] for m in cluster["members"])
            diff = days_between(entry["date"], anchor_date)
            if diff > CLUSTER_GAP_DAYS:
                continue
            if best_diff is None or diff < best_diff:
                best_idx, best_diff = i, diff

        if best_idx is not None:
            claimed_indices.add(best_idx)
            cluster = new_clusters[best_idx]
            members = cluster["members"]
            updated.append({
                **entry,
                "date": min(m["date"] for m in members),
                "significance": cluster["significance"],
                "what_triggered_this": [m["description"] for m in members],
                "candidates": members,
            })
        else:
            # nothing matched — preserve the curated entry exactly as it was
            updated.append(entry)

    return updated, claimed_indices


def next_id_number(existing_entries: list) -> int:
    max_n = -1
    for e in existing_entries:
        try:
            n = int(e["id"].split("_")[-1])
            max_n = max(max_n, n)
        except (ValueError, KeyError, IndexError):
            continue
    return max_n + 1


def main():
    top_n = DEFAULT_TOP_N
    if len(sys.argv) > 1:
        try:
            top_n = int(sys.argv[1])
        except ValueError:
            sys.exit(f"Usage: python3 detect_events.py [top_n]  (got non-integer '{sys.argv[1]}')")

    if not os.path.isdir(DATA_DIR):
        sys.exit(f"No {DATA_DIR}/ directory found. Run the fetch_*.py and calculate.py scripts first.")

    all_candidates = []
    for series_id, config in EVENT_CONFIG.items():
        print(f"Scanning {series_id}...")
        candidates = detect_candidates(series_id, config)
        print(f"  {len(candidates)} candidate(s)")
        all_candidates.extend(candidates)

    print(f"\n{len(all_candidates)} total candidates before clustering")
    clusters = cluster_candidates(all_candidates, CLUSTER_GAP_DAYS)
    print(f"{len(clusters)} cluster(s) after grouping candidates within {CLUSTER_GAP_DAYS} days")

    for cluster in clusters:
        cluster["significance"] = round(score_cluster(cluster["members"]), 2)

    # --- merge against whatever's already been curated ---
    existing_draft = load_existing_draft()
    curated_entries = [e for e in existing_draft if entry_is_curated(e)]
    print(f"\n{len(curated_entries)} previously curated entry(ies) found in the existing draft")

    preserved, claimed = match_curated_to_new_clusters(curated_entries, clusters)
    matched_count = sum(1 for i in claimed)
    print(f"  {matched_count} matched to a freshly detected cluster (data refreshed, your text kept)")
    print(f"  {len(preserved) - matched_count} had no matching cluster this run (kept as-is regardless)")

    # remaining candidate pool = every cluster NOT already claimed by a
    # curated entry — this is what gets ranked and capped to top_n
    remaining = [c for i, c in enumerate(clusters) if i not in claimed]
    ranked = sorted(remaining, key=lambda c: c["significance"], reverse=True)
    kept_new = ranked[:top_n]
    dropped = len(ranked) - len(kept_new)

    next_id = next_id_number(existing_draft)
    new_entries = []
    for cluster in kept_new:
        members = cluster["members"]
        new_entries.append({
            "id": f"draft_{next_id:04d}",
            "date": min(m["date"] for m in members),
            "significance": cluster["significance"],
            "what_triggered_this": [m["description"] for m in members],
            "title": None,
            "narrative": None,
            "candidates": members,
        })
        next_id += 1

    draft = sorted(preserved + new_entries, key=lambda d: d["date"])

    draft_path = os.path.join(DATA_DIR, "events_draft.json")
    with open(draft_path, "w") as f:
        json.dump(draft, f, indent=2)

    review_lines = [
        "# EasyView — candidate events for review",
        "",
        f"{len(preserved)} already curated (kept from before, no action needed), "
        f"{len(new_entries)} new candidate(s) to review, {dropped} lower-ranked candidate(s) not shown.",
        "",
        "For anything you want to keep, find its id below in data/events_draft.json",
        "and fill in \"title\" and \"narrative\". Skip anything you don't recognize.",
        "",
        "## New candidates (ranked by significance)",
        "",
    ]
    new_ranked = sorted(new_entries, key=lambda e: e["significance"], reverse=True)
    for rank, entry in enumerate(new_ranked, start=1):
        series_involved = sorted(set(m["series"] for m in entry["candidates"]))
        review_lines.append(
            f"{rank}. **{entry['id']}** \u2014 {entry['date']} "
            f"(significance {entry['significance']}, {len(series_involved)} series)"
        )
        for desc in entry["what_triggered_this"]:
            review_lines.append(f"   - {desc}")
        review_lines.append("")

    if preserved:
        review_lines.append("## Already curated (unchanged)")
        review_lines.append("")
        for entry in sorted(preserved, key=lambda e: e["date"]):
            review_lines.append(f"- **{entry['id']}** \u2014 {entry['date']} \u2014 {entry['title']}")
        review_lines.append("")

    review_path = os.path.join(DATA_DIR, "events_review.md")
    with open(review_path, "w") as f:
        f.write("\n".join(review_lines))

    print(f"\nWrote {len(draft)} total draft entries ({len(preserved)} preserved + {len(new_entries)} new) to {draft_path}")
    print(f"Wrote a readable shortlist to {review_path}")


if __name__ == "__main__":
    main()
