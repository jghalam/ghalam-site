// CrowdNotes — Attendees list screen
// ── Attendees ─────────────────────────────────────────────
async function loadAttendees() {
  document.getElementById('attendee-list').innerHTML = '<div class="loader"><div class="spinner"></div></div>';
  try {
    const zid = { zoneName: activeEvent.zoneName, ownerRecordName: activeEvent.ownerName };
    const query = {
      recordType: 'Attendee',
      filterBy: [{
        fieldName:  'name',
        comparator: 'NOT_EQUALS',
        fieldValue: { value: '' }
      }]
    };
    const resp = await activeEvent.database.performQuery(query, { zoneID: zid });
    console.log('loadAttendees records:', resp.records?.length, 'errors:', JSON.stringify(resp.errors || []).slice(0,200));

    allAttendees = (resp.records || []).map(r => {
      console.log('attendee record:', r.recordName, 'attendeeID:', r.fields.attendeeID?.value);
      return {
        recordName:       r.recordName,
        _ckRecord:        r,
        id:               r.fields.attendeeID?.value || r.recordName,
        name:             r.fields.name?.value || '',
        role:             r.fields.role?.value || '',
        company:          r.fields.company?.value || '',
        email:            r.fields.email?.value || '',
        phone:            r.fields.phone?.value || '',
        comment:          r.fields.comment?.value || '',
        linkedInURL:      r.fields.linkedInURL?.value || '',
        colorTag:         r.fields.colorTag?.value || 'clear',
        notes:            r.fields.notes?.value || '',
        isCheckedIn:      (r.fields.isCheckedIn?.value || 0) === 1,
        thumbsUp:         r.fields.thumbsUp?.value || [],
        thumbsDown:       r.fields.thumbsDown?.value || [],
        photoURL:         r.fields.photo?.value?.downloadURL || null,
        attachmentURL:    r.fields.attachment?.value?.downloadURL || null,
        attachmentFilename: r.fields.attachmentFilename?.value || '',
        targetedBy:       r.fields.targetedBy?.value || '',
        _modified:        r.modified?.timestamp || 0,
      };
    }).sort((a,b) => a.name.localeCompare(b.name));

    // Use attendee modification timestamps as authoritative last-activity.
    // More reliable than fetchZoneLastActivity which may miss records due to pagination.
    if (activeEvent) {
      const latestAttendee = allAttendees.reduce((max, a) => Math.max(max, a._modified), 0);
      if (latestAttendee) {
        const idx = allEvents.findIndex(e => e.zoneName === activeEvent.zoneName);
        if (idx !== -1 && latestAttendee > (allEvents[idx].modified || 0)) {
          allEvents[idx].modified = latestAttendee;
        }
      }
    }

    renderAttendees(allAttendees);
  } catch(e) {
    document.getElementById('attendee-list').innerHTML = `<div class="error-msg">Failed to load attendees: ${e.message}</div>`;
  }
}

function filterAttendees(q) {
  const filtered = q.trim() === '' ? allAttendees
    : allAttendees.filter(a =>
        a.name.toLowerCase().includes(q.toLowerCase()) ||
        a.company.toLowerCase().includes(q.toLowerCase()) ||
        a.role.toLowerCase().includes(q.toLowerCase())
      );
  renderAttendees(filtered, q.trim() !== '');
}

function renderAttendees(list, isFiltered = false) {
  const el = document.getElementById('attendee-list');

  // Update title with count
  const titleEl = document.getElementById('attendees-title');
  if (titleEl && activeEvent) {
    const checkedIn = list.filter(a => a.isCheckedIn).length;
    const countLabel = isFiltered
      ? `${list.length} of ${allAttendees.length}`
      : `${allAttendees.length}`;
    titleEl.innerHTML = `${escHtml(activeEvent.name)}<span style="font-size:12px;font-weight:400;color:var(--text2);margin-left:8px;">${countLabel} attendees · ${checkedIn} checked in</span>`;
  }

  if (list.length === 0) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">👤</div>No attendees found.</div>';
    return;
  }
  el.innerHTML = list.map((a, i) => {
    const tagColor = { red: '#ef4444', blue: '#3b82f6' }[a.colorTag];
    const stripStyle = tagColor
      ? `border-left: 4px solid ${tagColor}; padding-left: 10px;`
      : '';
    const net = (a.thumbsUp?.length || 0) - (a.thumbsDown?.length || 0);
    const netHTML = net !== 0
      ? `<span style="font-size:13px;font-weight:600;color:${net > 0 ? '#22c55e' : '#ef4444'};flex-shrink:0;">${net > 0 ? '+' : ''}${net}</span>`
      : '';
    return `
    <div class="attendee-card" onclick="selectAttendee('${escHtml(a.id)}')" style="${stripStyle}">
      <div class="attendee-avatar ${a.isCheckedIn ? 'checked-in' : ''}">
        ${a.photoURL ? `<img src="${escHtml(a.photoURL)}" alt="${escHtml(a.name)}">` : initials(a.name)}
      </div>
      <div class="attendee-info">
        <div class="attendee-name">${a.targetedBy ? '🔥 ' : ''}${escHtml(a.name)}</div>
        <div class="attendee-meta">${escHtml([a.role, a.company].filter(Boolean).join(' · '))}</div>
      </div>
      <div class="attendee-indicators">
        ${netHTML}
        ${a.isCheckedIn ? '<div class="checkin-dot"></div>' : ''}
        ${a.notes ? '<div class="note-dot">✎</div>' : ''}
      </div>
    </div>
  `}).join('');
}


