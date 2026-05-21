// CrowdNotes — Badge printing (Avery 8395 / 4" x 3", 2×4 per page)

async function printBadges() {
  if (!activeEvent) { showToast('No active event'); return; }
  if (!allAttendees?.length) { showToast('No attendees loaded'); return; }

  // Open window IMMEDIATELY (synchronous, before any await) to satisfy popup blocker
  const win = window.open('', '_blank');
  if (!win) { showToast('Pop-up blocked — allow pop-ups for this site and try again'); return; }

  // Show a loading state while QR codes generate
  win.document.write('<html><body style="font-family:sans-serif;padding:40px;color:#555;">Generating badges…</body></html>');

  showToast('Generating badges…');

  // Sort alphabetically
  const sorted = [...allAttendees].sort((a, b) => a.name.localeCompare(b.name));

  // Generate QR data URLs for every attendee (encode email, fall back to name)
  const qrSize = 300; // high-res for print
  const qrDataURLs = await Promise.all(sorted.map(a => {
    const payload = a.email || a.name;
    return new Promise(resolve => {
      QRCode.toDataURL(payload, {
        width: qrSize, margin: 1,
        color: { dark: '#000000', light: '#ffffff' }
      }, (err, url) => resolve(err ? '' : url));
    });
  }));

  // Color tag mapping
  const tagColor = { red: '#ef4444', blue: '#3b82f6' };

  // Build badge HTML for each attendee
  const badgesHTML = sorted.map((a, i) => {
    const qr = qrDataURLs[i];
    const color = tagColor[a.colorTag] || null;
    const colorDot = color
      ? `<div style="width:36px;height:36px;border-radius:50%;background:${color};flex-shrink:0;"></div>`
      : `<div style="width:36px;height:36px;flex-shrink:0;"></div>`;

    return `
      <div class="badge">
        <div class="badge-event">${escapeHTML(activeEvent.name)}</div>
        <div class="badge-name">${escapeHTML(a.name)}</div>
        <div class="badge-footer">
          ${qr ? `<img class="badge-qr" src="${qr}" alt="QR">` : '<div class="badge-qr"></div>'}
          ${colorDot}
        </div>
      </div>`;
  }).join('');

  function escapeHTML(s) {
    return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Badges — ${escapeHTML(activeEvent.name)}</title>
  <style>
    /* ── Avery 8395: 4" × 3", 2 columns × 4 rows, 8 per page
       Sheet: 8.5" × 11"
       Top margin: 0.5"  Left margin: 0.19"
       Label width: 4"   Label height: 3"
       Horizontal gap: 0.125"  Vertical gap: 0.25"         */

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      width: 8.5in;
      padding: 0.5in 0.19in 0 0.19in;
      display: grid;
      grid-template-columns: 4in 4in;
      grid-template-rows: repeat(4, 3in);
      column-gap: 0.125in;
      row-gap: 0.25in;
      page-break-after: always;
    }

    .badge {
      width: 4in;
      height: 3in;
      padding: 0.18in 0.22in 0.16in 0.22in;
      border: 0.5px dashed #ccc;   /* guide line — not printed on laser */
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
    }

    .badge-event {
      font-size: 9.5pt;
      color: #888;
      letter-spacing: 0.2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .badge-name {
      font-size: 28pt;
      font-weight: 600;
      color: #111;
      line-height: 1.15;
      flex: 1;
      display: flex;
      align-items: center;
      overflow: hidden;
      word-break: break-word;
    }

    .badge-footer {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
    }

    .badge-qr {
      width: 0.85in;
      height: 0.85in;
      flex-shrink: 0;
    }

    /* ── Screen preview styles (overridden at print) ── */
    @media screen {
      body {
        background: #f0f0f0;
        padding: 24px;
      }
      .page {
        background: #fff;
        box-shadow: 0 2px 16px rgba(0,0,0,0.15);
        margin: 0 auto 32px auto;
      }
      .print-hint {
        text-align: center;
        font-family: -apple-system, sans-serif;
        font-size: 14px;
        color: #555;
        margin-bottom: 20px;
      }
      .print-hint strong { color: #111; }
    }

    /* ── Print: hide dashes, enforce exact dimensions ── */
    @media print {
      body { background: #fff; padding: 0; }
      .print-hint { display: none; }
      .page {
        box-shadow: none;
        margin: 0;
        page-break-after: always;
      }
      .badge { border-color: transparent; }
    }

    @page {
      size: letter;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="print-hint">
    <strong>${escapeHTML(activeEvent.name)}</strong> — ${sorted.length} badge${sorted.length !== 1 ? 's' : ''}
    &nbsp;·&nbsp; Set printer margins to <strong>None</strong> for accurate Avery 8395 alignment
    &nbsp;·&nbsp; <button onclick="window.print()" style="padding:6px 16px;border-radius:6px;border:1px solid #ccc;background:#fff;cursor:pointer;font-size:13px;">🖨 Print</button>
  </div>
  ${chunkPages(badgesHTML, 8)}
</body>
</html>`;

  const win2 = win; // already open
  win2.document.open();
  win2.document.write(html);
  win2.document.close();
}

function chunkPages(badgesHTML, perPage) {
  // Split flat badge HTML into page divs of N badges each
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${badgesHTML}</div>`, 'text/html');
  const badges = [...doc.querySelector('div').children];
  let pages = '';
  for (let i = 0; i < badges.length; i += perPage) {
    const chunk = badges.slice(i, i + perPage).map(b => b.outerHTML).join('');
    pages += `<div class="page">${chunk}</div>`;
  }
  return pages;
}
