"""
Reads data/events_draft.json (produced by detect_events.py, optionally
edited by hand) and publishes EVERY entry to data/events.json — nothing
gets dropped. Where you've written your own "title" and "narrative",
that's used as-is. Where you haven't, a plain-English title and
narrative are auto-generated from what the detector found, so every
statistically notable moment shows up on the site even if you never
touch the draft file.

Usage:
    python3 publish_events.py
"""
import json
import os
import sys

from detect_events import LABELS

DATA_DIR = "data"
DRAFT_PATH = os.path.join(DATA_DIR, "events_draft.json")
PUBLISHED_PATH = os.path.join(DATA_DIR, "events.json")


def has_custom_text(entry: dict) -> bool:
    title = entry.get("title")
    narrative = entry.get("narrative")
    return bool(title and title.strip()) and bool(narrative and narrative.strip())


def linked_series_for(entry: dict) -> list:
    return sorted(set(m["series"] for m in entry.get("candidates", [])))


def auto_title(entry: dict) -> str:
    series_ids = linked_series_for(entry)
    labels = [LABELS.get(s, (s, ""))[0] for s in series_ids]
    if len(labels) == 1:
        return labels[0]
    if len(labels) == 2:
        return f"{labels[0]} & {labels[1]}"
    return f"{', '.join(labels[:-1])} & {labels[-1]}"


def auto_narrative(entry: dict) -> str:
    descriptions = entry.get("what_triggered_this", [])
    return "; ".join(descriptions) if descriptions else "No description available."


def main():
    if not os.path.exists(DRAFT_PATH):
        sys.exit(f"{DRAFT_PATH} not found. Run detect_events.py first.")

    with open(DRAFT_PATH) as f:
        draft = json.load(f)

    published = []
    curated_count = 0
    for entry in draft:
        curated = has_custom_text(entry)
        if curated:
            curated_count += 1
            title = entry["title"].strip()
            narrative = entry["narrative"].strip()
        else:
            title = auto_title(entry)
            narrative = auto_narrative(entry)

        published.append({
            "id": entry["id"],
            "date": entry["date"],
            "title": title,
            "narrative": narrative,
            "linked_series": linked_series_for(entry),
            "curated": curated,   # true if you wrote this one by hand, false if auto-generated
        })

    published.sort(key=lambda e: e["date"])

    with open(PUBLISHED_PATH, "w") as f:
        json.dump(published, f, indent=2)

    print(f"Published {len(published)} event(s) to {PUBLISHED_PATH}")
    print(f"  {curated_count} with your own title/narrative")
    print(f"  {len(published) - curated_count} auto-generated from the detector's description")


if __name__ == "__main__":
    main()
