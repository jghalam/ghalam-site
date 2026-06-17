// CrowdNotes — Attendee detail screen
// ── Attendee Detail ───────────────────────────────────────
function selectAttendee(id) {
  currentAttendee = allAttendees.find(a => a.id === id);
  if (!currentAttendee) return;
  showScreen('detail');
  renderDetail();
}

async function refreshDetail() {
  if (!currentAttendee || !activeEvent) return;
  try {
    const stored = currentAttendee._ckRecord;
    if (!stored) throw new Error('No record stored');
    const dbName = activeEvent.dbName || (activeEvent.isOrganizer ? 'private' : 'shared');
    const ckP = new URLSearchParams({ ckjsBuildVersion:'2420ProjectDev22', ckjsVersion:'2.6.4', ckAPIToken:API_TOKEN, ckWebAuthToken }).toString();
    const zoneID = { zoneName: activeEvent.zoneName, ownerRecordName: activeEvent.organizerID || activeEvent.ownerName };
    const resp = await fetch(`https://api.apple-cloudkit.com/database/1/${CONTAINER}/${ENV}/${dbName}/records/lookup?${ckP}`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ zoneID, records:[{ recordName: stored.recordName }] })
    });
    const data = await resp.json();
    const r = (data.records||[])[0];
    if (!r || r.serverErrorCode) throw new Error(r?.reason || 'Refresh failed');
    const upList   = (r.fields.thumbsUp?.value   || []).map(x => typeof x === 'object' ? x.value : x);
    const downList = (r.fields.thumbsDown?.value || []).map(x => typeof x === 'object' ? x.value : x);
    const updated = {
      ...currentAttendee,
      _ckRecord:        r,
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
      thumbsUp:         upList,
      thumbsDown:       downList,
      photoURL:         r.fields.photo?.value?.downloadURL || null,
      attachmentURL:    r.fields.attachment?.value?.downloadURL || null,
      attachmentFilename: r.fields.attachmentFilename?.value || '',
      targetedBy:       r.fields.targetedBy?.value || '',
    };
    currentAttendee = updated;
    const idx = allAttendees.findIndex(a => a.id === updated.id);
    if (idx !== -1) allAttendees[idx] = updated;
    renderDetail();
    showToast('Refreshed');
  } catch(e) {
    showToast('Refresh failed: ' + e.message);
  }
}

