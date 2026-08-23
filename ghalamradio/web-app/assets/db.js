// GhalamRadio Web — station database (sql.js + pako)
//
// Loads the gzip-compressed, read-only station DB shipped alongside the app
// (built by conv.py from the radio-browser.info dump) and exposes search.
// Schema matches the iOS app's `stations.swift`, plus one addition:
//   Station(StationID, Name, Url, Homepage, Favicon, Language, Tags,
//           Subcountry, CountryCode, GeoLat, GeoLong, Hls)
// `Hls` is web-only — an explicit flag from radio-browser for whether a
// stream is HLS, appended at the end of the schema so it doesn't disturb
// the columns/positions the iOS app already reads.

const StationDB = (() => {
  let db = null;
  let loadPromise = null;
  // Detected once per DB load — the deployed stations.db.gz might not have
  // been regenerated with the new Hls column yet even after this code is
  // live, so this can't be assumed; without it, Hls is just left out of
  // results entirely and stream-type detection falls back to what it did
  // before (guessing from the URL), rather than the SELECT below throwing.
  let hasHlsColumn = false;

  function detectHlsColumn(database) {
    try {
      const res = database.exec('PRAGMA table_info(Station)');
      if (!res.length) return false;
      const nameColIdx = res[0].columns.indexOf('name');
      return res[0].values.some(row => row[nameColIdx] === 'Hls');
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
      hasHlsColumn = detectHlsColumn(db);

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

  // Mirrors iOS's searchStations(byName:countryCode:): name is a substring
  // match, country is an exact match, both optional but at least one
  // required. `subcountry` narrows further within an already-selected
  // country — it's an exact match against the same free-text field used to
  // build the "state" part of a result's description; the underlying data
  // has no separate city column (see listSubcountriesForSearch below).
  function search(name, countryCode, subcountry) {
    if (!db) return [];
    const hasName = name && name.trim().length > 0;
    const hasCountry = countryCode && countryCode.trim().length > 0;
    const hasSubcountry = subcountry && subcountry.trim().length > 0;
    if (!hasName && !hasCountry) return [];

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
      params['$subcountry'] = subcountry.trim();
    }

    const sql = `
      SELECT Name, Url, Homepage, Favicon, Language, Tags, Subcountry, CountryCode${hasHlsColumn ? ', Hls' : ''}
      FROM Station
      WHERE ${clauses.join(' AND ')}
      LIMIT ${CONFIG.SEARCH_RESULT_LIMIT}
    `;

    const stmt = db.prepare(sql);
    stmt.bind(params);
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

  return { load, search, listCountries, listSubcountriesForSearch, getStationCount };
})();
