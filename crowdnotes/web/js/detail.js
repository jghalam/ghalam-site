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
    // Parse the single fresh record the same way loadAttendees does
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
  const isURL = s => s && (s.startsWith('http') || s.includes('.com') || s.includes('.org') || s.includes('.net') || s.includes('.io'));
  const toAbsURL = s => (s.startsWith('http://') || s.startsWith('https://')) ? s : 'https://' + s;

  const commentHTML = a.comment
    ? isURL(a.comment)
      ? `<a href="${escHtml(toAbsURL(a.comment))}" target="_blank" class="info-link">🔗 ${escHtml(a.comment)}</a>`
      : escHtml(a.comment)
    : '<span style="color:var(--text2)">—</span>';

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
  // thumbsUp/Down arrays contain recruiter display names (same as iOS)
  const myVoteUp   = recruiterName && (a.thumbsUp   || []).includes(recruiterName);
  const myVoteDown = recruiterName && (a.thumbsDown || []).includes(recruiterName);

  document.getElementById('detail-header-fixed').innerHTML = `
    <div class="detail-header">
      <div class="detail-avatar" style="${a.photoURL ? 'padding:0;overflow:hidden;' : ''}">
        ${a.photoURL ? `<img src="${escHtml(a.photoURL)}" alt="${escHtml(a.name)}" style="width:100%;height:100%;object-fit:cover;">` : initials(a.name)}
      </div>
      <div>
        <div class="detail-name">${escHtml(a.name)}</div>
        <div class="detail-meta">${escHtml([a.role, a.company].filter(Boolean).join(' · '))}</div>
      </div>
    </div>`;

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
      ${a.email ? `<div class="info-row"><div class="info-label">Email</div><a href="mailto:${escHtml(a.email)}" class="info-value info-link">${escHtml(a.email)}</a></div>` : ''}
      ${a.phone ? `<div class="info-row"><div class="info-label">Phone</div><a href="tel:${escHtml(a.phone)}" class="info-value info-link">${escHtml(a.phone)}</a></div>` : ''}
      ${a.comment ? `<div class="info-row"><div class="info-label">Comment</div><div class="info-value">${commentHTML}</div></div>` : ''}
      ${a.attachmentURL ? `<div class="info-row"><div class="info-label">Attachment</div><a href="${escHtml(a.attachmentURL)}" target="_blank" class="info-value info-link">📎 ${escHtml(a.attachmentFilename || 'View Attachment')}</a></div>` : ''}
      <div class="notes-section">
        <div class="notes-title">Notes (${noteList.length})</div>
        ${notesHTML}
        <div class="note-input-area">
          <div style="font-size:12px;color:var(--text2)">Posting as ${escHtml(recruiterName)}</div>
          <textarea class="note-textarea" id="note-input" placeholder="Add a note…" autocomplete="off" autocorrect="on" autocapitalize="sentences" spellcheck="true" onfocus="setTimeout(()=>this.scrollIntoView({behavior:'smooth',block:'center'}),300)"></textarea>
          <button class="btn-save-note" onclick="saveNote()">Save Note</button>
        </div>
      </div>
    </div>
  `;
}

// Cross-platform tap feedback: CSS press animation + synthesized audio tick
// Attached globally — fires for every button/[onclick] tap automatically.
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

// Global delegate — catches taps on any button or element with an onclick
document.addEventListener('touchstart', e => {
  const el = e.target.closest('button, [onclick], .attendee-card, .event-card, .nav-item');
  if (el) tapFeedback(el);
}, { passive: true });

// Fallback for non-touch (mouse click on desktop)
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
  renderDetail(); // instant optimistic UI update
  try {
    const stored = a._ckRecord;
    if (!stored) throw new Error('No record stored');
    const dbName2 = activeEvent.dbName || (activeEvent.isOrganizer ? 'private' : 'shared');
    const ckP2 = new URLSearchParams({ ckjsBuildVersion:'2420ProjectDev22', ckjsVersion:'2.6.4', ckAPIToken:API_TOKEN, ckWebAuthToken }).toString();
    const zoneID2 = { zoneName: activeEvent.zoneName, ownerRecordName: activeEvent.organizerID || activeEvent.ownerName };

    // Fetch fresh changeTag for this single record — avoids loading all attendees
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
  renderDetail(); // instant optimistic UI update
  try {
    const stored = a._ckRecord;
    if (!stored) throw new Error('No record stored');
    const dbName = activeEvent.dbName || (activeEvent.isOrganizer ? 'private' : 'shared');
    const ckP = new URLSearchParams({ ckjsBuildVersion:'2420ProjectDev22', ckjsVersion:'2.6.4', ckAPIToken:API_TOKEN, ckWebAuthToken }).toString();

    // Fetch fresh changeTag for this single record — avoids loading all 137
    const lookupResp = await fetch(`https://api.apple-cloudkit.com/database/1/${CONTAINER}/${ENV}/${dbName}/records/lookup?${ckP}`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ zoneID:{ zoneName:activeEvent.zoneName, ownerRecordName: activeEvent.organizerID || activeEvent.ownerName }, records:[{ recordName: stored.recordName }] })
    });
    const lookupData = await lookupResp.json();
    const fRec = (lookupData.records||[])[0];
    if (!fRec || fRec.serverErrorCode) throw new Error(fRec?.reason || 'Record not found');

    // Send '' to clear — CloudKit REST ignores { value: null } and won't delete the field
    const fields = { targetedBy: { value: a.targetedBy } };

    // When clearing, also save the audit note in the same operation
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
  const list = [...(a[field === 'thumbsUp' ? 'thumbsUp' : 'thumbsDown'] || [])];
  const otherList = [...(a[otherField === 'thumbsUp' ? 'thumbsUp' : 'thumbsDown'] || [])];
  // Use recruiter display name for vote identity (matches iOS app behavior)
  const voteID = recruiterName;
  if (!voteID) { showToast('Set your name first'); return; }
  const myIdx = list.indexOf(voteID);

  // Toggle: remove if already voted, add if not. Also remove from opposite.
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
    // Update local state
    if (direction === 'up') { a.thumbsUp = list; a.thumbsDown = otherList; }
    else { a.thumbsDown = list; a.thumbsUp = otherList; }
    const idx = allAttendees.findIndex(x => x.id === a.id);
    if (idx !== -1) { allAttendees[idx].thumbsUp = a.thumbsUp; allAttendees[idx].thumbsDown = a.thumbsDown; }
    renderDetail();
  } catch(e) {
    showToast('Failed to save vote: ' + e.message);
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
    const newNotes = a.notes ? a.notes + '|' + entry : entry;

    const stored = currentAttendee._ckRecord;
    if (!stored) throw new Error('No record stored for this attendee');
    if (!ckWebAuthToken) throw new Error('No auth token — please reload');

    // Re-query to get fresh record with current changeTag
    const zid = { zoneName: activeEvent.zoneName, ownerRecordName: activeEvent.ownerName };
    const freshResp = await activeEvent.database.performQuery({
      recordType: 'Attendee',
      filterBy: [{ fieldName: 'name', comparator: 'NOT_EQUALS', fieldValue: { value: '' } }]
    }, { zoneID: zid });
    const freshRec = (freshResp.records || []).find(r => r.recordName === stored.recordName);
    if (!freshRec) throw new Error('Could not find record in re-query');

    // Merge new note onto server's current notes
    const serverNotes = freshRec.fields.notes?.value || '';
    const mergedNotes = serverNotes ? serverNotes + '|' + entry : entry;

    // REST modify: zoneID at top level with organizerID as owner
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