function renderDetail() {
  const a = currentAttendee;
  const noteList = a.notes ? a.notes.split('|').filter(Boolean) : [];

  // Color tag
  const tagColor   = { red: '#ef4444', blue: '#3b82f6' }[a.colorTag];
  const tagBgColor = { red: 'rgba(239,68,68,0.10)', blue: 'rgba(59,130,246,0.10)' }[a.colorTag] || '';

  // LinkedIn URL — dedicated clickable row
  const linkedInHTML = a.linkedInURL
    ? `<a href="${escHtml(a.linkedInURL.startsWith('http') ? a.linkedInURL : 'https://' + a.linkedInURL)}" target="_blank" class="info-link" style="color:#0a66c2;">🔗 ${escHtml(a.linkedInURL)}</a>`
    : null;

  const notesHTML = noteList.length === 0
    ? '<div style="color:var(--text2);font-size:14px;padding:4px">No notes yet.</div>'
    : noteList.reverse().map(note => {
        const m = note.match(/^\[([^\]]+)\]\s*(.*)/s);
        if (!m) return `<div class="note-bubble"><div class="note-text">${escHtml(note)}</div></div>`;
        const meta  = m[1];
        const body  = m[2];
        const sep   = meta.includes(' - ') ? ' - ' : ' · ';
        const parts = meta.split(sep);
        const ts    = parts[0]?.trim() || '';
        const auth  = parts.slice(1).join(sep).trim();
        const isDeleted       = body === '[deleted]';
        const isTargetRemoved = body === '[target removed]';
        const isTombstone     = isDeleted || isTargetRemoved;
        const displayBody     = isDeleted ? 'Deleted by author'
                              : isTargetRemoved ? 'Target removed'
                              : escHtml(body);
        return `
          <div class="note-bubble">
            <div class="note-meta"><span>${escHtml(auth)}</span> – ${escHtml(ts)}</div>
            <div class="note-text${isTombstone ? ' tombstone' : ''}">${displayBody}</div>
          </div>`;
      }).join('');

  const thumbsUpCount   = (a.thumbsUp   || []).length;
  const thumbsDownCount = (a.thumbsDown || []).length;
  const myVoteUp   = recruiterName && (a.thumbsUp   || []).includes(recruiterName);
  const myVoteDown = recruiterName && (a.thumbsDown || []).includes(recruiterName);

  // Inline color tag picker
  const colorPickerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0 2px;">
      <span style="font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:0.8px;font-family:'DM Mono',monospace;flex-shrink:0;">Color Tag</span>
      ${[
        { value: 'clear', label: 'Clear', color: null },
        { value: 'red',   label: 'Red',   color: '#ef4444' },
        { value: 'blue',  label: 'Blue',  color: '#3b82f6' },
      ].map(t => {
        const active = (a.colorTag || 'clear') === t.value;
        const bg     = t.color ? (active ? t.color : t.color + '55') : (active ? 'var(--bg3)' : 'var(--bg2)');
        const border = active ? (t.color || 'var(--text)') : 'var(--bg3)';
        const icon   = t.color ? '' : '<span style="font-size:9px;color:var(--text2)">✕</span>';
        return `<button onclick="setColorTag('${t.value}')" title="${t.label}" style="width:28px;height:28px;border-radius:50%;background:${bg};border:2px solid ${border};cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.15s;">${icon}</button>`;
      }).join('')}
    </div>`;

  // Render fixed header with color banner
  document.getElementById('detail-header-fixed').innerHTML = `
    <div class="detail-header" style="${tagColor ? `border-top:4px solid ${tagColor};background:${tagBgColor};` : ''}">
      <div class="detail-avatar" style="${a.photoURL ? 'padding:0;overflow:hidden;' : ''}">
        ${a.photoURL ? `<img src="${escHtml(a.photoURL)}" alt="${escHtml(a.name)}" style="width:100%;height:100%;object-fit:cover;">` : initials(a.name)}
      </div>
      <div>
        <div class="detail-name">${escHtml(a.name)}</div>
        <div class="detail-meta">${escHtml([a.role, a.company].filter(Boolean).join(' · '))}</div>
      </div>
    </div>`;

  // Render scrollable content
  document.getElementById('detail-content').innerHTML = `
    <div class="detail-body">
      <button class="checkin-btn ${a.isCheckedIn ? 'in' : 'out'}" onclick="toggleCheckin(this)">
        ${a.isCheckedIn ? '✓ Checked In — Tap to Undo' : 'Check In'}
      </button>
      <button onclick="toggleTarget(this)" style="width:100%;padding:13px;border-radius:var(--radius);border:1px solid ${a.targetedBy ? 'rgba(251,146,60,0.5)' : 'var(--bg3)'};background:${a.targetedBy ? 'rgba(251,146,60,0.12)' : 'var(--bg2)'};color:${a.targetedBy ? '#fb923c' : 'var(--text2)'};font-size:15px;cursor:pointer;text-align:center;">
        ${a.targetedBy ? '🔥 Targeted' + (a.targetedBy ? ' by ' + escHtml(a.targetedBy) : '') : '🔥 Mark as Target'}
      </button>
      <div style="display:flex;gap:10px;">
        <button onclick="toggleThumb('up')" style="flex:1;padding:12px;border-radius:var(--radius);border:1px solid ${myVoteUp ? 'rgba(34,197,94,0.5)' : 'var(--bg3)'};background:${myVoteUp ? 'rgba(34,197,94,0.15)' : 'var(--bg2)'};color:${myVoteUp ? 'var(--green)' : 'var(--text2)'};font-size:18px;cursor:pointer;">
          👍 ${thumbsUpCount}
        </button>
        <button onclick="toggleThumb('down')" style="flex:1;padding:12px;border-radius:var(--radius);border:1px solid ${myVoteDown ? 'rgba(239,68,68,0.5)' : 'var(--bg3)'};background:${myVoteDown ? 'rgba(239,68,68,0.1)' : 'var(--bg2)'};color:${myVoteDown ? 'var(--red)' : 'var(--text2)'};font-size:18px;cursor:pointer;">
          👎 ${thumbsDownCount}
        </button>
      </div>
      ${a.email       ? `<div class="info-row"><div class="info-label">Email</div><a href="mailto:${escHtml(a.email)}" class="info-value info-link">${escHtml(a.email)}</a></div>` : ''}
      ${a.phone       ? `<div class="info-row"><div class="info-label">Phone</div><a href="tel:${escHtml(a.phone)}" class="info-value info-link">${escHtml(a.phone)}</a></div>` : ''}
      ${linkedInHTML  ? `<div class="info-row"><div class="info-label">LinkedIn</div><div class="info-value">${linkedInHTML}</div></div>` : ''}
      ${a.comment     ? `<div class="info-row"><div class="info-label">Comment</div><div class="info-value">${escHtml(a.comment)}</div></div>` : ''}
      ${a.attachmentURL ? `<div class="info-row"><div class="info-label">Attachment</div><a href="${escHtml(a.attachmentURL)}" target="_blank" class="info-value info-link">📎 ${escHtml(a.attachmentFilename || 'View Attachment')}</a></div>` : ''}
      <div class="notes-section">
        <div class="notes-title">Notes (${noteList.length})</div>
        ${notesHTML}
        <div class="note-input-area">
          <div style="font-size:12px;color:var(--text2)">Posting as ${escHtml(recruiterName)}</div>
          <textarea class="note-textarea" id="note-input" placeholder="Add a note…" autocomplete="off" autocorrect="on" autocapitalize="sentences" spellcheck="true" onfocus="setTimeout(()=>this.scrollIntoView({behavior:'smooth',block:'center'}),300)"></textarea>
          <button class="btn-save-note" onclick="saveNote()">Save Note</button>
          ${colorPickerHTML}
        </div>
      </div>
    </div>
  `;
}

// Cross-platform tap feedback
function tapFeedback(el) {
  if (!el) return;
  el.classList.remove('btn-pressing');
  void el.offsetWidth;
  el.classList.add('btn-pressing');
  el.addEventListener('animationend', () => el.classList.remove('btn-pressing'), { once: true });
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
    osc.onended = () => ctx.close();
  } catch(_) {}
}

document.addEventListener('touchstart', e => {
  const el = e.target.closest('button, [onclick], .attendee-card, .event-card, .nav-item');
  if (el) tapFeedback(el);
}, { passive: true });

document.addEventListener('click', e => {
  if (window.matchMedia('(hover: hover)').matches) {
    const el = e.target.closest('button, [onclick], .attendee-card, .event-card, .nav-item');
    if (el) tapFeedback(el);
  }
});

let _actionPending = false;

async function toggleCheckin(el) {
  if (_actionPending) return;
  _actionPending = true;
  const a = currentAttendee;
  a.isCheckedIn = !a.isCheckedIn;
  renderDetail();
  try {
    const stored = a._ckRecord;
    if (!stored) throw new Error('No record stored');
    const dbName2 = activeEvent.dbName || (activeEvent.isOrganizer ? 'private' : 'shared');
    const ckP2 = new URLSearchParams({ ckjsBuildVersion:'2420ProjectDev22', ckjsVersion:'2.6.4', ckAPIToken:API_TOKEN, ckWebAuthToken }).toString();
    const zoneID2 = { zoneName: activeEvent.zoneName, ownerRecordName: activeEvent.organizerID || activeEvent.ownerName };
    const lookupResp = await fetch(`https://api.apple-cloudkit.com/database/1/${CONTAINER}/${ENV}/${dbName2}/records/lookup?${ckP2}`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ zoneID: zoneID2, records:[{ recordName: stored.recordName }] })
    });
    const lookupData = await lookupResp.json();
    const fRec2 = (lookupData.records||[])[0];
    if (!fRec2 || fRec2.serverErrorCode) throw new Error(fRec2?.reason || 'Record not found for checkin');
    const mo2 = await fetch(`https://api.apple-cloudkit.com/database/1/${CONTAINER}/${ENV}/${dbName2}/records/modify?${ckP2}`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ zoneID: zoneID2, operations:[{ operationType:'update', record:{ recordName:fRec2.recordName, recordChangeTag:fRec2.recordChangeTag, fields:{ isCheckedIn:{ value: a.isCheckedIn ? 1 : 0 } } } }] })
    });
    const md2 = await mo2.json();
    const mr2 = (md2.records||[])[0];
    if (!mr2 || mr2.serverErrorCode) { a.isCheckedIn = !a.isCheckedIn; throw new Error(mr2?.reason || 'Checkin save failed'); }
    const idx = allAttendees.findIndex(x => x.id === a.id);
    if (idx !== -1) allAttendees[idx].isCheckedIn = a.isCheckedIn;
    showToast(a.isCheckedIn ? '✓ Checked in' : 'Check-in removed');
  } catch(e) {
    a.isCheckedIn = !a.isCheckedIn;
    renderDetail();
    showToast('Failed to update check-in: ' + e.message);
  } finally {
    _actionPending = false;
  }
}

