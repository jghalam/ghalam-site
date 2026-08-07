// GhalamRadio Web — station database (sql.js + pako)
//
// Loads the gzip-compressed, read-only station DB shipped alongside the app
// (built by conv.py from the radio-browser.info dump) and exposes search.
// Schema matches the iOS app's `stations.swift` exactly:
//   Station(StationID, Name, Url, Homepage, Favicon, Language, Tags,
//           Subcountry, CountryCode, GeoLat, GeoLong)

const StationDB = (() => {
  let db = null;
  let loadPromise = null;

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
  // match, country is an exact match, both optional but at least one required.
  function search(name, countryCode) {
    if (!db) return [];
    const hasName = name && name.trim().length > 0;
    const hasCountry = countryCode && countryCode.trim().length > 0;
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

    const sql = `
      SELECT Name, Url, Homepage, Favicon, Language, Tags, Subcountry, CountryCode
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
        countrycode: country
      });
    }
    stmt.free();
    return results;
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

  return { load, search, listCountries, getStationCount };
})();
