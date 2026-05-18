// CrowdNotes — QR share and scanner
// ── Share QR ──────────────────────────────────────────────

// Render QR to a target canvas. Uses an offscreen canvas so QRCode.toCanvas
// can't blow up the target's visible size.
function renderQRToCanvas(text, targetCanvas, displaySize) {
  return new Promise((resolve, reject) => {
    if (typeof QRCode === 'undefined') { reject('QRCode lib not loaded'); return; }
    const off = document.createElement('canvas');
    QRCode.toCanvas(off, text, {
      width: displaySize, margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    }, (err) => {
      if (err) { reject(err); return; }
      targetCanvas.width  = displaySize;
      targetCanvas.height = displaySize;
      const ctx = targetCanvas.getContext('2d');
      ctx.drawImage(off, 0, 0, displaySize, displaySize);
      resolve();
    });
  });
}

async function showShareQR() {
  const url = activeEvent?._shareURL;
  if (!url) return;
  document.getElementById('qr-modal-title').textContent = activeEvent.name;
  const canvas = document.getElementById('qr-modal-canvas');
  try { await renderQRToCanvas(url, canvas, 240); }
  catch(e) { console.error('QR render failed:', e); }
  document.getElementById('qr-modal-overlay').classList.add('open');
}

async function showEventQR(idx) {
  const e = allEvents[idx];
  if (!e) return;
  const url = e.shareURL ||
    (JSON.parse(localStorage.getItem('sharedZones') || '[]')
      .find(z => z.zoneName === e.zoneName)?.shareURL);
  if (!url) return;
  document.getElementById('qr-modal-title').textContent = e.name;
  const canvas = document.getElementById('qr-modal-canvas');
  try { await renderQRToCanvas(url, canvas, 240); }
  catch(err) { console.error('QR render failed:', err); }
  document.getElementById('qr-modal-overlay').classList.add('open');
}

function closeShareQR() {
  document.getElementById('qr-modal-overlay').classList.remove('open');
}

// ── Join by QR scanner ─────────────────────────────────────

let joinScannerInstance = null;

async function startJoinScan() {
  const overlay = document.getElementById('join-qr-overlay');
  const video   = document.getElementById('join-qr-video');
  const hint    = document.getElementById('join-qr-hint');
  overlay.classList.add('open');
  hint.textContent = 'Starting camera…';

  // Wait for QrScanner if needed
  let attempts = 0;
  while (!window.QrScanner && attempts++ < 20) {
    await new Promise(r => setTimeout(r, 100));
  }
  if (!window.QrScanner) {
    hint.textContent = 'Camera scanner not available.';
    return;
  }
  try {
    video.style.visibility = 'visible';
    joinScannerInstance = new window.QrScanner(
      video,
      r => handleJoinQR(r.data),
      { preferredCamera: 'environment', highlightScanRegion: true, maxScansPerSecond: 5 }
    );
    await joinScannerInstance.start();
    hint.textContent = 'Point camera at a CrowdNotes event QR code.';
  } catch(e) {
    hint.textContent = 'Camera access denied — allow camera in browser settings.';
  }
}

function stopJoinScan() {
  if (joinScannerInstance) {
    joinScannerInstance.stop();
    joinScannerInstance.destroy();
    joinScannerInstance = null;
  }
  document.getElementById('join-qr-overlay').classList.remove('open');
}

async function handleJoinQR(code) {
  stopJoinScan();
  const hint = document.getElementById('join-qr-hint');

  // Extract icloud.com share URL from the scanned code
  // Handles both bare icloud.com/share/... and ghalam.net/...?share=... formats
  let shareURL = null;
  if (code.includes('icloud.com/share/')) {
    shareURL = code;
  } else {
    try {
      const parsed = new URL(code);
      const param  = parsed.searchParams.get('share');
      if (param && param.includes('icloud.com/share/')) shareURL = param;
    } catch(e) {}
  }

  if (!shareURL) {
    showToast('Not a CrowdNotes event QR code.');
    return;
  }

  showToast('Event found — joining…');
  // Populate the share input and run the existing join flow
  document.getElementById('share-link-input').value = shareURL;
  await joinWithLink();
}

// ── QR Scanner ────────────────────────────────────────────
let qrScannerInstance = null;

