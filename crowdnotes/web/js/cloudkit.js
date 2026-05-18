// CrowdNotes — CloudKit initialisation, auth, profile, and zone helpers
// ── CloudKit Init ─────────────────────────────────────────
// CloudKit JS must be fully loaded before we call CloudKit.configure().
// On slower connections or Windows Chrome it may not be ready synchronously.
let container;

function initCloudKit() {
  if (typeof CloudKit === 'undefined') {
    // CloudKit JS not ready yet — this call was too early, ignore silently.
    // The onload callback will call us again once the script finishes.
    console.log('initCloudKit: CloudKit not ready yet, waiting for onload...');
    return;
  }
  document.getElementById('signin-error').textContent = '';

  CloudKit.configure({
    containers: [{
      containerIdentifier: CONTAINER,
      apiTokenAuth: { apiToken: API_TOKEN, persist: true, signInButton: { id: 'ck-signin' }, signOutButton: { id: 'ck-signout' } },
      environment: ENV
    }]
  });
  container = CloudKit.getDefaultContainer();
  container.setUpAuth().then(userInfo => {
    if (userInfo) onSignedIn(userInfo);
    else {
      showSignInButton();
      watchForSignInPopup();
    }
  }).catch(err => {
    console.error('Auth setup error:', err);
    showSignInButton();
    watchForSignInPopup();
  });
}

// If cloudkit.js already loaded (cached), run now; otherwise wait for onload callback
if (typeof CloudKit !== 'undefined') {
  initCloudKit();
} else {
  window._ckReadyCb = initCloudKit;
  // Last resort — if onload never fires after 10s, show a helpful error
  setTimeout(() => {
    if (!container) {
      const err = document.getElementById('signin-error');
      if (err) err.textContent = 'Could not connect to Apple CloudKit. Please check your connection and reload.';
    }
  }, 10000);
}

// Clean up cache-bust param from URL without triggering a reload
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('t')) {
  history.replaceState(null, '', window.location.pathname);
}

// ── iOS Install Banner ────────────────────────────────────
// Always update app-argument to include the current URL (preserving ?share= param)
// so Safari's Smart App Banner passes the right link through to the installed app.
(function() {
  const itunesMeta = document.querySelector('meta[name="apple-itunes-app"]');
  if (itunesMeta) {
    itunesMeta.setAttribute('content', 'app-id=6760520709, app-argument=' + location.href);
  }

  // Show the custom banner for all iOS users.
  // Safari's native Smart App Banner (via the meta tag above) is unreliable —
  // once a user dismisses it, Safari never shows it again even after the app is deleted.
  // The custom banner gives us consistent coverage across Safari, Chrome, and Firefox on iOS.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (isIOS && !sessionStorage.getItem('installBannerDismissed')) {
    document.getElementById('ios-install-banner').style.display = 'flex';
  }
})();

function dismissInstallBanner() {
  sessionStorage.setItem('installBannerDismissed', '1');
  document.getElementById('ios-install-banner').style.display = 'none';
}

function showSignInButton() {
  showScreen('signin');
  armSignInFallback();
}

// (auth setup moved into initCloudKit)

function watchForSignInPopup() {
  // Intercept window.open so we can track the popup reference
  const _originalOpen = window.open.bind(window);
  window.open = function(...args) {
    const popup = _originalOpen(...args);
    if (popup) {
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          window.open = _originalOpen; // restore original
          // Re-check auth — if sign-in succeeded, setUpAuth resolves with userInfo
          container.setUpAuth().then(userInfo => {
            if (userInfo) onSignedIn(userInfo);
          }).catch(() => {});
        }
      }, 500);
    }
    return popup;
  };
}

// Show fallback button if CloudKit JS hasn't injected its button after 2.5s.
// This happens on some non-Safari browsers (e.g. Windows Chrome) where the
// CloudKit JS sign-in button injection is slow or silently fails.
function armSignInFallback() { /* CloudKit JS manages the button */ }



