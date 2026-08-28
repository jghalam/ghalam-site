#!/usr/bin/env python3
import json
import sys
import sqlite3
import gzip

def stations_to_db(data, db_file_path):
    """
    Writes an already-in-memory list of station dicts to a SQLite database.
    Split out from json_to_db() below so callers that already have the data
    in memory (e.g. fetch_stations.py, pulling straight from the API) can
    skip writing/re-reading an intermediate JSON file entirely.
    """
    if isinstance(data, dict):
        data = [data]

    print(f"Loaded {len(data)} stations")

    conn = sqlite3.connect(db_file_path)
    cursor = conn.cursor()

    try:
        # This script is meant to fully regenerate the DB from a complete
        # dump each run, not update one incrementally — so it always starts
        # from a clean table matching the CURRENT schema below, rather than
        # trusting whatever schema happened to already exist at this output
        # path (e.g. from a run before a column was added here). Without
        # this, "CREATE TABLE IF NOT EXISTS" is a no-op against a pre-
        # existing table, silently keeping its old (possibly stale) schema.
        cursor.execute("DROP TABLE IF EXISTS Station")

        # Create Station table
        # NOTE: `Hls` and `LanguageCode` are appended at the END, after every
        # column the iOS app's stations.swift already expects when this was
        # written. This file is shared with that app — adding a column here
        # is safe (an extra column an old/positional reader doesn't ask for
        # is simply ignored), but inserting one in the MIDDLE would shift
        # every later column's index for any code that reads by position
        # rather than by name. Keep new columns at the end.
        cursor.execute("""
            CREATE TABLE Station (
                StationID INTEGER PRIMARY KEY,
                Name TEXT NOT NULL DEFAULT '',
                Url TEXT NOT NULL DEFAULT '',
                Homepage TEXT NOT NULL DEFAULT '',
                Favicon TEXT NOT NULL DEFAULT '',
                Language VARCHAR(100) NOT NULL DEFAULT '',
                Tags TEXT NOT NULL DEFAULT '',
                Subcountry VARCHAR(50) NOT NULL DEFAULT '',
                CountryCode VARCHAR(2) NOT NULL DEFAULT '',
                GeoLat DOUBLE,
                GeoLong DOUBLE,
                Hls INTEGER NOT NULL DEFAULT 0,
                LanguageCode VARCHAR(50) NOT NULL DEFAULT ''
            )
        """)

        total = len(data)
        for idx, station in enumerate(data, start=1):
            # Ensure we always have strings, never None
            station_id = idx
            name = station.get('name') or ''
            url = station.get('url_resolved') or station.get('url_stream') or station.get('url') or ''
            homepage = station.get('url_homepage') or station.get('homepage') or ''
            favicon = station.get('url_favicon') or station.get('favicon') or ''
            language = station.get('iso_639') or station.get('language') or ''
            tags = station.get('tags') or ''
            # `state` first: it's the human-readable name and what the web
            # app's region filter actually displays. `iso_3166_2` isn't just
            # less readable as a fallback — for at least some countries
            # (observed: every China entry) radio-browser populates it with
            # a bogus, non-region-specific value (e.g. "CN-156", which is
            # just "CN" + China's own ISO 3166-1 *country* code, not a real
            # subdivision), collapsing every station in that country to one
            # meaningless "region." `state` had the real value ("Kwangtung")
            # in that same case.
            subcountry = station.get('state') or station.get('iso_3166_2') or ''
            country_code = station.get('iso_3166_1') or station.get('countrycode') or ''
            geo_lat = station.get('geo_lat')  # Can be None
            geo_long = station.get('geo_long')  # Can be None
            # radio-browser sends this as an int (0/1) today, but coerce
            # defensively in case a future dump sends a JSON boolean instead.
            hls = 1 if station.get('hls') else 0
            # Normalized ISO codes (e.g. "en" or "ar,en" for a multi-language
            # station) — distinct from the free-text `language` field above
            # ("english", "Arabic", inconsistent capitalization/spelling
            # across stations). This is what a real language FILTER should
            # be built on; `language` stays as-is for display purposes only.
            language_code = station.get('languagecodes') or ''

            cursor.execute("""
                INSERT INTO Station (
                    StationID, Name, Url, Homepage, Favicon, 
                    Language, Tags, Subcountry, CountryCode, 
                    GeoLat, GeoLong, Hls, LanguageCode
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                station_id, name, url, homepage, favicon,
                language, tags, subcountry, country_code,
                geo_lat, geo_long, hls, language_code
            ))

            if idx % 1000 == 0:
                print(f"Processed {idx}/{total} stations...")

        conn.commit()

        print(f"\nDatabase created successfully: {db_file_path}")
        print(f"Processed {len(data)} station(s)")

        cursor.execute("SELECT COUNT(*) FROM Station")
        count = cursor.fetchone()[0]
        print(f"Total stations in database: {count}")

    except sqlite3.Error as e:
        print(f"Database error: {e}")
        conn.rollback()
    finally:
        conn.close()

def json_to_db(json_file_path, db_file_path):
    """
    Convert JSON file with station data to SQLite database.
    Supports both regular JSON and gzipped JSON files.
    """

    # Read JSON file
    try:
        if json_file_path.endswith('.gz'):
            with gzip.open(json_file_path, 'rt', encoding='utf-8') as f:
                data = json.load(f)
        else:
            with open(json_file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
    except FileNotFoundError:
        print(f"Error: File '{json_file_path}' not found")
        return
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON - {e}")
        return
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    print(f"Loaded from {json_file_path}")
    stations_to_db(data, db_file_path)

if __name__ == "__main__":
    input_file = "stations.json"
    output_file = "stations.db"
    
    if len(sys.argv) >= 2:
        input_file = sys.argv[1]
    if len(sys.argv) >= 3:
        output_file = sys.argv[2]
    
    print(f"Converting {input_file} to {output_file}...")
    json_to_db(input_file, output_file)
