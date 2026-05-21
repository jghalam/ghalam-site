// CrowdNotes — Events screen
// ── Events ────────────────────────────────────────────────
async function loadEvents() {
  try {
    const leftZones = JSON.parse(localStorage.getItem('leftZoneNames') || '[]');
    const savedShares = JSON.parse(localStorage.getItem('sharedZones') || '[]');
    let events = [];

    // Private zones (organizer)
    const privateZones = await db.fetchAllRecordZones();
    for (const zone of (privateZones.zones || [])) {
      if (zone.zoneID.zoneName === '_defaultZone') continue;
      const event = await fetchEventRecord(zone.zoneID, db, true);
      if (event && !leftZones.includes(zone.zoneID.zoneName)) events.push(event);
    }

    // Shared zones from CloudKit (member - zones already accepted on iOS)
    const sharedZones = await sharedDB.fetchAllRecordZones();
    for (const zone of (sharedZones.zones || [])) {
      if (zone.zoneID.zoneName === '_defaultZone') continue;
      const event = await fetchEventRecord(zone.zoneID, sharedDB, false);
      if (event && !leftZones.includes(zone.zoneID.zoneName)) events.push(event);
    }

    // Zones joined via share link on web
    for (const saved of savedShares) {
      if (!saved.zoneName) continue;
      if (leftZones.includes(saved.zoneName)) continue;
      if (events.find(e => e.zoneName === saved.zoneName)) continue;
      const zoneID = { zoneName: saved.zoneName, ownerRecordName: saved.ownerName || saved.ownerRecordName };
      // Use privateDB for organizer's PRIVATE scope, sharedDB for members
      const targetDB = (saved.dbScope === 'PRIVATE') ? db : sharedDB;
      const isOrg    = (saved.dbScope === 'PRIVATE');
      const event = await fetchEventRecord(zoneID, targetDB, isOrg);
      if (event) events.push(event);
    }

    allEvents = events;

    // Fetch zone last-activity timestamps before rendering so correct values show immediately.
    await Promise.all(events.map(async (e, i) => {
      const ts = await fetchZoneLastActivity(e);
      if (ts && ts > (allEvents[i].modified || 0)) allEvents[i].modified = ts;
    }));

    renderEvents();
  } catch(e) {
    console.error('loadEvents error:', e);
    document.getElementById('event-list').innerHTML = `<div class="error-msg">Failed to load events: ${e.message}</div>`;
  }
}

async function fetchEventRecord(zoneID, database, isOrganizer) {
  try {
    const ownerRN = zoneID.ownerRecordName || zoneID.ownerName || '__defaultOwner__';
    const zid = { zoneName: zoneID.zoneName, ownerRecordName: ownerRN };
    console.log('fetchEventRecord zone:', zid.zoneName, 'owner:', ownerRN, 'db:', isOrganizer ? 'private' : 'shared');

    // Use organizerID STRING field — Queryable per schema
    // CloudKit JS filterBy format: fieldValue is a CKRecordFieldValue
    const query = {
      recordType: 'Event',
      filterBy: [{
        fieldName:  'organizerID',
        comparator: 'NOT_EQUALS',
        fieldValue: { value: '' }
      }]
    };
    const queryOptions = { zoneID: zid };
    console.log('fetchEventRecord query:', JSON.stringify(query));
    console.log('fetchEventRecord options:', JSON.stringify(queryOptions));
    const resp = await database.performQuery(query, queryOptions);
    console.log('fetchEventRecord records:', resp.records?.length, 'errors:', JSON.stringify(resp.errors || []).slice(0, 300));

    if (resp.records && resp.records.length > 0) {
      const r = resp.records[0];
      return {
        zoneName:    zid.zoneName,
        ownerName:   ownerRN,
        name:        r.fields.name?.value || 'Untitled Event',
        recordName:  r.recordName,
        organizerID: r.fields.organizerID?.value || ownerRN,
        shareURL:    r.fields.shareURL?.value || null,
        logoURL:     r.fields.logo?.value?.downloadURL || null,
        isOrganizer,
        database,
        dbName:      isOrganizer ? 'private' : 'shared',
        modified:    r.modified?.timestamp || null
      };
    }
  } catch(e) {
    console.log('fetchEventRecord error:', zoneID.zoneName, e.message);
  }
  return null;
}

function fmtModified(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMin  = Math.floor(diffMs / 60000);
  const diffHr   = Math.floor(diffMs / 3600000);
  const diffDay  = Math.floor(diffMs / 86400000);
  if (diffMin < 1)   return 'Updated just now';
  if (diffMin < 60)  return `Updated ${diffMin}m ago`;
  if (diffHr  < 24)  return `Updated ${diffHr}h ago`;
  if (diffDay < 7)   return `Updated ${diffDay}d ago`;
  return `Updated ${d.toLocaleDateString(undefined, { month:'short', day:'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })}`;
}