async function toggleTarget(el) {
  if (_actionPending) return;
  if (!recruiterName) { showToast('Set your name first'); return; }
  _actionPending = true;
  const a = currentAttendee;
  const prev = a.targetedBy;
  a.targetedBy = prev ? '' : recruiterName;
  renderDetail();
  try {
    const stored = a._ckRecord;
    if (!stored) throw new Error('No record stored');
    const dbName = activeEvent.dbName || (activeEvent.isOrganizer ? 'private' : 'shared');
    const ckP = new URLSearchParams({ ckjsBuildVersion:'2420ProjectDev22', ckjsVersion:'2.6.4', ckAPIToken:API_TOKEN, ckWebAuthToken }).toString();
    const lookupResp = await fetch(`https://api.apple-cloudkit.com/database/1/${CONTAINER}/${ENV}/${dbName}/records/lookup?${ckP}`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ zoneID:{ zoneName:activeEvent.zoneName, ownerRecordName: activeEvent.organizerID || activeEvent.ownerName }, records:[{ recordName: stored.recordName }] })
    });
    const lookupData = await lookupResp.json();
    const fRec = (lookupData.records||[])[0];
    if (!fRec || fRec.serverErrorCode) throw new Error(fRec?.reason || 'Record not found');
    const fields = { targetedBy: { value: a.targetedBy } };
    if (!a.targetedBy) {
      const now = new Date();
      const ts  = `${now.getMonth()+1}/${now.getDate()}/${String(now.getFullYear()).slice(-2)}, ${now.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}`;
      const entry = `[${ts} - ${recruiterName}] [target removed]`;
      a.notes = a.notes ? a.notes + '|' + entry : entry;
      const idx2 = allAttendees.findIndex(x => x.id === a.id);
      if (idx2 !== -1) allAttendees[idx2].notes = a.notes;
      fields.notes = { value: a.notes };
    }
    const mo = await fetch(`https://api.apple-cloudkit.com/database/1/${CONTAINER}/${ENV}/${dbName}/records/modify?${ckP}`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ zoneID:{ zoneName:activeEvent.zoneName, ownerRecordName: activeEvent.organizerID || activeEvent.ownerName }, operations:[{ operationType:'update', record:{ recordName:fRec.recordName, recordChangeTag:fRec.recordChangeTag, fields } }] })
    });
    const md = await mo.json();
    const mr = (md.records||[])[0];
    if (!mr || mr.serverErrorCode) { a.targetedBy = prev; throw new Error(mr?.reason || 'Target save failed'); }
    const idx = allAttendees.findIndex(x => x.id === a.id);
    if (idx !== -1) allAttendees[idx].targetedBy = a.targetedBy;
    showToast(a.targetedBy ? '🔥 Marked as target' : 'Target removed');
  } catch(e) {
    a.targetedBy = prev;
    renderDetail();
    showToast('Failed to update target: ' + e.message);
  } finally {
    _actionPending = false;
  }
}

