/* ============================================================
   Site Sheet — Construction Invoice Builder
   Pure client-side. No backend required (works on GitHub Pages).
   ============================================================ */

(() => {
  'use strict';

  // ---------- shorthand ----------
  const $ = (id) => document.getElementById(id);

  // ---------- rail fields ----------
  const companyName = $('companyName');
  const companyAddress = $('companyAddress');
  const companyContact = $('companyContact');
  const clientName = $('clientName');
  const clientAddress = $('clientAddress');
  const invoiceNumber = $('invoiceNumber');
  const invoiceDate = $('invoiceDate');
  const invoiceTitle = $('invoiceTitle');
  const footerNotes = $('footerNotes');
  const taxList = $('taxList');

  // ---------- number / currency format fields ----------
  const currencySymbolEl = $('currencySymbol');
  const currencyPositionEl = $('currencyPosition');
  const numberFormatPresetEl = $('numberFormatPreset');
  const customFormatFields = $('customFormatFields');
  const customThousandsSepEl = $('customThousandsSep');
  const customDecimalSepEl = $('customDecimalSep');
  const decimalPlacesEl = $('decimalPlaces');

  // ---------- sheet (live document) ----------
  const sectionsMount = $('sectionsMount');
  const sheetLogo = $('sheetLogo');
  const sheetCompanyName = $('sheetCompanyName');
  const sheetCompanyAddress = $('sheetCompanyAddress');
  const sheetCompanyContact = $('sheetCompanyContact');
  const sheetClientName = $('sheetClientName');
  const sheetClientAddress = $('sheetClientAddress');
  const sheetInvoiceTitle = $('sheetInvoiceTitle');
  const sheetFooterNotes = $('sheetFooterNotes');
  const summaryTable = $('summaryTable');
  const tbNumber = $('tbNumber');
  const tbDate = $('tbDate');

  // ---------- logo / terms controls ----------
  const logoDrop = $('logoDrop');
  const fileLogo = $('fileLogo');
  const logoPreview = $('logoPreview');
  const logoPlaceholder = $('logoPlaceholder');
  const btnRemoveLogo = $('btnRemoveLogo');

  const fileTerms = $('fileTerms');
  const termsFileNameEl = $('termsFileName');
  const btnRemoveTerms = $('btnRemoveTerms');

  const railStatus = $('railStatus');

  // ---------- transient (non-form) state ----------
  let logoDataUrl = null;
  let termsDataUrl = null;
  let termsFileName = '';

  // ============================================================
  // Utilities
  // ============================================================
  const todayISO = () => new Date().toISOString().slice(0, 10);

  const parseNum = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  // ---------- configurable number / currency format ----------
  const FORMAT_PRESETS = {
    'space-comma':       { thousandsSep: ' ', decimalSep: ',' },
    'comma-period':      { thousandsSep: ',', decimalSep: '.' },
    'period-comma':      { thousandsSep: '.', decimalSep: ',' },
    'apostrophe-period': { thousandsSep: "'", decimalSep: '.' },
    'none-period':       { thousandsSep: '', decimalSep: '.' },
  };
  const DEFAULT_SETTINGS = {
    currency: '€', currencyPosition: 'after',
    numberFormatPreset: 'space-comma',
    customThousandsSep: ' ', customDecimalSep: ',',
    decimals: 2,
  };
  let numFmt = { currency: '€', position: 'after', thousandsSep: ' ', decimalSep: ',', decimals: 2 };

  function readFormatSettingsFromUI() {
    numFmt.currency = currencySymbolEl.value;
    numFmt.position = currencyPositionEl.value;
    numFmt.decimals = Math.max(0, Math.min(4, parseInt(decimalPlacesEl.value, 10) || 0));
    const preset = numberFormatPresetEl.value;
    if (preset === 'custom') {
      numFmt.thousandsSep = customThousandsSepEl.value;
      numFmt.decimalSep = customDecimalSepEl.value;
    } else {
      const p = FORMAT_PRESETS[preset] || FORMAT_PRESETS['space-comma'];
      numFmt.thousandsSep = p.thousandsSep;
      numFmt.decimalSep = p.decimalSep;
    }
    customFormatFields.hidden = preset !== 'custom';
  }

  function applySettingsToUI(settings = {}) {
    const s = { ...DEFAULT_SETTINGS, ...settings };
    currencySymbolEl.value = s.currency;
    currencyPositionEl.value = s.currencyPosition;
    numberFormatPresetEl.value = s.numberFormatPreset;
    customThousandsSepEl.value = s.customThousandsSep;
    customDecimalSepEl.value = s.customDecimalSep;
    decimalPlacesEl.value = s.decimals;
    readFormatSettingsFromUI();
  }

  function formatMoney(n) {
    const num = Number(n) || 0;
    const neg = num < 0;
    const fixed = Math.abs(num).toFixed(numFmt.decimals);
    let [intPart, decPart] = fixed.split('.');
    if (numFmt.thousandsSep) {
      intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, numFmt.thousandsSep);
    }
    let numStr = numFmt.decimals > 0 ? `${intPart}${numFmt.decimalSep}${decPart}` : intPart;
    if (neg) numStr = '-' + numStr;
    if (!numFmt.currency) return numStr;
    return numFmt.position === 'before' ? `${numFmt.currency}${numStr}` : `${numStr} ${numFmt.currency}`;
  }

  const formatDateFr = (isoStr) => {
    if (!isoStr) return '—';
    const d = new Date(isoStr + 'T00:00:00');
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  let statusTimer = null;
  const setStatus = (msg, ttl = 2500) => {
    railStatus.textContent = msg;
    clearTimeout(statusTimer);
    if (ttl) statusTimer = setTimeout(() => { railStatus.textContent = ''; }, ttl);
  };

  const triggerDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const getImageDims = (dataUrl) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });

  const dataUrlToBytes = (dataUrl) => {
    const base64 = dataUrl.split(',')[1];
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  };

  // ============================================================
  // Section / item / tax row builders
  // ============================================================
  function createItemRow(data = {}) {
    const tr = $('tplItem').content.firstElementChild.cloneNode(true);
    tr.querySelector('.item-desc').value = data.desc || '';
    tr.querySelector('.item-qty').value = data.qty ?? 1;
    tr.querySelector('.item-unit').value = data.unit || '';
    tr.querySelector('.item-price').value = data.price ?? 0;
    updateItemTotal(tr);
    return tr;
  }

  function createSection(data = {}) {
    const card = $('tplSection').content.firstElementChild.cloneNode(true);
    card.querySelector('.section-title-input').value = data.title || '';
    card.querySelector('.section-desc-input').value = data.description || '';
    const body = card.querySelector('.items-body');
    const items = (data.items && data.items.length) ? data.items : [{}];
    items.forEach((it) => body.appendChild(createItemRow(it)));
    updateSectionTotal(card);
    return card;
  }

  function createTaxRow(data = {}) {
    const row = $('tplTax').content.firstElementChild.cloneNode(true);
    row.querySelector('.tax-label').value = data.label || '';
    row.querySelector('.tax-rate').value = data.rate ?? 0;
    return row;
  }

  function updateItemTotal(tr) {
    const qty = parseNum(tr.querySelector('.item-qty').value);
    const price = parseNum(tr.querySelector('.item-price').value);
    const total = qty * price;
    tr.querySelector('.item-line-total').textContent = formatMoney(total);
    return total;
  }

  function updateSectionTotal(card) {
    let sum = 0;
    card.querySelectorAll('tbody tr').forEach((tr) => { sum += updateItemTotal(tr); });
    card.querySelector('.section-total-value').textContent = formatMoney(sum);
    return sum;
  }

  // ============================================================
  // Summary / header sync
  // ============================================================
  function updateSummary() {
    let totalHT = 0;
    const sectionRows = [];
    sectionsMount.querySelectorAll('.section-card').forEach((card) => {
      const title = card.querySelector('.section-title-input').value || 'Untitled section';
      const total = updateSectionTotal(card);
      totalHT += total;
      sectionRows.push({ title, total });
    });

    const taxRows = Array.from(taxList.querySelectorAll('.tax-row')).map((row) => ({
      label: row.querySelector('.tax-label').value || 'Taxe',
      rate: parseNum(row.querySelector('.tax-rate').value),
    }));

    let ttc = totalHT;
    let html = '';
    sectionRows.forEach((s) => {
      html += `<tr><td>${escapeHtml(s.title)}</td><td>${formatMoney(s.total)}</td></tr>`;
    });
    html += `<tr class="total-ht"><td>TOTAL HT</td><td>${formatMoney(totalHT)}</td></tr>`;
    taxRows.forEach((t) => {
      const amt = totalHT * (t.rate / 100);
      ttc += amt;
      html += `<tr><td>${escapeHtml(t.label)} ${t.rate}%</td><td>${formatMoney(amt)}</td></tr>`;
    });
    html += `<tr class="total-ttc"><td>TOTAL TTC</td><td>${formatMoney(ttc)}</td></tr>`;
    summaryTable.innerHTML = html;
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
  }

  function syncHeader() {
    sheetCompanyName.textContent = companyName.value || 'Company Name';
    sheetCompanyAddress.textContent = companyAddress.value;
    sheetCompanyContact.textContent = companyContact.value;
    sheetClientName.textContent = clientName.value || 'Client';
    sheetClientAddress.textContent = clientAddress.value;
    sheetInvoiceTitle.textContent =
      `Devis Numéro ${invoiceNumber.value || '—'} du ${formatDateFr(invoiceDate.value)}` +
      (invoiceTitle.value ? ` — ${invoiceTitle.value}` : '');
    sheetFooterNotes.textContent = footerNotes.value;
    tbNumber.textContent = invoiceNumber.value || '—';
    tbDate.textContent = formatDateFr(invoiceDate.value);
  }

  function refreshLogoUI() {
    if (logoDataUrl) {
      logoPreview.src = logoDataUrl;
      logoPreview.hidden = false;
      logoPlaceholder.hidden = true;
      btnRemoveLogo.hidden = false;
      sheetLogo.src = logoDataUrl;
      sheetLogo.hidden = false;
    } else {
      logoPreview.hidden = true;
      logoPreview.src = '';
      logoPlaceholder.hidden = false;
      btnRemoveLogo.hidden = true;
      sheetLogo.hidden = true;
      sheetLogo.src = '';
    }
  }

  function refreshTermsUI() {
    if (termsFileName) {
      termsFileNameEl.textContent = `Attached: ${termsFileName}`;
      btnRemoveTerms.hidden = false;
    } else {
      termsFileNameEl.textContent = '';
      btnRemoveTerms.hidden = true;
    }
  }

  // ============================================================
  // State collect / populate  (drives Save Data / Load Data)
  // ============================================================
  function collectState() {
    const sections = Array.from(sectionsMount.querySelectorAll('.section-card')).map((card) => ({
      title: card.querySelector('.section-title-input').value,
      description: card.querySelector('.section-desc-input').value,
      items: Array.from(card.querySelectorAll('tbody tr')).map((tr) => ({
        desc: tr.querySelector('.item-desc').value,
        qty: parseNum(tr.querySelector('.item-qty').value),
        unit: tr.querySelector('.item-unit').value,
        price: parseNum(tr.querySelector('.item-price').value),
      })),
    }));

    const taxes = Array.from(taxList.querySelectorAll('.tax-row')).map((row) => ({
      label: row.querySelector('.tax-label').value,
      rate: parseNum(row.querySelector('.tax-rate').value),
    }));

    return {
      _format: 'site-sheet-invoice',
      _version: 1,
      company: { name: companyName.value, address: companyAddress.value, contact: companyContact.value, logo: logoDataUrl || null },
      client: { name: clientName.value, address: clientAddress.value },
      invoice: { number: invoiceNumber.value, date: invoiceDate.value, title: invoiceTitle.value },
      sections,
      taxes,
      footerNotes: footerNotes.value,
      terms: termsDataUrl ? { name: termsFileName, data: termsDataUrl } : null,
      settings: {
        currency: currencySymbolEl.value,
        currencyPosition: currencyPositionEl.value,
        numberFormatPreset: numberFormatPresetEl.value,
        customThousandsSep: customThousandsSepEl.value,
        customDecimalSep: customDecimalSepEl.value,
        decimals: numFmt.decimals,
      },
    };
  }

  function populateFromState(state = {}) {
    applySettingsToUI(state.settings || {});

    companyName.value = state.company?.name || '';
    companyAddress.value = state.company?.address || '';
    companyContact.value = state.company?.contact || '';
    logoDataUrl = state.company?.logo || null;
    refreshLogoUI();

    clientName.value = state.client?.name || '';
    clientAddress.value = state.client?.address || '';

    invoiceNumber.value = state.invoice?.number || '';
    invoiceDate.value = state.invoice?.date || todayISO();
    invoiceTitle.value = state.invoice?.title || '';

    sectionsMount.innerHTML = '';
    (state.sections && state.sections.length ? state.sections : [{}]).forEach((sec) => {
      sectionsMount.appendChild(createSection(sec));
    });

    taxList.innerHTML = '';
    (state.taxes && state.taxes.length ? state.taxes : [{ label: 'TVA', rate: 10 }]).forEach((t) => {
      taxList.appendChild(createTaxRow(t));
    });

    footerNotes.value = state.footerNotes || '';

    termsDataUrl = state.terms?.data || null;
    termsFileName = state.terms?.name || '';
    refreshTermsUI();

    syncHeader();
    updateSummary();
  }

  // ============================================================
  // PDF generation
  // ============================================================
  function ensureSpace(doc, y, needed, pageH) {
    if (y + needed > pageH - 50) {
      doc.addPage();
      return 50;
    }
    return y;
  }

  async function mergeWithTerms(mainBytes, termsBytes) {
    const mainDoc = await PDFLib.PDFDocument.load(mainBytes);
    const termsDoc = await PDFLib.PDFDocument.load(termsBytes);
    const copied = await mainDoc.copyPages(termsDoc, termsDoc.getPageIndices());
    copied.forEach((p) => mainDoc.addPage(p));
    return mainDoc.save();
  }

  async function generatePdf() {
    const state = collectState();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginL = 40, marginR = 40;
    let y = 44;

    // ---- letterhead logo ----
    if (state.company.logo) {
      try {
        const fmt = state.company.logo.includes('image/png') ? 'PNG' : 'JPEG';
        const dims = await getImageDims(state.company.logo);
        const maxW = 160, maxH = 60;
        const scale = Math.min(maxW / dims.w, maxH / dims.h, 1);
        doc.addImage(state.company.logo, fmt, marginL, y, dims.w * scale, dims.h * scale);
      } catch (e) { /* ignore image errors, continue */ }
    }

    // ---- company block (right aligned) ----
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text(state.company.name || '', pageW - marginR, y + 10, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    let hy = y + 24;
    (state.company.address || '').split('\n').filter(Boolean).forEach((line) => {
      doc.text(line, pageW - marginR, hy, { align: 'right' }); hy += 11;
    });
    (state.company.contact || '').split('\n').filter(Boolean).forEach((line) => {
      doc.text(line, pageW - marginR, hy, { align: 'right' }); hy += 11;
    });
    y = Math.max(y + 74, hy + 14);

    // ---- client box ----
    doc.setDrawColor(30, 45, 60); doc.setLineWidth(1);
    const boxW = 220;
    const clientLines = (state.client.address || '').split('\n').filter(Boolean);
    const boxH = 30 + clientLines.length * 12;
    const boxX = pageW - marginR - boxW, boxY = y;
    doc.rect(boxX, boxY, boxW, boxH);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text(state.client.name || '', boxX + 10, boxY + 17);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    let cy = boxY + 31;
    clientLines.forEach((l) => { doc.text(l, boxX + 10, cy); cy += 12; });

    y = boxY + boxH + 28;

    // ---- title ----
    doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(11);
    const titleText = `Devis Numéro ${state.invoice.number || ''} du ${formatDateFr(state.invoice.date)}` +
      (state.invoice.title ? ` ${state.invoice.title}` : '');
    const titleLines = doc.splitTextToSize(titleText, pageW - marginL - marginR - 80);
    titleLines.forEach((line) => { doc.text(line, pageW / 2, y, { align: 'center' }); y += 14; });
    y += 8;

    // ---- sections ----
    const sectionTotals = [];
    state.sections.forEach((sec) => {
      y = ensureSpace(doc, y, 70, pageH);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text(`${sec.title || 'Section'}:`, marginL, y);
      y += 4;

      if (sec.description) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
        const descLines = doc.splitTextToSize(sec.description, pageW - marginL - marginR);
        descLines.forEach((l) => { y += 12; doc.text(l, marginL, y); });
      }

      let total = 0;
      const body = sec.items.map((it) => {
        const t = (parseNum(it.qty)) * (parseNum(it.price));
        total += t;
        return [it.desc || '', String(it.qty ?? 0), it.unit || '', formatMoney(it.price), formatMoney(t)];
      });
      sectionTotals.push({ title: sec.title || 'Section', total });

      doc.autoTable({
        startY: y + 8,
        margin: { left: marginL, right: marginR },
        head: [['Intitulé', 'Qté', 'Unité', 'Prix U.', 'Montant HT']],
        body,
        foot: [['', '', '', 'TOTAL HT', formatMoney(total)]],
        styles: { font: 'helvetica', fontSize: 9, cellPadding: 5, lineColor: [30, 45, 60], lineWidth: 0.5, valign: 'top' },
        headStyles: { fillColor: [22, 48, 79], textColor: 255, fontStyle: 'bold' },
        footStyles: { fillColor: [239, 233, 217], textColor: 20, fontStyle: 'bold' },
        columnStyles: {
          1: { halign: 'right', cellWidth: 40 },
          2: { cellWidth: 50 },
          3: { halign: 'right', cellWidth: 70 },
          4: { halign: 'right', cellWidth: 85 },
        },
      });
      y = doc.lastAutoTable.finalY + 20;
    });

    // ---- summary ----
    y = ensureSpace(doc, y, 100, pageH);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('Récapitulatif', marginL, y);
    y += 8;

    const totalHT = sectionTotals.reduce((s, x) => s + x.total, 0);
    let ttc = totalHT;
    const summaryBody = sectionTotals.map((s) => [s.title, formatMoney(s.total)]);
    summaryBody.push(['TOTAL HT', formatMoney(totalHT)]);
    state.taxes.forEach((t) => {
      const amt = totalHT * (parseNum(t.rate) / 100);
      ttc += amt;
      summaryBody.push([`${t.label || 'Taxe'} ${t.rate || 0}%`, formatMoney(amt)]);
    });
    summaryBody.push(['TOTAL TTC', formatMoney(ttc)]);

    doc.autoTable({
      startY: y + 6,
      margin: { left: marginL, right: marginR },
      body: summaryBody,
      styles: { font: 'helvetica', fontSize: 10, cellPadding: 6, lineColor: [30, 45, 60], lineWidth: 0.5 },
      columnStyles: { 0: { cellWidth: 'auto' }, 1: { halign: 'right', cellWidth: 120 } },
      didParseCell: (data) => {
        const label = data.row.raw[0];
        if (label === 'TOTAL HT') {
          data.cell.styles.fillColor = [239, 233, 217];
          data.cell.styles.fontStyle = 'bold';
        }
        if (label === 'TOTAL TTC') {
          data.cell.styles.fillColor = [225, 89, 12];
          data.cell.styles.textColor = 255;
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 11;
        }
      },
    });
    y = doc.lastAutoTable.finalY + 24;

    // ---- footer notes ----
    if (state.footerNotes) {
      y = ensureSpace(doc, y, 40, pageH);
      doc.setDrawColor(190, 180, 150);
      doc.line(marginL, y, pageW - marginR, y);
      y += 12;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      const lines = doc.splitTextToSize(state.footerNotes, pageW - marginL - marginR);
      lines.forEach((l) => {
        y = ensureSpace(doc, y, 12, pageH);
        doc.text(l, marginL, y);
        y += 11;
      });
    }

    // ---- title block ----
    y = ensureSpace(doc, y, 24, pageH);
    doc.setFont('courier', 'normal'); doc.setFontSize(8);
    doc.text(`N° ${state.invoice.number || '—'}   •   ${formatDateFr(state.invoice.date)}   •   RÉV. A`,
      pageW - marginR, y, { align: 'right' });

    let bytes = doc.output('arraybuffer');

    if (state.terms && state.terms.data) {
      bytes = await mergeWithTerms(bytes, dataUrlToBytes(state.terms.data));
    }

    triggerDownload(new Blob([bytes], { type: 'application/pdf' }), `InvoiceMe-${state.invoice.number || 'draft'}.pdf`);
  }

  // ============================================================
  // Event wiring
  // ============================================================

  // header fields -> live sheet sync
  [companyName, companyAddress, companyContact, clientName, clientAddress,
    invoiceNumber, invoiceDate, invoiceTitle, footerNotes].forEach((el) => {
    el.addEventListener('input', () => { syncHeader(); setStatus('Unsaved changes'); });
  });

  // number / currency format
  [currencySymbolEl, currencyPositionEl, numberFormatPresetEl, customThousandsSepEl,
    customDecimalSepEl, decimalPlacesEl].forEach((el) => {
    el.addEventListener('input', () => {
      readFormatSettingsFromUI();
      updateSummary();
      setStatus('Unsaved changes');
    });
  });

  // sections (event delegation)
  sectionsMount.addEventListener('input', (e) => {
    if (e.target.matches('.item-qty, .item-price')) {
      const tr = e.target.closest('tr');
      updateItemTotal(tr);
      updateSectionTotal(tr.closest('.section-card'));
    }
    updateSummary();
    setStatus('Unsaved changes');
  });

  sectionsMount.addEventListener('click', (e) => {
    const card = e.target.closest('.section-card');
    if (e.target.classList.contains('btn-add-item')) {
      card.querySelector('.items-body').appendChild(createItemRow({}));
      updateSummary();
    } else if (e.target.classList.contains('btn-remove-item')) {
      const tr = e.target.closest('tr');
      const c = tr.closest('.section-card');
      tr.remove();
      updateSectionTotal(c);
      updateSummary();
    } else if (e.target.classList.contains('btn-remove-section')) {
      card.remove();
      updateSummary();
    } else if (e.target.classList.contains('btn-move-up')) {
      const prev = card.previousElementSibling;
      if (prev) sectionsMount.insertBefore(card, prev);
    } else if (e.target.classList.contains('btn-move-down')) {
      const next = card.nextElementSibling;
      if (next) sectionsMount.insertBefore(next, card);
    }
    setStatus('Unsaved changes');
  });

  $('btnAddSection').addEventListener('click', () => {
    sectionsMount.appendChild(createSection({}));
    updateSummary();
    setStatus('Unsaved changes');
  });

  // taxes
  taxList.addEventListener('input', () => { updateSummary(); setStatus('Unsaved changes'); });
  taxList.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-remove-tax')) {
      e.target.closest('.tax-row').remove();
      updateSummary();
      setStatus('Unsaved changes');
    }
  });
  $('btnAddTax').addEventListener('click', () => {
    taxList.appendChild(createTaxRow({ label: '', rate: 0 }));
    updateSummary();
  });

  // logo
  function handleLogoFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      logoDataUrl = reader.result;
      refreshLogoUI();
      setStatus('Logo added');
    };
    reader.readAsDataURL(file);
  }
  logoDrop.addEventListener('click', () => fileLogo.click());
  logoDrop.addEventListener('dragover', (e) => e.preventDefault());
  logoDrop.addEventListener('drop', (e) => {
    e.preventDefault();
    handleLogoFile(e.dataTransfer.files[0]);
  });
  fileLogo.addEventListener('change', (e) => handleLogoFile(e.target.files[0]));
  btnRemoveLogo.addEventListener('click', (e) => {
    e.stopPropagation();
    logoDataUrl = null;
    fileLogo.value = '';
    refreshLogoUI();
    setStatus('Unsaved changes');
  });

  // terms pdf
  fileTerms.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      termsDataUrl = reader.result;
      termsFileName = file.name;
      refreshTermsUI();
      setStatus('Terms PDF attached');
    };
    reader.readAsDataURL(file);
  });
  btnRemoveTerms.addEventListener('click', () => {
    termsDataUrl = null;
    termsFileName = '';
    fileTerms.value = '';
    refreshTermsUI();
    setStatus('Unsaved changes');
  });

  // top-level actions
  $('btnNew').addEventListener('click', () => {
    if (confirm('Start a new invoice? Unsaved changes will be lost.')) {
      populateFromState({ invoice: { date: todayISO() } });
      setStatus('New invoice ready');
    }
  });

  $('btnSaveData').addEventListener('click', () => {
    const state = collectState();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    triggerDownload(blob, `InvoiceMe-data-${state.invoice.number || 'draft'}.json`);
    setStatus('Data saved ✓');
  });

  $('fileLoadData').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const state = JSON.parse(reader.result);
        populateFromState(state);
        setStatus('Data loaded ✓');
      } catch (err) {
        alert('That file could not be read as invoice data (invalid JSON).');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  $('btnGeneratePdf').addEventListener('click', async () => {
    setStatus('Generating PDF…', 0);
    try {
      await generatePdf();
      setStatus('PDF generated ✓');
    } catch (err) {
      console.error(err);
      setStatus('');
      alert('Something went wrong generating the PDF. Check the console for details.');
    }
  });

  // ============================================================
  // Init
  // ============================================================
  populateFromState({ invoice: { date: todayISO() } });
})();