// ── Auth ──────────────────────────────────────────────────
async function signOut() {
  allEvents = []; allAttendees = []; activeEvent = null;
  ckWebAuthToken = ''; currentUserRecordName = '';
  recruiterName = '';
  localStorage.clear();

  // Use CloudKit JS container.signOut() — this invalidates the server-side
  // ckSession cookie (HttpOnly, unreachable by JS) and returns a promise.
  // We wait for it before reloading so the session is truly dead.
  try {
    if (container) await container.signOut();
  } catch(e) {
    console.warn('container.signOut() error (ignored):', e);
  }

  // Hard reload to a cache-busted URL — forces the browser to re-fetch the
  // page and re-run CloudKit.configure(), which will now find no session.
  window.location.replace(window.location.pathname + '?t=' + Date.now());
}

async function onSignedIn(userInfo) {
  db       = container.privateCloudDatabase;
  sharedDB = container.sharedCloudDatabase;
  currentUserRecordName = userInfo?.userRecordName || userInfo?.recordName || '';
  console.log('Signed in as:', currentUserRecordName, 'recruiterName:', recruiterName);

  if (!recruiterName) {
    // Try CloudKit UserProfile first — written by iOS app or a previous web session.
    // Always check on sign-in so sign-out/sign-in restores name without prompting.
    recruiterName = await fetchUserProfileName();
    if (recruiterName) {
      console.log('Got name from CloudKit UserProfile:', recruiterName);
      localStorage.setItem('recruiterName', recruiterName);
    } else {
      const entered = prompt('What is your name? (used for notes and votes)');
      recruiterName = (entered || '').trim() || 'web-user';
      localStorage.setItem('recruiterName', recruiterName);
      // Save to CloudKit so it survives sign-out and browser data clears
      await saveUserProfileName(recruiterName);
    }
  }

  // Merge left zones from CloudKit so events left on iOS or a previous web session
  // don't reappear after sign-out or browser data clear.
  const cloudLeftZones = await fetchCloudLeftZones();
  if (cloudLeftZones.length > 0) {
    const localLeft = JSON.parse(localStorage.getItem('leftZoneNames') || '[]');
    const merged = [...new Set([...localLeft, ...cloudLeftZones])];
    localStorage.setItem('leftZoneNames', JSON.stringify(merged));
    console.log('Merged left zones from CloudKit:', cloudLeftZones);
  }

  // Clear any malformed saved zones from previous attempts
  const saved = JSON.parse(localStorage.getItem('sharedZones') || '[]');
  const valid = saved.filter(z => z.zoneName && z.ownerName);
  if (valid.length !== saved.length) localStorage.setItem('sharedZones', JSON.stringify(valid));
  // Update signed-in user display — same name used for notes, votes, and MemberStatus
  const nameEl = document.getElementById('signed-in-name');
  const userEl = document.getElementById('signed-in-user');
  if (nameEl && userEl && recruiterName) {
    nameEl.textContent = recruiterName;
    userEl.style.display = 'flex';
  }
  showScreen('events');
  loadEvents().then(async () => {
    // Refresh MemberStatus for every zone we're already a member of so the
    // organizer always sees our current display name — ckWebAuthToken is
    // guaranteed to be populated by this point since loadEvents() used CloudKit JS.
    const existingShares = JSON.parse(localStorage.getItem('sharedZones') || '[]');
    for (const zone of existingShares) {
      if (zone.zoneName && zone.ownerName) {
        await writeMemberStatus(zone.zoneName, zone.ownerName);
      }
    }
    // Auto-join from Universal Link: ?share=<cloudkit-url>
    const urlParams = new URLSearchParams(window.location.search);
    const shareParam = urlParams.get('share');
    if (shareParam && shareParam.includes('icloud.com/share/')) {
      history.replaceState(null, '', window.location.pathname);
      autoJoinShare(shareParam);
    }
  });
}

// ── UserProfile CloudKit helpers ──────────────────────────
// These use the REST API directly (same pattern as saveNote/vote)
// because CloudKit JS db.fetchRecords() has a different call signature.

