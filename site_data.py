"""
Shared helpers so every fetcher writes the same JSON shape into data/ and
keeps a single manifest.json the frontend can read to discover what's
available, without hardcoding filenames into the site JS.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone

DATA_DIR = "data"
MANIFEST_PATH = os.path.join(DATA_DIR, "manifest.json")


def write_series(internal_id: str, source: str, records: list, extra_meta: dict | None = None):
    """
    Writes data/<internal_id>.json in a consistent shape:
        {
          "id": "...", "source": "...", "updated": "<ISO8601 UTC>",
          "records": [ {...}, ... ]   # already sorted ascending by date
        }
    Then updates data/manifest.json with this series' id/source/updated/
    count, so the frontend (or you) can list what's available without
    opening every file.
    """
    os.makedirs(DATA_DIR, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat()

    payload = {
        "id": internal_id,
        "source": source,
        "updated": now,
        "count": len(records),
        "records": records,
    }
    if extra_meta:
        payload.update(extra_meta)

    out_path = os.path.join(DATA_DIR, f"{internal_id}.json")
    with open(out_path, "w") as f:
        json.dump(payload, f, indent=2)

    _update_manifest(internal_id, source, now, len(records))
    return out_path


def _update_manifest(internal_id: str, source: str, updated: str, count: int):
    manifest = {}
    if os.path.exists(MANIFEST_PATH):
        with open(MANIFEST_PATH) as f:
            manifest = json.load(f)

    manifest[internal_id] = {"source": source, "updated": updated, "count": count}

    with open(MANIFEST_PATH, "w") as f:
        json.dump(manifest, f, indent=2)