async function startScan() {
  const video  = document.getElementById('qr-video');
  const hint   = document.getElementById('scan-hint');
  const result = document.getElementById('scan-result');
  const btn    = document.getElementById('btn-start-scan');

  result.textContent = '';
  hint.textContent   = 'Starting camera…';
  btn.style.display  = 'none';

  // Wait for QrScanner to load via ES module (up to 2s)
  let attempts = 0;
  while (!window.QrScanner && attempts++ < 20) {
    await new Promise(r => setTimeout(r, 100));
  }
  if (!window.QrScanner) {
    hint.textContent  = 'QR scanner failed to load. Please refresh and try again.';
    btn.style.display = 'block';
    return;
  }

  try {
    video.style.display     = 'block';
    video.style.visibility  = 'visible';
    qrScannerInstance = new window.QrScanner(
      video,
      r => handleQRCode(r.data),
      {
        preferredCamera:      'environment',
        highlightScanRegion:  true,
        highlightCodeOutline: true,
        maxScansPerSecond:    5,
      }
    );
    await qrScannerInstance.start();
    hint.textContent    = 'Scanning… hold steady over the QR code.';
  } catch(e) {
    hint.textContent  = 'Camera access denied. Please allow camera access in your browser settings.';
    btn.style.display = 'block';
    if (qrScannerInstance) { qrScannerInstance.destroy(); qrScannerInstance = null; }
  }
}

function stopScan() {
  if (qrScannerInstance) {
    qrScannerInstance.stop();
    qrScannerInstance.destroy();
    qrScannerInstance = null;
  }
  const video = document.getElementById('qr-video');
  video.style.visibility = 'hidden';
  document.getElementById('btn-start-scan').style.display = 'block';
  document.getElementById('scan-hint').textContent = 'Point the camera at a CrowdNotes attendee QR code.';
  document.getElementById('scan-result').textContent = '';
}

function handleQRCode(code) {
  stopScan();
  if (!activeEvent) {
    document.getElementById('scan-result').textContent = 'Please select an event first.';
    return;
  }
  const found = allAttendees.find(a => a.id === code);
  if (found) {
    currentAttendee = found;
    showScreen('detail');
    renderDetail();
    showToast('Found: ' + found.name);
  } else {
    document.getElementById('scan-result').textContent = 'No attendee found for this QR code.';
    document.getElementById('btn-start-scan').style.display = 'block';
  }
}

// ── Pull-to-refresh ───────────────────────────────────────
(function() {
  const THRESHOLD = 72;

  const indicator = document.createElement('div');
  indicator.id = 'pull-indicator';
  indicator.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0',
    'display:flex', 'align-items:center', 'justify-content:center',
    'height:0', 'overflow:hidden',
    'background:var(--bg2)', 'color:var(--cyan)',
    "font-family:'DM Sans',sans-serif", 'font-size:14px', 'font-weight:500',
    'transition:height 0.1s ease',
    'z-index:9999', 'border-bottom:1px solid var(--bg3)'
  ].join(';');
  document.body.prepend(indicator);

  let startY = 0;
  let pulling = false;
  let activeScroller = null;

  function getActiveScroller() {
    const active = document.querySelector('.screen.active');
    if (!active) return null;
    return active.querySelector('.event-list, .attendee-list, #detail-content');
  }

  document.addEventListener('touchstart', e => {
    const scroller = getActiveScroller();
    if (!scroller) return;
    if (scroller.scrollTop === 0) {
      startY = e.touches[0].clientY;
      pulling = true;
      activeScroller = scroller;
    }
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!pulling || !activeScroller) return;
    if (activeScroller.scrollTop > 0) { pulling = false; indicator.style.height = '0'; return; }
    const dy = e.touches[0].clientY - startY;
    if (dy <= 0) { indicator.style.height = '0'; return; }
    const progress = Math.min(dy / THRESHOLD, 1);
    const h = Math.min(dy * 0.4, THRESHOLD * 0.6);
    indicator.style.height = h + 'px';
    indicator.textContent = progress >= 1 ? '↻  Release to refresh' : '↓  Pull to refresh';
  }, { passive: true });

  document.addEventListener('touchend', async e => {
    if (!pulling) return;
    pulling = false;
    activeScroller = null;
    const dy = e.changedTouches[0].clientY - startY;
    indicator.style.height = '0';
    indicator.textContent = '';

    if (dy < THRESHOLD) return;

    showToast('Refreshing…');
    const activeId = document.querySelector('.screen.active')?.id;
    if (activeId === 'screen-events') {
      await loadEvents();
    } else if (activeId === 'screen-attendees' && activeEvent) {
      await loadAttendees(activeEvent);
    } else if (activeId === 'screen-detail' && activeEvent) {
      await loadAttendees(activeEvent);
      if (currentAttendee) {
        currentAttendee = allAttendees.find(a => a.id === currentAttendee.id) || currentAttendee;
        renderDetail();
      }
    }
  });
})();

// ── Helpers ───────────────────────────────────────────────
function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}