async function fetchUserProfile() {
  if (!ckWebAuthToken) return null;
  try {
    const ckParams = new URLSearchParams({
      ckjsBuildVersion: '2420ProjectDev22', ckjsVersion: '2.6.4',
      ckAPIToken: API_TOKEN, ckWebAuthToken
    }).toString();
    const resp = await fetch(
      `https://api.apple-cloudkit.com/database/1/${CONTAINER}/${ENV}/private/records/lookup?${ckParams}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: [{ recordName: 'singleton-user-profile' }] }) }
    );
    const data = await resp.json();
    const record = (data.records || [])[0];
    if (record && !record.serverErrorCode) return record;
  } catch(e) {
    console.log('fetchUserProfile error:', e.message);
  }
  return null;
}

async function saveUserProfile(fields) {
  if (!ckWebAuthToken) return;
  try {
    // Fetch existing to get changeTag for upsert
    let changeTag = null;
    const existing = await fetchUserProfile();
    if (existing) changeTag = existing.recordChangeTag;

    const ckParams = new URLSearchParams({
      ckjsBuildVersion: '2420ProjectDev22', ckjsVersion: '2.6.4',
      ckAPIToken: API_TOKEN, ckWebAuthToken
    }).toString();
    const record = { recordName: 'singleton-user-profile', recordType: 'UserProfile', fields };
    if (changeTag) record.recordChangeTag = changeTag;
    const resp = await fetch(
      `https://api.apple-cloudkit.com/database/1/${CONTAINER}/${ENV}/private/records/modify?${ckParams}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations: [{ operationType: changeTag ? 'update' : 'create', record }] }) }
    );
    const data = await resp.json();
    const saved = (data.records || [])[0];
    if (saved && saved.serverErrorCode) throw new Error(saved.reason || saved.serverErrorCode);
    console.log('✅ saveUserProfile: saved fields', Object.keys(fields));
  } catch(e) {
    console.log('⚠️ saveUserProfile failed:', e.message);
  }
}

async function fetchUserProfileName() {
  const record = await fetchUserProfile();
  if (!record) return null;
  const name = record.fields?.displayName?.value;
  return (name && name.trim()) ? name.trim() : null;
}

async function saveUserProfileName(name) {
  if (!name) return;
  await saveUserProfile({ displayName: { value: name } });
}

async function fetchCloudLeftZones() {
  const record = await fetchUserProfile();
  if (!record) return [];
  return record.fields?.leftZoneNames?.value || [];
}

async function addCloudLeftZone(zoneName) {
  const record = await fetchUserProfile();
  const existing = record?.fields?.leftZoneNames?.value || [];
  if (existing.includes(zoneName)) return;
  existing.push(zoneName);
  await saveUserProfile({ leftZoneNames: { value: existing } });
  console.log('✅ addCloudLeftZone: saved', zoneName);
}

async function autoJoinShare(ckShareURL) {
  // Don't re-join if we already have this zone saved
  const savedShares = JSON.parse(localStorage.getItem('sharedZones') || '[]');
  if (savedShares.find(z => z.shareURL === ckShareURL)) {
    showToast('Already a member of this event.');
    return;
  }
  // Feed the CloudKit URL into the existing join flow via the hidden input
  const inputEl = document.getElementById('share-link-input');
  if (inputEl) {
    inputEl.value = ckShareURL;
    await joinWithLink();
  }
}

async function changeRecruiterName() {
  const entered = prompt('Change your display name:', recruiterName);
  if (entered === null) return; // cancelled
  const name = entered.trim() || recruiterName;
  if (name === recruiterName) return;
  recruiterName = name;
  localStorage.setItem('recruiterName', recruiterName);
  await saveUserProfileName(recruiterName);
  const nameEl = document.getElementById('signed-in-name');
  if (nameEl) nameEl.textContent = recruiterName;
  showToast('Name updated to ' + recruiterName);
}


function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navMap = { events: 0, scan: 1 };
  if (navMap[name] !== undefined) {
    document.querySelectorAll('.nav-item')[navMap[name]]?.classList.add('active');
  }
}

