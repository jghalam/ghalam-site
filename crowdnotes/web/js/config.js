// CrowdNotes — Configuration & constants
// ── Config ──────────────────────────────────────────────
const VERSION     = 'v1.1.56';
console.log('CrowdNotes Web', VERSION);

// Optional: a hosted endpoint that serves the meeting as `text/calendar`
// (inline). When set, the iOS "Add to Apple Calendar" button navigates here
// so Safari shows the native "Add All" prompt — the only clean way to import
// on iOS. Leave null to fall back to the Web Share sheet for the .ics file.
// Expected to accept ?title=&start=&end=&uid=&notes= (UTC times, YYYYMMDDTHHMMSSZ).
const HOSTED_EVENT_URL = null; // e.g. 'https://ghalam.net/.netlify/functions/event'
// Show version in UI
document.addEventListener('DOMContentLoaded', () => {
  const vEl = document.getElementById('signin-version');
  const evEl = document.getElementById('events-version');
  if (vEl)  vEl.textContent  = VERSION;
  if (evEl) evEl.textContent = VERSION;
});
const CONTAINER   = 'iCloud.com.joe.ghalam.db.CrowdNotes';
const API_TOKEN   = '22ec7d5793989a260042f6ef0a55b4e40eaf297dbe7c250b2e52eaa331af781e';
const ENV         = 'production';
//const API_TOKEN   = '334bed51ea26c4a9bade8cf8991010ae0e59ebb74dc4e7bab038c92f2fcb490b';
//const ENV         = 'development';

