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
  renderAttendees(filtered);
}

function renderAttendees(list) {
  const el = document.getElementById('attendee-list');
  if (list.length === 0) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">👤</div>No attendees found.</div>';
    return;
  }
  el.innerHTML = list.map((a, i) => {
    const tagColor = { red: '#ef4444', blue: '#3b82f6' }[a.colorTag];
    const stripStyle = tagColor
      ? `border-left: 4px solid ${tagColor}; padding-left: 10px;`
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
        ${a.isCheckedIn ? '<div class="checkin-dot"></div>' : ''}
        ${a.notes ? '<div class="note-dot">✎</div>' : ''}
      </div>
    </div>
  `}).join('');
}