function renderEvents() {
  const list = document.getElementById('event-list');
  const sub  = document.getElementById('events-subtitle');
  if (allEvents.length === 0) {
    sub.textContent = 'No events found.';
    list.innerHTML = `<div class="empty">
      <div class="empty-icon">📅</div>
      <div style="font-size:16px;font-weight:600;margin-bottom:8px;">No events yet</div>
      <div style="font-size:14px;line-height:1.6;max-width:320px;margin:0 auto 20px;">
        Events must be created in the <strong style="color:var(--text)">CrowdNotes iOS app</strong> by an organizer,
        who then shares an invite link with you.
      </div>
      <a href="https://apps.apple.com/us/app/crowdnotes/id6760520709" target="_blank"
        style="display:inline-flex;align-items:center;gap:8px;background:var(--cyan);color:#000;
               text-decoration:none;padding:12px 20px;border-radius:var(--radius);font-weight:600;font-size:14px;">
        🍎 Get CrowdNotes on the App Store
      </a>
    </div>`;
    return;
  }
  sub.textContent = `${allEvents.length} event${allEvents.length !== 1 ? 's' : ''}`;
  list.innerHTML = allEvents.map((e, i) => {
    const hasQR = !!(e.shareURL || (JSON.parse(localStorage.getItem('sharedZones') || '[]')
      .find(z => z.zoneName === e.zoneName)?.shareURL));
    const iconHTML = hasQR
      ? `<canvas id="ev-qr-${i}" width="44" height="44" style="border-radius:12px;"></canvas>`
      : `📋`;
    const iconClick = hasQR
      ? `event.stopPropagation(); showEventQR(${i})`
      : `selectEvent(${i})`;
    return `
    <div class="event-card" onclick="selectEvent(${i})">
      <div class="event-icon" onclick="${iconClick}" title="${hasQR ? 'Show QR code' : ''}">${iconHTML}</div>
      <div class="event-info">
        <div class="event-name">${escHtml(e.name)}</div>
        <div class="event-meta">${e.isOrganizer ? '👑 Organizer' : '👤 Member'}</div>
        ${e.modified ? `<div class="event-meta" style="font-size:11px;margin-top:2px;opacity:0.6;">${fmtModified(e.modified)}</div>` : ''}
      </div>
      ${e.isOrganizer
        ? `<span class="badge badge-active">ORGANIZER</span>`
        : `<span class="badge badge-shared" style="cursor:pointer" onclick="event.stopPropagation(); leaveEvent(${i})" title="Leave event">LEAVE</span>`
      }
    </div>`;
  }).join('');

  // Render mini QR codes after DOM is updated
  requestAnimationFrame(() => {
    allEvents.forEach((e, i) => {
      const url = e.shareURL ||
        (JSON.parse(localStorage.getItem('sharedZones') || '[]')
          .find(z => z.zoneName === e.zoneName)?.shareURL);
      if (!url) return;
      const canvas = document.getElementById(`ev-qr-${i}`);
      if (canvas) renderQRToCanvas(url, canvas, 44).catch(() => {});
    });
  });
}

async function leaveEvent(idx) {
  const e = allEvents[idx];
  if (!e || e.isOrganizer) return;
  if (!confirm(`Leave "${e.name}"? You can rejoin with the invite link.`)) return;

  // Write MemberStatus: "left" so organizer's iOS app hides this member
  if (e.zoneName && e.ownerName && ckWebAuthToken && currentUserRecordName) {
    const displayName = document.getElementById('signed-in-name')?.textContent?.trim() || recruiterName;
    try {
      const ckParams = new URLSearchParams({
        ckjsBuildVersion: '2420ProjectDev22', ckjsVersion: '2.6.4',
        ckAPIToken: API_TOKEN, ckWebAuthToken
      }).toString();
      await fetch(
        `https://api.apple-cloudkit.com/database/1/${CONTAINER}/${ENV}/shared/records/modify?${ckParams}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            zoneID: { zoneName: e.zoneName, ownerRecordName: e.ownerName },
            operations: [{ operationType: 'forceReplace', record: {
              recordName: 'memberstatus-' + currentUserRecordName,
              recordType: 'MemberStatus',
              fields: {
                userID:      { value: currentUserRecordName },
                status:      { value: 'left' },
                displayName: { value: displayName }
              }
            }}]
          })
        }
      );
      console.log('✅ leaveEvent: wrote MemberStatus left for zone', e.zoneName);
    } catch(err) {
      console.warn('⚠️ leaveEvent: MemberStatus write failed:', err.message);
    }
  }

  // Add to local left zones immediately
  const left = JSON.parse(localStorage.getItem('leftZoneNames') || '[]');
  if (!left.includes(e.zoneName)) {
    left.push(e.zoneName);
    localStorage.setItem('leftZoneNames', JSON.stringify(left));
  }
  // Persist to CloudKit so it survives sign-out
  await addCloudLeftZone(e.zoneName);

  // Remove from UI
  allEvents.splice(idx, 1);
  renderEvents();
  showToast('Left event');
}

async function selectEvent(idx) {
  activeEvent = allEvents[idx];
  document.getElementById('attendees-title').textContent = activeEvent.name;
  // Cache share URL and update topbar QR icon
  const _shareURL = activeEvent.shareURL ||
    (JSON.parse(localStorage.getItem('sharedZones') || '[]')
      .find(z => z.zoneName === activeEvent.zoneName)?.shareURL) || null;
  activeEvent._shareURL = _shareURL;
  const qrBtn = document.getElementById('topbar-qr-btn');
  const qrPreview = document.getElementById('topbar-qr-preview');
  if (qrBtn) qrBtn.style.display = _shareURL ? 'flex' : 'none';
  if (_shareURL && qrPreview) renderQRToCanvas(_shareURL, qrPreview, 28).catch(() => {});

  showScreen('attendees');
  loadAttendees();
}

