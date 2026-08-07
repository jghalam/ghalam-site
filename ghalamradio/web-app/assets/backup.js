// GhalamRadio Web — backup / import / share
//
// Format is intentionally identical to the iOS app (ContentView.swift +
// StationSharing.swift):
//   - CSV rows delimited by "^%^", header:
//       name^%^url^%^image^%^tags^%^description^%^homepage^%^countrycode
//   - .gcsvx files are plain UTF-8 text of that CSV
//   - Share links: base64url(csv) in ?d= on {SHARE_BASE_URL}
// A backup file or share link made on either platform can be opened by the
// other with no conversion.

const Backup = (() => {

  // -- base64url (matches Data.base64URLEncodedString / base64URLEncoded) --

  function base64UrlEncode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  function base64UrlDecode(b64url) {
    let s = b64url.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4 !== 0) s += '=';
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  // -- CSV generate / parse (matches generateCSV / parseCSV / makeStation) --

  function generateCSV(stations) {
    const d = CONFIG.CSV_DELIMITER;
    let csv = CONFIG.CSV_HEADER + '\n';
    for (const s of stations) {
      csv += [s.name, s.url, s.image, s.tags, s.description, s.homepage, s.countrycode]
        .map(v => v ?? '')
        .join(d) + '\n';
    }
    return csv;
  }

  function extractTwoLetterCode(text) {
    const parts = (text || '').split(',');
    const last = (parts[parts.length - 1] || '').trim();
    return /^[A-Za-z]{2}$/.test(last) ? last : '';
  }

  function parseCSV(content) {
    const rows = content.split('\n').slice(1); // skip header
    const stations = [];
    for (const row of rows) {
      if (!row.trim()) continue;
      const cols = row.split(CONFIG.CSV_DELIMITER);
      if (cols.length !== 6 && cols.length !== 7) continue;
      const trim = v => (v ?? '').trim();
      const description = trim(cols[4]);
      const countrycode = cols.length >= 7 ? trim(cols[6]) : extractTwoLetterCode(description);
      stations.push({
        name: trim(cols[0]),
        url: trim(cols[1]),
        image: trim(cols[2]),
        tags: trim(cols[3]),
        description,
        homepage: trim(cols[5]),
        countrycode
      });
    }
    return stations;
  }

  // -- File export / import (.gcsvx) --

  function downloadAsFile(stations) {
    const csv = generateCSV(stations);
    const blob = new Blob([csv], { type: CONFIG.GCSVX_MIME });
    const url = URL.createObjectURL(blob);

    let fileName;
    if (stations.length === 1) {
      fileName = `${stations[0].name || 'station'}.gcsvx`;
    } else {
      const d = new Date();
      fileName = `ghalamradio_${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}.gcsvx`;
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function parseFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(parseCSV(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file, 'utf-8');
    });
  }

  // -- Share link generate / parse --

  // Returns { type: 'link', url } or { type: 'file' } when the payload is
  // too large for a reliable link (mirrors exportAndShareCSV's size guard).
  function buildShareLink(stations) {
    const csv = generateCSV(stations);
    const payload = base64UrlEncode(csv);
    const url = `${CONFIG.SHARE_BASE_URL}?d=${payload}`;
    if (url.length <= CONFIG.MAX_SHARE_LINK_LENGTH) {
      return { type: 'link', url };
    }
    return { type: 'file' };
  }

  function parseShareUrl(url) {
    try {
      const u = new URL(url);
      const d = u.searchParams.get('d');
      if (!d) return [];
      const csv = base64UrlDecode(d);
      return parseCSV(csv);
    } catch {
      return [];
    }
  }

  // -- Dedup review (mirrors presentImport: split into fresh vs conflicts) --

  function diffAgainstExisting(incoming, existing) {
    const key = s => (s.url || '').trim().toLowerCase();
    const existingByUrl = new Map(existing.map(s => [key(s), s]));
    const fresh = [];
    const conflicts = [];
    for (const s of incoming) {
      const match = existingByUrl.get(key(s));
      if (match) {
        conflicts.push({ incoming: s, existing: match });
      } else {
        fresh.push(s);
      }
    }
    return { fresh, conflicts };
  }

  return {
    generateCSV, parseCSV,
    downloadAsFile, parseFile,
    buildShareLink, parseShareUrl,
    diffAgainstExisting,
    base64UrlEncode, base64UrlDecode
  };
})();