async function toggleThumb(direction) {
  const a = currentAttendee;
  const field = direction === 'up' ? 'thumbsUp' : 'thumbsDown';
  const otherField = direction === 'up' ? 'thumbsDown' : 'thumbsUp';
  const list = [...(a[field] || [])];
  const otherList = [...(a[otherField] || [])];
  const voteID = recruiterName;
  if (!voteID) { showToast('Set your name first'); return; }
  const myIdx = list.indexOf(voteID);
  if (myIdx >= 0) list.splice(myIdx, 1);
  else { list.push(voteID); const oi = otherList.indexOf(voteID); if (oi >= 0) otherList.splice(oi, 1); }
  if (!ckWebAuthToken) { showToast('Not authenticated'); return; }
  try {
    const stored = a._ckRecord;
    const zid = { zoneName: activeEvent.zoneName, ownerRecordName: activeEvent.ownerName };
    const freshResp = await activeEvent.database.performQuery({
      recordType: 'Attendee', filterBy: [{ fieldName: 'name', comparator: 'NOT_EQUALS', fieldValue: { value: '' } }]
    }, { zoneID: zid });
    const freshRec = (freshResp.records || []).find(r => r.recordName === stored.recordName);
    if (!freshRec) throw new Error('Record not found');
    const dbName = activeEvent.dbName || (activeEvent.isOrganizer ? 'private' : 'shared');
    const ckParams = new URLSearchParams({ ckjsBuildVersion:'2420ProjectDev22', ckjsVersion:'2.6.4', ckAPIToken:API_TOKEN, ckWebAuthToken }).toString();
    const fields = {};
    fields[field] = { value: list };
    fields[otherField] = { value: otherList };
    const moResp = await fetch(`https://api.apple-cloudkit.com/database/1/${CONTAINER}/${ENV}/${dbName}/records/modify?${ckParams}`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ zoneID:{ zoneName:activeEvent.zoneName, ownerRecordName: activeEvent.organizerID || activeEvent.ownerName }, operations:[{ operationType:'update', record:{ recordName:freshRec.recordName, recordChangeTag:freshRec.recordChangeTag, fields } }] })
    });
    const moData = await moResp.json();
    const savedRec = (moData.records||[])[0];
    if (!savedRec || savedRec.serverErrorCode) throw new Error(savedRec?.reason || 'Vote save failed');
    if (direction === 'up') { a.thumbsUp = list; a.thumbsDown = otherList; }
    else { a.thumbsDown = list; a.thumbsUp = otherList; }
    const idx = allAttendees.findIndex(x => x.id === a.id);
    if (idx !== -1) { allAttendees[idx].thumbsUp = a.thumbsUp; allAttendees[idx].thumbsDown = a.thumbsDown; }
    renderDetail();
  } catch(e) {
    showToast('Failed to save vote: ' + e.message);
  }
}

