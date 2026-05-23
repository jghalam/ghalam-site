// CrowdNotes — Global state variables
// ── State ────────────────────────────────────────────────
let ck, db, sharedDB;
let allEvents     = [];
let activeEvent   = null;
let allAttendees  = [];
// No cache — zone activity is fetched before first render to avoid flash.

async function fetchZoneLastActivity(event) {
  // Paginates through all pages of changes/zone with desiredKeys:[] (no field payload)
  // and returns the maximum modified timestamp across all records.
  // CloudKit returns ~100 records per page -- must follow moreComing/syncToken.
  try {
    const dbName = event.dbName || (event.isOrganizer ? 'private' : 'shared');
    const ckP = new URLSearchParams({
      ckjsBuildVersion: '2420ProjectDev22', ckjsVersion: '2.6.4',
      ckAPIToken: API_TOKEN, ckWebAuthToken
    }).toString();
    const zoneID = { zoneName: event.zoneName, ownerRecordName: event.organizerID || event.ownerName };
    let latest = 0;
    let syncToken = null;
    let moreComing = true;
    while (moreComing) {
      const body = { zones: [{ zoneID, desiredKeys: [] }] };
      if (syncToken) body.zones[0].syncToken = syncToken;
      const resp = await fetch(
        `https://api.apple-cloudkit.com/database/1/${CONTAINER}/${ENV}/${dbName}/changes/zone?${ckP}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body) }
      );
      const data = await resp.json();
      const zone = (data.zones || [])[0];
      if (!zone || zone.serverErrorCode) break;
      for (const record of (zone.records || [])) {
        const ts = record.modified?.timestamp || 0;
        if (ts > latest) latest = ts;
      }
      moreComing = zone.moreComing || false;
      syncToken  = zone.syncToken  || null;
      if (!syncToken) break;
    }
    return latest || null;
  } catch(e) {
    console.log('fetchZoneLastActivity error:', event.zoneName, e.message);
    return null;
  }
}
let currentAttendee = null;
let recruiterName = localStorage.getItem('recruiterName') || '';
let currentUserRecordName = ''; // iCloud record name — used for thumbs matching
let scanStream    = null;
let scanInterval  = null;
let ckWebAuthToken = '';

// Attendee cache — populated by loadAttendees, consumed by selectEvent.
// Avoids re-fetching all attendees when the user taps the same event again.
const ATTENDEE_CACHE_MS   = 120_000; // 2 minutes
let _attendeesCachedZone  = null;
let _attendeesCachedAt    = 0;

const _origXHROpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method, url, ...rest) {
  if (typeof url === 'string' && url.includes('api.apple-cloudkit.com')) {
    try {
      const tok = new URL(url).searchParams.get('ckWebAuthToken');
      if (tok) ckWebAuthToken = tok;
    } catch(e) {}
  }
  return _origXHROpen.apply(this, [method, url, ...rest]);
};

// Also intercept fetch — CloudKit JS may use fetch for some requests
const _origFetch = window.fetch;
window.fetch = function(input, init) {
  try {
    const url = typeof input === 'string' ? input : (input?.url || '');
    if (url.includes('api.apple-cloudkit.com')) {
      const tok = new URL(url).searchParams.get('ckWebAuthToken');
      if (tok) ckWebAuthToken = tok;
    }
  } catch(e) {}
  const result = _origFetch.apply(this, arguments);
  // Detect 421 Misdirected Request — Chrome HTTP/2 connection reuse bug with Apple CDN
  result.then(resp => {
    if (resp.status === 421) {
      const errEl = document.getElementById('signin-error');
      if (errEl && document.getElementById('screen-signin').classList.contains('active')) {
        errEl.innerHTML = `⚠️ Connection error (421). In Chrome, open a new tab and go to <strong>chrome://net-internals/#sockets</strong> → click <strong>"Flush socket pools"</strong>, then reload this page.`;
        errEl.style.color = '#f97316';
      }
    }
  }).catch(() => {});
  return result;
};