// ── LinkedIn Field Migration ───────────────────────────────

let _migrationTimer = null;
let _migrationCancelled = false;

function startMigrationLongPress() {
  const el = document.getElementById('attendees-title');
  el.style.transition = 'background 1.5s linear';
  el.style.background = 'rgba(0,212,232,0.15)';
  el.style.borderRadius = '6px';
  _migrationTimer = setTimeout(() => {
    _migrationTimer = null;
    el.style.transition = '';
    el.style.background = '';
    openMigrationModal();
  }, 1500);
}

function cancelMigrationLongPress() {
  if (_migrationTimer) {
    clearTimeout(_migrationTimer);
    _migrationTimer = null;
    const el = document.getElementById('attendees-title');
    el.style.transition = 'background 0.3s';
    el.style.background = '';
    setTimeout(() => { el.style.transition = ''; }, 300);
  }
}

function openMigrationModal() {
  _migrationCancelled = false;
  const overlay = document.getElementById('migration-overlay');
  overlay.style.display = 'flex';
  document.getElementById('migration-status').textContent =
    `${allAttendees.length} attendees loaded. Ready to scan for LinkedIn URLs in the Comment field.`;
  document.getElementById('migration-log').innerHTML = '';
  document.getElementById('migration-progress-bar-wrap').style.display = 'none';
  document.getElementById('migration-progress-bar').style.width = '0%';
  document.getElementById('migration-run-btn').style.display = '';
  document.getElementById('migration-run-btn').disabled = false;
  document.getElementById('migration-run-btn').textContent = 'Run Migration';
  document.getElementById('migration-close-btn').style.display = 'none';
  document.getElementById('migration-cancel-btn').style.display = '';
}

function closeMigrationModal() {
  document.getElementById('migration-overlay').style.display = 'none';
}

function cancelMigration() {
  _migrationCancelled = true;
  closeMigrationModal();
}

function logMigration(msg, type = 'info') {
  const log = document.getElementById('migration-log');
  const colors = { info: 'var(--text2)', ok: 'var(--green)', skip: 'var(--text2)', error: 'var(--red)' };
  const icons  = { info: 'ℹ', ok: '✓', skip: '–', error: '✕' };
  const el = document.createElement('div');
  el.style.cssText = `color:${colors[type]};padding:2px 0;border-bottom:1px solid var(--bg3);`;
  el.textContent = `${icons[type]} ${msg}`;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
}