async function setColorTag(tag) {
  if (_actionPending) return;
  _actionPending = true;
  const a = currentAttendee;
  const prev = a.colorTag;
  a.colorTag = tag;
  renderDetail(); // optimistic update
  // Also update the list view card
  const listIdx = allAttendees.findIndex(x => x.id === a.id);
  if (listIdx !== -1) allAttendees[listIdx].colorTag = tag;
  try {
    const stored = a._ckRecord;
    if (!stored) throw new Error('No record stored');
    const dbName = activeEvent.dbName || (activeEvent.isOrganizer ? 'private' : 'shared');
    const ckP = new URLSearchParams({ ckjsBuildVersion:'2420ProjectDev22', ckjsVersion:'2.6.4', ckAPIToken:API_TOKEN, ckWebAuthToken }).toString();
    const zoneID = { zoneName: activeEvent.zoneName, ownerRecordName: activeEvent.organizerID || activeEvent.ownerName };
    const lookupResp = await fetch(`https://api.apple-cloudkit.com/database/1/${CONTAINER}/${ENV}/${dbName}/records/lookup?${ckP}`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ zoneID, records:[{ recordName: stored.recordName }] })
    });
    const lookupData = await lookupResp.json();
    const fRec = (lookupData.records||[])[0];
    if (!fRec || fRec.serverErrorCode) throw new Error(fRec?.reason || 'Record not found');
    // Store 'clear' as empty string so iOS reads it back as .clear via nil coalescing
    const fieldValue = (tag === 'clear') ? '' : tag;
    const mo = await fetch(`https://api.apple-cloudkit.com/database/1/${CONTAINER}/${ENV}/${dbName}/records/modify?${ckP}`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ zoneID, operations:[{ operationType:'update', record:{
        recordName: fRec.recordName, recordChangeTag: fRec.recordChangeTag,
        fields: { colorTag: { value: fieldValue } }
      }}]})
    });
    const md = await mo.json();
    const mr = (md.records||[])[0];
    if (!mr || mr.serverErrorCode) throw new Error(mr?.reason || 'Color tag save failed');
    showToast(tag === 'clear' ? 'Tag cleared' : `Tagged ${tag}`);
  } catch(e) {
    a.colorTag = prev;
    if (listIdx !== -1) allAttendees[listIdx].colorTag = prev;
    renderDetail();
    showToast('Failed to save color tag: ' + e.message);
  } finally {
    _actionPending = false;
  }
}