// ── Join with Share Link ──────────────────────────────────
// ── Write MemberStatus to shared zone ────────────────────
// Called after successfully joining a share so the organizer's
// iOS app can display the web member's name in Manage Share.
async function writeMemberStatus(zoneName, ownerName) {
  // Use the exact name shown on screen in "Signed in as" — same source of truth
  const displayName = document.getElementById('signed-in-name')?.textContent?.trim() || recruiterName;
  console.log('writeMemberStatus called — zone:', zoneName, 'owner:', ownerName,
    'displayName:', displayName, 'userID:', currentUserRecordName,
    'token:', ckWebAuthToken ? ckWebAuthToken.slice(0, 12) + '…' : '(empty)');
  if (!displayName || !currentUserRecordName) {
    console.warn('⚠️ writeMemberStatus: missing displayName or userID — skipping');
    return;
  }
  if (!ckWebAuthToken) {
    console.warn('⚠️ writeMemberStatus: ckWebAuthToken not yet captured — skipping');
    return;
  }
  try {
    const ckParams = new URLSearchParams({
      ckjsBuildVersion: '2420ProjectDev22', ckjsVersion: '2.6.4',
      ckAPIToken: API_TOKEN, ckWebAuthToken
    }).toString();
    const recordName = 'memberstatus-' + currentUserRecordName;
    const resp = await fetch(
      `https://api.apple-cloudkit.com/database/1/${CONTAINER}/${ENV}/shared/records/modify?${ckParams}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zoneID: { zoneName, ownerRecordName: ownerName },
          operations: [{ operationType: 'forceReplace', record: {
            recordName,
            recordType: 'MemberStatus',
            fields: {
              userID:      { value: currentUserRecordName },
              status:      { value: 'active' },
              displayName: { value: displayName }
            }
          }}]
        })
      }
    );
    const data = await resp.json();
    console.log('writeMemberStatus response:', JSON.stringify(data).slice(0, 300));
    // Check top-level error (e.g. ZONE_NOT_FOUND) — zone not accepted via CloudKit yet
    if (data.serverErrorCode) throw new Error(data.reason || data.serverErrorCode);
    const saved = (data.records || [])[0];
    if (saved && saved.serverErrorCode) throw new Error(saved.reason || saved.serverErrorCode);
    console.log('✅ writeMemberStatus: saved', displayName, 'for zone', zoneName);
  } catch(e) {
    // ZONE_NOT_FOUND means the share hasn't been accepted via CloudKit yet — safe to skip
    if (e.message.includes('ZONE_NOT_FOUND') || e.message.includes('Zone does not exist')) {
      console.log('⚠️ writeMemberStatus: zone not accessible yet, skipping —', zoneName);
    } else {
      console.error('❌ writeMemberStatus failed:', e.message);
    }
  }
}

async function joinWithLink() {
  let input = document.getElementById('share-link-input').value.trim();
  const errEl = document.getElementById('join-error');
  errEl.style.display = 'none';

  // If the user pasted the full ghalam.net share link, extract the CloudKit URL from ?share=
  try {
    const parsed = new URL(input);
    const shareParam = parsed.searchParams.get('share');
    if (shareParam) input = decodeURIComponent(shareParam);
  } catch(e) {}

  if (!input.includes('icloud.com/share/')) {
    errEl.textContent = 'Please paste a valid CrowdNotes share link.';
    errEl.style.display = 'block';
    return;
  }

  showToast('Connecting to event…');

  // Extract event name from URL fragment
  const fragment  = input.split('#')[1] || '';
  const eventName = decodeURIComponent(fragment.replace(/-/g, ' ')) || 'Shared Event';

  // Try CloudKit JS share metadata APIs in order
  let zoneName = null, ownerName = null;

  // Attempt 1: CloudKit.fetchShareMetadata (global)
  if (typeof CloudKit.fetchShareMetadata === 'function') {
    try {
      const resp = await CloudKit.fetchShareMetadata({ shareURL: input });
      const meta = (resp.results || [resp])[0] || resp;
      zoneName  = meta?.rootRecord?.recordID?.zoneID?.zoneName
               || meta?.zoneID?.zoneName;
      ownerName = meta?.rootRecord?.recordID?.zoneID?.ownerName
               || meta?.ownerIdentity?.userRecordName
               || meta?.zoneID?.ownerName;
      console.log('fetchShareMetadata result:', JSON.stringify(meta).slice(0, 300));
    } catch(e) { console.log('CloudKit.fetchShareMetadata failed:', e.message); }
  }

  // Attempt 2: container.acceptShares — needs just the share token, not full URL
  if (!zoneName && typeof container.acceptShares === 'function') {
    try {
      const shareToken = input.split('/share/')[1]?.split('#')[0]?.split('?')[0];
      console.log('trying acceptShares with token:', shareToken);
      const resp = await container.acceptShares([{ value: shareToken }]);
      console.log('acceptShares raw result:', JSON.stringify(resp).slice(0, 500));
      const result = (resp.results || [])[0];
      zoneName  = result?.zoneID?.zoneName;
      ownerName = result?.zoneID?.ownerRecordName || result?.ownerIdentity?.userRecordName;
      // databaseScope tells us which DB to use (PRIVATE or SHARED)
      const dbScope = result?.databaseScope || 'SHARED';
      console.log('zone:', zoneName, 'owner:', ownerName, 'dbScope:', dbScope);
      // Store db scope for later querying
      if (zoneName) {
        const savedShares = JSON.parse(localStorage.getItem('sharedZones') || '[]');
        const existing = savedShares.find(z => z.zoneName === zoneName);
        if (existing) existing.dbScope = dbScope;
        else savedShares.push({ zoneName, ownerName, shareURL: input, eventName, dbScope });
        localStorage.setItem('sharedZones', JSON.stringify(savedShares));
      }
    } catch(e) { console.log('acceptShares failed:', e.message, e); }
  }

  // Attempt 3: Use share token to query sharedDB for all zones
  // Since publicPermission=readWrite, any signed-in user can query using zone token
  if (!zoneName) {
    try {
      const shareToken = input.split('/share/')[1]?.split('#')[0];
      // Query sharedDB for zones matching the share token via lookup
      const resp = await sharedDB.performQuery({
        recordType: 'cloudkit.share',
        filterBy: [],
        sortBy: []
      });
      if (resp.records && resp.records.length > 0) {
        const shareRecord = resp.records[0];
        zoneName  = shareRecord.recordID?.zoneID?.zoneName;
        ownerName = shareRecord.recordID?.zoneID?.ownerName;
        console.log('sharedDB query result:', zoneName, ownerName);
      }
    } catch(e) { console.log('sharedDB query failed:', e.message); }
  }

  if (zoneName) {
    // Save zone info to localStorage
    const savedShares = JSON.parse(localStorage.getItem('sharedZones') || '[]');
    if (!savedShares.find(z => z.zoneName === zoneName)) {
      savedShares.push({ zoneName, ownerName, shareURL: input, eventName });
      localStorage.setItem('sharedZones', JSON.stringify(savedShares));
    }
    // Write MemberStatus with displayName so the iOS organizer sees this member's name
    await writeMemberStatus(zoneName, ownerName);
    document.getElementById('share-link-input').value = '';
    showToast('Event joined!');
    await loadEvents();
  } else {
    // Last resort: save URL and event name, show instructions
    const savedShares = JSON.parse(localStorage.getItem('sharedZones') || '[]');
    if (!savedShares.find(z => z.shareURL === input)) {
      savedShares.push({ zoneName: null, ownerName: null, shareURL: input, eventName });
      localStorage.setItem('sharedZones', JSON.stringify(savedShares));
    }
    document.getElementById('share-link-input').value = '';
    errEl.innerHTML = `⚠️ Could not auto-join from this browser.<br>
      <a href="${input}" target="_blank" style="color:var(--cyan);font-weight:600;">Open share link ↗</a>
      — accept the invitation, then come back here and <strong>pull down to refresh</strong>.`;
    errEl.style.display = 'block';
  }
}

