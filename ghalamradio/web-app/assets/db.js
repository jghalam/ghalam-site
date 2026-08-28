// GhalamRadio Web — station database (sql.js + pako)
//
// Loads the gzip-compressed, read-only station DB shipped alongside the app
// (built by conv.py from the radio-browser.info dump) and exposes search.
// Schema matches the iOS app's `stations.swift`, plus one addition:
//   Station(StationID, Name, Url, Homepage, Favicon, Language, Tags,
//           Subcountry, CountryCode, GeoLat, GeoLong, Hls, LanguageCode)
// `Hls` is web-only — an explicit flag from radio-browser for whether a
// stream is HLS. `LanguageCode` holds radio-browser's normalized ISO
// language code(s) (e.g. "en", or "ar,fr" for a multi-language station) —
// distinct from `Language`, which is free text ("english", "Arabic",
// inconsistent casing/spelling) used only for display. Both are appended
// at the end of the schema so they don't disturb the columns/positions the
// iOS app already reads.

const StationDB = (() => {
  let db = null;
  let loadPromise = null;
  // Detected once per DB load — the deployed stations.db.gz might not have
  // been regenerated with these columns yet even after this code is live,
  // so this can't be assumed; without it, the affected feature is just left
  // out of results entirely (Hls-based stream detection falls back to
  // guessing from the URL; the language filter dropdown stays hidden)
  // rather than the SELECT below throwing.
  let hasHlsColumn = false;
  let hasLanguageCodeColumn = false;

  function hasColumn(database, columnName) {
    try {
      const res = database.exec('PRAGMA table_info(Station)');
      if (!res.length) return false;
      const nameColIdx = res[0].columns.indexOf('name');
      return res[0].values.some(row => row[nameColIdx] === columnName);
    } catch (err) {
      return false;
    }
  }

  async function load(onProgress) {
    if (db) return db;
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
      onProgress?.('Downloading station database…');
      const res = await fetch(CONFIG.DB_URL);
      if (!res.ok) {
        throw new Error(`Failed to fetch station DB (${res.status})`);
      }
      const compressed = new Uint8Array(await res.arrayBuffer());

      onProgress?.('Decompressing…');
      const decompressed = pako.inflate(compressed); // gunzip

      onProgress?.('Opening database…');
      const SQL = await initSqlJs({
        locateFile: file => `https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/${file}`
      });
      db = new SQL.Database(decompressed);
      hasHlsColumn = hasColumn(db, 'Hls');
      hasLanguageCodeColumn = hasColumn(db, 'LanguageCode');

      onProgress?.('Ready');
      return db;
    })();

    return loadPromise;
  }

  function getStationCount() {
    if (!db) return 0;
    const res = db.exec('SELECT COUNT(*) FROM Station');
    return res.length ? res[0].values[0][0] : 0;
  }

  // Shared WHERE-clause builder for search() and count() below, so the two
  // can never disagree about what counts as a match. Returns null when
  // there's nothing to search on (mirrors the old early-return in each).
  function buildWhereClause(name, countryCode, subcountry, languageCode) {
    const hasName = name && name.trim().length > 0;
    const hasCountry = countryCode && countryCode.trim().length > 0;
    const hasSubcountry = subcountry && subcountry.trim().length > 0;
    const hasLanguage = hasLanguageCodeColumn && languageCode && languageCode.trim().length > 0;
    if (!hasName && !hasCountry) return null;

    const clauses = [];
    const params = {};
    if (hasName) {
      clauses.push('Name LIKE $name');
      params['$name'] = `%${name.trim()}%`;
    }
    if (hasCountry) {
      clauses.push('CountryCode = $country');
      params['$country'] = countryCode.trim();
    }
    if (hasSubcountry) {
      clauses.push('Subcountry = $subcountry');
      // Deliberately NOT trimmed, unlike `name` above: this value comes
      // verbatim from an existing Subcountry cell (via the region dropdown,
      // populated from listSubcountriesForSearch()'s raw, untrimmed rows),
      // not typed by the user. This is uncurated radio-browser data, and
      // some Subcountry values carry stray leading/trailing whitespace —
      // trimming here would silently stop matching the very row this exact
      // string came from, without any error, just an empty result set.
      params['$subcountry'] = subcountry;
    }
    if (hasLanguage) {
      // LanguageCode can hold multiple comma-separated codes for a
      // multi-language station (e.g. "ar,fr") — a plain `=` would only
      // ever match a single-language station. Wrapping both sides in
      // commas and using LIKE turns this into a proper "is this code one
      // of the tokens" check, matching regardless of position, with exact
      // token boundaries so "en" can't accidentally match inside "sven".
      clauses.push("(',' || LanguageCode || ',') LIKE $language");
      params['$language'] = `%,${languageCode.trim()},%`;
    }
    return { clauses, params };
  }

  // Mirrors iOS's searchStations(byName:countryCode:): name is a substring
  // match, country is an exact match, both optional but at least one
  // required. `subcountry` narrows further within an already-selected
  // country — it's an exact match against the same free-text field used to
  // build the "state" part of a result's description; the underlying data
  // has no separate city column (see listSubcountriesForSearch below).
  // `languageCode` narrows by normalized ISO language code (see
  // listLanguagesForSearch below); ignored entirely if the deployed DB
  // predates the LanguageCode column (see hasLanguageCodeColumn).
  // `offset` pages through matches beyond SEARCH_RESULT_LIMIT — see count().
  function search(name, countryCode, subcountry, languageCode, offset) {
    if (!db) return [];
    const where = buildWhereClause(name, countryCode, subcountry, languageCode);
    if (!where) return [];
    const safeOffset = Math.max(0, offset || 0);

    const sql = `
      SELECT Name, Url, Homepage, Favicon, Language, Tags, Subcountry, CountryCode${hasHlsColumn ? ', Hls' : ''}
      FROM Station
      WHERE ${where.clauses.join(' AND ')}
      LIMIT ${CONFIG.SEARCH_RESULT_LIMIT} OFFSET ${safeOffset}
    `;

    const stmt = db.prepare(sql);
    stmt.bind(where.params);
    const results = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      const state = (row.Subcountry || '').trim().toLowerCase();
      const lang = row.Language || '';
      const country = row.CountryCode || '';
      results.push({
        name: row.Name || '',
        url: row.Url || '',
        image: row.Favicon || '',
        tags: row.Tags || '',
        description: [lang, state].filter(Boolean).join(' - ') + (country ? `, ${country}` : ''),
        homepage: row.Homepage || '',
        countrycode: country,
        // Only ever present (and only ever true) once the deployed DB has
        // actually been regenerated with this column — see hasHlsColumn.
        hls: hasHlsColumn ? !!row.Hls : false
      });
    }
    stmt.free();
    return results;
  }

  // Total matches for a query, ignoring SEARCH_RESULT_LIMIT entirely — what
  // renderSearch() uses to show "X–Y of Z" and to know how many pages exist,
  // since search() itself only ever returns one page at a time.
  function count(name, countryCode, subcountry, languageCode) {
    if (!db) return 0;
    const where = buildWhereClause(name, countryCode, subcountry, languageCode);
    if (!where) return 0;
    const sql = `SELECT COUNT(*) AS total FROM Station WHERE ${where.clauses.join(' AND ')}`;
    const stmt = db.prepare(sql);
    stmt.bind(where.params);
    stmt.step();
    const row = stmt.getAsObject();
    stmt.free();
    return row.total || 0;
  }

  // Distinct, non-empty Subcountry values among ALL matches for a given
  // name/country query — deliberately not capped by SEARCH_RESULT_LIMIT
  // like search() is, since the point is to offer a complete narrowing
  // list even when the underlying match count is much larger than what's
  // actually rendered. A DISTINCT list is typically far smaller than the
  // full row count, so this stays cheap even for a broad query.
  function listSubcountriesForSearch(name, countryCode) {
    if (!db) return [];
    const hasName = name && name.trim().length > 0;
    const hasCountry = countryCode && countryCode.trim().length > 0;
    if (!hasName && !hasCountry) return [];

    const clauses = ["Subcountry IS NOT NULL", "Subcountry != ''"];
    const params = {};
    if (hasName) {
      clauses.push('Name LIKE $name');
      params['$name'] = `%${name.trim()}%`;
    }
    if (hasCountry) {
      clauses.push('CountryCode = $country');
      params['$country'] = countryCode.trim();
    }

    const sql = `
      SELECT DISTINCT Subcountry FROM Station
      WHERE ${clauses.join(' AND ')}
      ORDER BY Subcountry ASC
    `;
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const out = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      if (row.Subcountry) out.push(row.Subcountry);
    }
    stmt.free();
    return out;
  }

  // Distinct, individual language codes among ALL matches for a given
  // name/country/subcountry query. LanguageCode can hold multiple
  // comma-separated codes per row (e.g. "ar,fr"), so a plain DISTINCT
  // would list whole combos rather than individual languages — instead,
  // this pulls the (still small) set of distinct raw combo strings via
  // SQL, then splits/dedupes them in JS. That two-step keeps the actual
  // per-row scan in SQL (cheap even at 57k+ rows) while still ending up
  // with real single-code options for the dropdown.
  function listLanguagesForSearch(name, countryCode, subcountry) {
    if (!db || !hasLanguageCodeColumn) return [];
    const hasName = name && name.trim().length > 0;
    const hasCountry = countryCode && countryCode.trim().length > 0;
    const hasSubcountry = subcountry && subcountry.trim().length > 0;
    if (!hasName && !hasCountry) return [];

    const clauses = ["LanguageCode IS NOT NULL", "LanguageCode != ''"];
    const params = {};
    if (hasName) {
      clauses.push('Name LIKE $name');
      params['$name'] = `%${name.trim()}%`;
    }
    if (hasCountry) {
      clauses.push('CountryCode = $country');
      params['$country'] = countryCode.trim();
    }
    if (hasSubcountry) {
      clauses.push('Subcountry = $subcountry');
      params['$subcountry'] = subcountry;
    }

    const sql = `SELECT DISTINCT LanguageCode FROM Station WHERE ${clauses.join(' AND ')}`;
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const codes = new Set();
    while (stmt.step()) {
      const row = stmt.getAsObject();
      (row.LanguageCode || '')
        .split(',')
        .map(c => c.trim())
        .filter(Boolean)
        .forEach(c => codes.add(c));
    }
    stmt.free();
    return Array.from(codes).sort((a, b) => a.localeCompare(b));
  }

  // Distinct country codes for the country filter dropdown.
  function listCountries() {
    if (!db) return [];
    const res = db.exec(`
      SELECT DISTINCT CountryCode FROM Station
      WHERE CountryCode IS NOT NULL AND CountryCode != ''
      ORDER BY CountryCode ASC
    `);
    if (!res.length) return [];
    return res[0].values.map(row => row[0]);
  }

  return { load, search, count, listCountries, listSubcountriesForSearch, listLanguagesForSearch, getStationCount };
})();