async function saveNote() {
  const input = document.getElementById('note-input');
  const text  = input.value.trim();
  if (!text) return;
  const btn = document.querySelector('.btn-save-note');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const now  = new Date();
    const ts   = now.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })
               + ', ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const entry = `[${ts} - ${recruiterName}] ${text}`;
    const a     = currentAttendee;
    const stored = currentAttendee._ckRecord;
    if (!stored) throw new Error('No record stored for this attendee');
    if (!ckWebAuthToken) throw new Error('No auth token — please reload');
    const zid = { zoneName: activeEvent.zoneName, ownerRecordName: activeEvent.ownerName };
    const freshResp = await activeEvent.database.performQuery({
      recordType: 'Attendee',
      filterBy: [{ fieldName: 'name', comparator: 'NOT_EQUALS', fieldValue: { value: '' } }]
    }, { zoneID: zid });
    const freshRec = (freshResp.records || []).find(r => r.recordName === stored.recordName);
    if (!freshRec) throw new Error('Could not find record in re-query');
    const serverNotes = freshRec.fields.notes?.value || '';
    const mergedNotes = serverNotes ? serverNotes + '|' + entry : entry;
    const dbName = activeEvent.dbName || (activeEvent.isOrganizer ? 'private' : 'shared');
    const ckParams = new URLSearchParams({
      ckjsBuildVersion: '2420ProjectDev22', ckjsVersion: '2.6.4',
      ckAPIToken: API_TOKEN, ckWebAuthToken
    }).toString();
    const moResp = await fetch(
      `https://api.apple-cloudkit.com/database/1/${CONTAINER}/${ENV}/${dbName}/records/modify?${ckParams}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zoneID: { zoneName: activeEvent.zoneName, ownerRecordName: activeEvent.organizerID || activeEvent.ownerName },
          operations: [{ operationType: 'update', record: {
            recordName: freshRec.recordName,
            recordChangeTag: freshRec.recordChangeTag,
            fields: { notes: { value: mergedNotes } }
          }}]
        })
      }
    );
    const moData = await moResp.json();
    const savedRec = (moData.records || [])[0];
    if (!moResp.ok || !savedRec || savedRec.serverErrorCode) throw new Error(savedRec?.reason || moData.reason || 'Save failed');
    a.notes = mergedNotes;
    const idx = allAttendees.findIndex(x => x.id === a.id);
    if (idx !== -1) allAttendees[idx].notes = mergedNotes;
    input.value = '';
    renderDetail();
    showToast('Note saved ✓');
  } catch(e) {
    showToast('Failed to save note: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Save Note';
  }
}

// ── Share / Print attendee profile ────────────────────────────────────────────

function shareAttendeeProfile() {
  const a = currentAttendee;
  if (!a) return;

  const win = window.open('', '_blank');
  if (!win) { showToast('Pop-up blocked — please allow pop-ups'); return; }
  win.document.write('<html><body style="font-family:sans-serif;padding:40px;color:#555;">Generating profile…</body></html>');

  const tagColor   = { red: '#ef4444', blue: '#3b82f6' }[a.colorTag];
  const tagBgColor = { red: 'rgba(239,68,68,0.10)', blue: 'rgba(59,130,246,0.10)' }[a.colorTag] || '';
  const tagLabel   = { red: 'Red', blue: 'Blue' }[a.colorTag] || null;

  const upNames   = (a.thumbsUp   || []).join(', ') || '—';
  const downNames = (a.thumbsDown || []).join(', ') || '—';
  const net       = (a.thumbsUp?.length || 0) - (a.thumbsDown?.length || 0);
  const netColor  = net > 0 ? '#22c55e' : net < 0 ? '#ef4444' : '#888';
  const netLabel  = net === 0 ? '0' : net > 0 ? `+${net}` : `${net}`;

  // Parse notes — same logic as renderDetail
  const noteList = a.notes ? a.notes.split('|').filter(Boolean) : [];
  const notesHTML = noteList.length === 0
    ? '<div style="font-style:italic;color:#aaa;font-size:10pt;">No notes recorded.</div>'
    : noteList.slice().reverse().map(note => {
        const m = note.match(/^\[([^\]]+)\]\s*(.*)/s);
        if (!m) return `<div class="note"><div class="note-body">${escHtml(note)}</div></div>`;
        const meta  = m[1];
        const body  = m[2];
        if (body === '[deleted]' || body === '[target removed]') return '';
        const sep   = meta.includes(' - ') ? ' - ' : ' · ';
        const parts = meta.split(sep);
        const ts    = parts[0]?.trim() || '';
        const auth  = parts.slice(1).join(sep).trim();
        return `<div class="note"><div class="note-meta">${escHtml(auth)} · ${escHtml(ts)}</div><div class="note-body">${escHtml(body)}</div></div>`;
      }).filter(Boolean).join('');

  const subtitle = [a.role, a.company].filter(Boolean).map(escHtml).join(' · ');
  const now = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const eventName = activeEvent?.name || '';

  const linkedInRow = a.linkedInURL
    ? `<div class="row"><div class="lbl">LinkedIn</div><div class="val"><a href="${escHtml(a.linkedInURL.startsWith('http') ? a.linkedInURL : 'https://' + a.linkedInURL)}" style="color:#0a66c2;">${escHtml(a.linkedInURL)}</a></div></div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escHtml(a.name)} — Profile</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; font-size: 11pt; color: #111; padding: 48pt; line-height: 1.5; }
  .header { padding: 16pt; border-radius: 10pt; margin-bottom: 24pt; background: #f5f5f7; ${tagColor ? `border-top: 4px solid ${tagColor}; background: ${tagBgColor};` : ''} }
  .event-name { font-size: 8.5pt; color: #888; text-transform: uppercase; letter-spacing: 0.5pt; margin-bottom: 6pt; }
  .name { font-size: 22pt; font-weight: 700; color: #111; line-height: 1.2; }
  .subtitle { font-size: 11pt; color: #555; margin-top: 3pt; }
  .tag-pill { display: inline-block; margin-top: 8pt; padding: 2pt 10pt; border-radius: 20pt; font-size: 9pt; font-weight: 600; background: ${tagColor || '#e5e5ea'}; color: ${tagColor ? '#fff' : '#888'}; }
  .targeted { display: inline-block; margin-top: 4pt; padding: 2pt 8pt; border-radius: 6pt; font-size: 9pt; font-weight: 600; background: #fff3e0; color: #e65100; }
  .section { font-size: 9pt; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.6pt; margin: 20pt 0 8pt 0; border-bottom: 1pt solid #e5e5ea; padding-bottom: 4pt; }
  .row { display: flex; gap: 12pt; padding: 5pt 0; border-bottom: 0.5pt solid #f0f0f0; }
  .lbl { min-width: 90pt; color: #888; font-size: 10pt; flex-shrink: 0; }
  .val { color: #111; font-size: 10pt; flex: 1; }
  .votes-row { display: flex; gap: 20pt; margin: 6pt 0; align-items: center; }
  .net-score { font-size: 20pt; font-weight: 700; color: ${netColor}; }
  .vote-detail { font-size: 9pt; color: #888; }
  .note { background: #f9f9f9; border-left: 3pt solid #d1d1d6; border-radius: 0 6pt 6pt 0; padding: 8pt 10pt; margin-bottom: 8pt; }
  .note-meta { font-size: 8.5pt; color: #888; margin-bottom: 3pt; }
  .note-body { font-size: 10pt; color: #111; }
  .footer { margin-top: 32pt; font-size: 8pt; color: #bbb; text-align: center; border-top: 0.5pt solid #e5e5ea; padding-top: 8pt; }
  .print-hint { text-align:center; font-size: 13px; color: #555; margin-bottom: 24pt; }
  .print-hint button { padding: 6px 16px; border-radius: 6px; border: 1px solid #ccc; background: #fff; cursor: pointer; font-size: 13px; }
  @media print { .print-hint { display: none; } body { padding: 36pt; } }
</style>
</head>
<body>
  <div class="print-hint">
    <strong>${escHtml(a.name)}</strong> — Full Profile
    &nbsp;·&nbsp; <button onclick="window.print()">🖨 Print / Save as PDF</button>
  </div>

  <div class="header">
    <div class="event-name">${escHtml(eventName)}</div>
    <div class="name">${escHtml(a.name)}</div>
    ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
    ${a.targetedBy ? `<div class="targeted">🔥 Targeted by ${escHtml(a.targetedBy)}</div>` : ''}
    ${tagLabel ? `<div class="tag-pill">${tagLabel}</div>` : ''}
  </div>

  <div class="section">Contact</div>
  ${a.email ? `<div class="row"><div class="lbl">Email</div><div class="val"><a href="mailto:${escHtml(a.email)}">${escHtml(a.email)}</a></div></div>` : ''}
  ${a.phone ? `<div class="row"><div class="lbl">Phone</div><div class="val"><a href="tel:${escHtml(a.phone)}">${escHtml(a.phone)}</a></div></div>` : ''}
  ${linkedInRow}
  ${a.comment ? `<div class="section">Comment</div><div class="row"><div class="val">${escHtml(a.comment)}</div></div>` : ''}

  <div class="section">Votes</div>
  <div class="votes-row">
    <div class="net-score">${netLabel}</div>
    <div>
      <div class="vote-detail">👍 ${a.thumbsUp?.length || 0} — ${escHtml(upNames)}</div>
      <div class="vote-detail">👎 ${a.thumbsDown?.length || 0} — ${escHtml(downNames)}</div>
    </div>
  </div>

  <div class="section">Notes (${noteList.length})</div>
  ${notesHTML || '<div style="font-style:italic;color:#aaa;font-size:10pt;">No notes recorded.</div>'}

  ${a.attachmentFilename ? `<div class="section">Attachment</div><div class="row"><div class="lbl">File</div><div class="val">${escHtml(a.attachmentFilename)}</div></div>` : ''}

  <div class="footer">Generated by CrowdNotes · ${escHtml(now)}</div>
</body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
}

// ── Schedule Meeting / Calendar event ─────────────────────────────────────────

// iOS detection that also catches iPadOS 13+ (reports as "MacIntel" desktop UA).
function isIOSDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function openScheduleMeeting() {
  if (!currentAttendee) return;
  document.getElementById('sched-title').textContent = meetingTitle();
  document.getElementById('sched-datetime').value = defaultMeetingLocal();
  document.getElementById('sched-duration').value = '30';
  renderScheduleActions();
  updateSchedulePreview();
  document.getElementById('schedule-overlay').style.display = 'flex';
}

function closeScheduleMeeting() {
  document.getElementById('schedule-overlay').style.display = 'none';
}

function updateSchedulePreview() {
  const el = document.getElementById('sched-invitee');
  const email = currentAttendee && currentAttendee.email;
  el.textContent = email
    ? 'Google Calendar invitee: ' + email
    : 'No email on file — invitee can\u2019t be pre-filled';
}

// Apple Calendar is iOS-only (per design); other platforms get a file download.
function renderScheduleActions() {
  const ios = isIOSDevice();
  const btns = [];
  if (ios) {
    btns.push(scheduleActionBtn('🗓️', 'Add to Apple Calendar', '#ef4444', 'scheduleToApple()'));
  }
  btns.push(scheduleActionBtn('📅', 'Add to Google Calendar', '#3b82f6', 'scheduleToGoogle()'));
  if (!ios) {
    btns.push(scheduleActionBtn('⬇️', 'Download .ics file', '#6e6e73', 'scheduleDownloadICS()'));
  }
  document.getElementById('sched-actions').innerHTML = btns.join('');
}

function scheduleActionBtn(icon, label, color, onclick) {
  return `<button onclick="${onclick}" style="display:flex;align-items:center;gap:12px;width:100%;padding:13px;border-radius:var(--radius);border:1px solid var(--bg3);background:var(--bg);color:var(--text);font-size:15px;cursor:pointer;text-align:left;">
    <span style="width:30px;height:30px;border-radius:7px;background:${color};display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">${icon}</span>${label}</button>`;
}

// ── Calendar destinations ─────────────────────────────────────────────────────

function scheduleToGoogle() {
  const { start, end } = meetingDates();
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text:   meetingTitle(),
    dates:  `${start}/${end}`,
    details: meetingNotes(),
  });
  if (currentAttendee.email) params.append('add', currentAttendee.email);
  window.open('https://calendar.google.com/calendar/render?' + params.toString(), '_blank');
  closeScheduleMeeting();
}

async function scheduleToApple() {
  // Cleanest path: a hosted endpoint serving text/calendar → Safari "Add All".
  if (typeof HOSTED_EVENT_URL !== 'undefined' && HOSTED_EVENT_URL) {
    const { start, end } = meetingDates();
    const p = new URLSearchParams({
      title: meetingTitle(), start, end,
      uid: (currentAttendee.id || 'evt') + '@crowdnotes',
      notes: meetingNotes(),
    });
    window.location.href = HOSTED_EVENT_URL + '?' + p.toString();
    closeScheduleMeeting();
    return;
  }
  // Client-only fallback: share the .ics file via the native share sheet.
  const ics  = buildMeetingICS();
  const name = icsFileName();
  try {
    const file = new File([ics], name, { type: 'text/calendar' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: meetingTitle() });
      closeScheduleMeeting();
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return; // user cancelled the sheet
  }
  // Last resort: open the .ics blob so Safari offers to add it.
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  window.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  closeScheduleMeeting();
}

function scheduleDownloadICS() {
  const blob = new Blob([buildMeetingICS()], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = icsFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('.ics file downloaded');
  closeScheduleMeeting();
}

// ── Content builders ──────────────────────────────────────────────────────────

function meetingTitle() {
  return 'Meet with ' + (currentAttendee.name || '');
}

function meetingNotes() {
  const a = currentAttendee;
  const lines = [];
  if (a.role)        lines.push('Role: ' + a.role);
  if (a.company)     lines.push('Company: ' + a.company);
  if (a.email)       lines.push('Email: ' + a.email);
  if (a.phone)       lines.push('Phone: ' + a.phone);
  if (a.linkedInURL) lines.push('LinkedIn: ' + a.linkedInURL);
  if (activeEvent && activeEvent.name) lines.push('Event: ' + activeEvent.name);
  return lines.join('\n');
}

// Returns UTC strings in iCal basic format (YYYYMMDDTHHMMSSZ) for start/end.
function meetingDates() {
  const val = document.getElementById('sched-datetime').value; // local, no tz
  const mins = parseInt(document.getElementById('sched-duration').value, 10) || 30;
  const startDate = val ? new Date(val) : new Date();
  const endDate   = new Date(startDate.getTime() + mins * 60000);
  return { start: icsDateUTC(startDate), end: icsDateUTC(endDate) };
}

function buildMeetingICS() {
  const { start, end } = meetingDates();
  const a = currentAttendee;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CrowdNotes//Web//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:' + (a.id || 'evt') + '@crowdnotes',
    'DTSTAMP:' + icsDateUTC(new Date()),
    'DTSTART:' + start,
    'DTEND:'   + end,
    'SUMMARY:' + icsEsc(meetingTitle()),
    'DESCRIPTION:' + icsEsc(meetingNotes()),
  ];
  if (a.linkedInURL) {
    const u = a.linkedInURL.startsWith('http') ? a.linkedInURL : 'https://' + a.linkedInURL;
    lines.push('URL:' + u);
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function icsEsc(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function icsDateUTC(d) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsFileName() {
  const safe = (currentAttendee.name || 'attendee')
    .replace(/\s+/g, '_')
    .replace(/\//g, '-');
  return 'Meet_with_' + safe + '.ics';
}

function defaultMeetingLocal() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  const wd = d.getDay();              // 0 Sun … 6 Sat
  if (wd === 0) d.setDate(d.getDate() + 1);   // Sun → Mon
  if (wd === 6) d.setDate(d.getDate() + 2);   // Sat → Mon
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