async function runLinkedInMigration() {
  console.log('[Migration] Run clicked. activeEvent:', !!activeEvent, 'ckWebAuthToken:', !!ckWebAuthToken, 'allAttendees:', allAttendees?.length);

  const runBtn    = document.getElementById('migration-run-btn');
  const statusEl  = document.getElementById('migration-status');
  const logEl     = document.getElementById('migration-log');
  const barWrap   = document.getElementById('migration-progress-bar-wrap');
  const bar       = document.getElementById('migration-progress-bar');
  const closeBtn  = document.getElementById('migration-close-btn');
  const cancelBtn = document.getElementById('migration-cancel-btn');

  const showError = msg => {
    statusEl.style.color = 'var(--red)';
    statusEl.textContent = '⚠ ' + msg;
    runBtn.disabled = false;
    runBtn.textContent = 'Run Migration';
  };

  try {
    if (!activeEvent)      { showError('No active event — go back and open an event first.'); return; }
    if (!ckWebAuthToken)   { showError('Not authenticated — please sign in first.'); return; }
    if (!allAttendees?.length) { showError('No attendees loaded — refresh the attendee list first.'); return; }

    _migrationCancelled = false;
    runBtn.disabled = true;
    runBtn.textContent = 'Running…';
    statusEl.style.color = '';
    barWrap.style.display = '';
    logEl.innerHTML = '';

    const isLinkedIn = s => s && s.toLowerCase().includes('linkedin.com');
    const candidates = allAttendees.filter(a => isLinkedIn(a.comment) && !a.linkedInURL);

    console.log('[Migration] Candidates:', candidates.length);

    if (candidates.length === 0) {
      logMigration('No records found with a LinkedIn URL in the Comment field.', 'info');
      statusEl.textContent = 'Nothing to migrate.';
      bar.style.width = '100%';
      runBtn.style.display = 'none';
      closeBtn.style.display = '';
      return;
    }

    logMigration(`Found ${candidates.length} record(s) to migrate out of ${allAttendees.length} total.`, 'info');
    statusEl.textContent = `Migrating 0 / ${candidates.length}…`;

    const dbName = activeEvent.dbName || (activeEvent.isOrganizer ? 'private' : 'shared');
    const zoneID = { zoneName: activeEvent.zoneName, ownerRecordName: activeEvent.organizerID || activeEvent.ownerName };
    const ckBase = new URLSearchParams({ ckjsBuildVersion:'2420ProjectDev22', ckjsVersion:'2.6.4', ckAPIToken:API_TOKEN, ckWebAuthToken }).toString();

    console.log('[Migration] dbName:', dbName, 'zoneID:', JSON.stringify(zoneID));

    let done = 0, succeeded = 0, failed = 0;

    for (const a of candidates) {
      if (_migrationCancelled) { logMigration('Migration cancelled by user.', 'error'); break; }

      bar.style.width = Math.round((done / candidates.length) * 100) + '%';
      statusEl.textContent = `Migrating ${done + 1} / ${candidates.length}: ${a.name}`;

      try {
        const lookupResp = await fetch(`https://api.apple-cloudkit.com/database/1/${CONTAINER}/${ENV}/${dbName}/records/lookup?${ckBase}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ zoneID, records: [{ recordName: a._ckRecord.recordName }] })
        });
        const lookupData = await lookupResp.json();
        const fRec = (lookupData.records || [])[0];
        if (!fRec || fRec.serverErrorCode) throw new Error(fRec?.reason || 'Lookup failed');

        const serverComment     = fRec.fields.comment?.value || '';
        const serverLinkedInURL = fRec.fields.linkedInURL?.value || '';
        if (!isLinkedIn(serverComment) || serverLinkedInURL) {
          logMigration(`${a.name} — skipped (already migrated or comment changed)`, 'skip');
          done++; continue;
        }

        const moResp = await fetch(`https://api.apple-cloudkit.com/database/1/${CONTAINER}/${ENV}/${dbName}/records/modify?${ckBase}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ zoneID, operations: [{ operationType: 'update', record: {
            recordName: fRec.recordName,
            recordChangeTag: fRec.recordChangeTag,
            fields: { linkedInURL: { value: serverComment }, comment: { value: '' } }
          }}]})
        });
        const moData = await moResp.json();
        const mr = (moData.records || [])[0];
        if (!mr || mr.serverErrorCode) throw new Error(mr?.reason || 'Save failed');

        a.linkedInURL = serverComment;
        a.comment = '';
        const idx = allAttendees.findIndex(x => x.id === a.id);
        if (idx !== -1) { allAttendees[idx].linkedInURL = serverComment; allAttendees[idx].comment = ''; }

        logMigration(`${a.name} — moved "${serverComment}"`, 'ok');
        succeeded++;
      } catch(e) {
        console.error('[Migration] Record error:', a.name, e);
        logMigration(`${a.name} — ERROR: ${e.message}`, 'error');
        failed++;
      }

      done++;
      await new Promise(r => setTimeout(r, 350));
    }

    bar.style.width = '100%';
    const summary = `Done — ${succeeded} migrated, ${failed} failed, ${candidates.length - done} cancelled.`;
    statusEl.textContent = summary;
    statusEl.style.color = failed === 0 ? 'var(--green)' : '';
    logMigration(summary, succeeded > 0 && failed === 0 ? 'ok' : 'info');
    runBtn.style.display = 'none';
    closeBtn.style.display = '';
    cancelBtn.style.display = 'none';

  } catch(e) {
    console.error('[Migration] Unexpected error:', e);
    showError('Unexpected error: ' + e.message);
  }
}
