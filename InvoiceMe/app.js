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
  const langSelect = $('langSelect');

  // ---------- transient (non-form) state ----------
  let logoDataUrl = null;
  let termsDataUrl = null;
  let termsFileName = '';

  // ============================================================
  // i18n — French by default, English optional
  // ============================================================
  const I18N = {
    fr: {
      topbar_tagline: 'Facturation BTP',
      lang_label: 'Langue',
      btn_new: 'Nouveau',
      btn_new_title: 'Effacer tout et commencer un nouveau devis',
      btn_load: 'Charger des données',
      btn_load_title: 'Charger un fichier de données .json précédemment enregistré',
      btn_save: 'Enregistrer',
      btn_save_title: "Télécharger les données de ce devis au format .json",
      btn_generate: 'Générer le PDF',
      btn_generate_title: 'Générer le PDF final du devis',
      grp_letterhead: 'En-tête',
      lbl_logo: "Logo / image d'en-tête",
      logo_drop_hint: 'Cliquez ou déposez une image',
      btn_remove_logo: 'Supprimer le logo',
      grp_company: 'Entreprise',
      lbl_company_name: "Nom de l'entreprise",
      ph_company_name: 'ex. Well Conception',
      lbl_address: 'Adresse',
      lbl_contact_line: 'Ligne de contact',
      grp_billto: 'Facturer à',
      lbl_client_name: 'Nom du client',
      ph_client_name: 'ex. Mme ARFA',
      lbl_client_address: 'Adresse du client',
      grp_invoice: 'Détails du devis',
      lbl_invoice_number: 'Numéro de devis',
      lbl_date: 'Date',
      lbl_invoice_title: 'Titre / description',
      ph_invoice_title: "correspondant aux travaux d'un appartement & un studio",
      grp_format: 'Format des nombres & devise',
      lbl_currency: 'Symbole / code de la devise',
      lbl_currency_position: 'Position du symbole',
      opt_after: 'Après le montant — 1 234,56 €',
      opt_before: 'Avant le montant — €1,234.56',
      lbl_number_format: 'Format des nombres',
      opt_space_comma: '1 234,56 — espace · virgule',
      opt_comma_period: '1,234.56 — virgule · point',
      opt_period_comma: '1.234,56 — point · virgule',
      opt_apostrophe_period: "1'234.56 — apostrophe · point",
      opt_none_period: '1234.56 — aucun · point',
      opt_custom: 'Personnalisé…',
      lbl_thousands_sep: 'Séparateur des milliers',
      opt_sep_space: 'Espace',
      opt_sep_comma: 'Virgule',
      opt_sep_period: 'Point',
      opt_sep_apostrophe: 'Apostrophe',
      opt_sep_none: 'Aucun',
      lbl_decimal_sep: 'Séparateur décimal',
      lbl_decimals: 'Nombre de décimales',
      grp_taxes: 'Taxes',
      btn_add_tax: '+ Ajouter une taxe',
      grp_footer: 'Notes de bas de page',
      lbl_footer_notes: 'Infos bancaires / légales / paiement',
      ph_footer_notes: 'IBAN, BIC, SIREN, conditions de paiement, etc.',
      grp_terms: 'PDF de conditions joint',
      terms_hint: 'Optionnel. Ses pages seront ajoutées après le devis — pour les mentions légales, CGV, ou une page de signature.',
      btn_choose_pdf: 'Choisir un PDF',
      btn_remove_terms: 'Supprimer le PDF joint',
      terms_attached_prefix: 'Joint : ',
      btn_add_section: '+ Ajouter une section',
      toolbar_hint: 'Les sections deviennent des tableaux dans le PDF, dans cet ordre.',
      sheet_company_placeholder: "Nom de l'entreprise",
      sheet_client_placeholder: 'Client',
      recap_label: 'Récapitulatif',
      tb_no: 'N°',
      tb_date: 'DATE',
      tb_rev: 'RÉV',
      section_title_placeholder: 'Titre de la section (ex. Plomberie)',
      section_desc_placeholder: 'Description / notes de section (facultatif)',
      tooltip_move_up: 'Déplacer vers le haut',
      tooltip_move_down: 'Déplacer vers le bas',
      tooltip_remove_section: 'Supprimer la section',
      tooltip_remove_item: 'Supprimer la ligne',
      tooltip_remove_tax: 'Supprimer la taxe',
      col_desc: 'Intitulé',
      col_qty: 'Qté',
      col_unit: 'Unité',
      col_price: 'Prix U.',
      col_amount_ht: 'Montant HT',
      btn_add_item: '+ Ajouter une ligne',
      section_total_label: 'Total de la section :',
      item_desc_placeholder: 'Description',
      untitled_section: 'Section sans titre',
      total_ht: 'TOTAL HT',
      total_ttc: 'TOTAL TTC',
      status_unsaved: 'Modifications non enregistrées',
      status_logo_added: 'Logo ajouté',
      status_terms_attached: 'PDF de conditions joint',
      status_data_saved: 'Données enregistrées ✓',
      status_data_loaded: 'Données chargées ✓',
      status_new_ready: 'Nouveau devis prêt',
      status_generating: 'Génération du PDF…',
      status_pdf_generated: 'PDF généré ✓',
      confirm_new: 'Commencer un nouveau devis ? Les modifications non enregistrées seront perdues.',
      alert_bad_json: "Ce fichier n'a pas pu être lu comme données de devis (JSON invalide).",
      alert_pdf_error: 'Une erreur est survenue lors de la génération du PDF. Consultez la console pour plus de détails.',
      devis_word: 'Devis Numéro',
      devis_connector: 'du',
    },
    en: {
      topbar_tagline: 'Construction Invoicing',
      lang_label: 'Language',
      btn_new: 'New',
      btn_new_title: 'Clear everything and start a new invoice',
      btn_load: 'Load Data',
      btn_load_title: 'Load a previously saved .json data file',
      btn_save: 'Save Data',
      btn_save_title: "Download this invoice's data as a .json file",
      btn_generate: 'Generate PDF',
      btn_generate_title: 'Generate the final invoice PDF',
      grp_letterhead: 'Letterhead',
      lbl_logo: 'Logo / title image',
      logo_drop_hint: 'Click or drop an image',
      btn_remove_logo: 'Remove logo',
      grp_company: 'Company',
      lbl_company_name: 'Company name',
      ph_company_name: 'e.g. Well Conception',
      lbl_address: 'Address',
      lbl_contact_line: 'Contact line',
      grp_billto: 'Bill To',
      lbl_client_name: 'Client name',
      ph_client_name: 'e.g. Mme ARFA',
      lbl_client_address: 'Client address',
      grp_invoice: 'Invoice details',
      lbl_invoice_number: 'Invoice number',
      lbl_date: 'Date',
      lbl_invoice_title: 'Title / description',
      ph_invoice_title: 'for the renovation of an apartment & a studio',
      grp_format: 'Number & currency format',
      lbl_currency: 'Currency symbol / code',
      lbl_currency_position: 'Symbol position',
      opt_after: 'After amount — 1 234,56 €',
      opt_before: 'Before amount — €1,234.56',
      lbl_number_format: 'Number format',
      opt_space_comma: '1 234,56 — space · comma',
      opt_comma_period: '1,234.56 — comma · period',
      opt_period_comma: '1.234,56 — period · comma',
      opt_apostrophe_period: "1'234.56 — apostrophe · period",
      opt_none_period: '1234.56 — none · period',
      opt_custom: 'Custom…',
      lbl_thousands_sep: 'Thousands separator',
      opt_sep_space: 'Space',
      opt_sep_comma: 'Comma',
      opt_sep_period: 'Period',
      opt_sep_apostrophe: 'Apostrophe',
      opt_sep_none: 'None',
      lbl_decimal_sep: 'Decimal separator',
      lbl_decimals: 'Decimal places',
      grp_taxes: 'Taxes',
      btn_add_tax: '+ Add tax line',
      grp_footer: 'Footer notes',
      lbl_footer_notes: 'Bank / legal / payment info',
      ph_footer_notes: 'IBAN, BIC, SIREN, payment terms, etc.',
      grp_terms: 'Attached terms PDF',
      terms_hint: 'Optional. Its pages are appended after the invoice — for legal language, T&Cs, or a signature page.',
      btn_choose_pdf: 'Choose PDF',
      btn_remove_terms: 'Remove attached PDF',
      terms_attached_prefix: 'Attached: ',
      btn_add_section: '+ Add Section',
      toolbar_hint: 'Sections become tables on the PDF, in this order.',
      sheet_company_placeholder: 'Company Name',
      sheet_client_placeholder: 'Client',
      recap_label: 'Summary',
      tb_no: 'NO.',
      tb_date: 'DATE',
      tb_rev: 'REV',
      section_title_placeholder: 'Section title (e.g. Plumbing)',
      section_desc_placeholder: 'Optional section description / notes',
      tooltip_move_up: 'Move up',
      tooltip_move_down: 'Move down',
      tooltip_remove_section: 'Remove section',
      tooltip_remove_item: 'Remove line',
      tooltip_remove_tax: 'Remove tax',
      col_desc: 'Description',
      col_qty: 'Qty',
      col_unit: 'Unit',
      col_price: 'Unit price',
      col_amount_ht: 'Amount (excl. tax)',
      btn_add_item: '+ Add line item',
      section_total_label: 'Section total:',
      item_desc_placeholder: 'Description',
      untitled_section: 'Untitled section',
      total_ht: 'SUBTOTAL (excl. tax)',
      total_ttc: 'TOTAL (incl. tax)',
      status_unsaved: 'Unsaved changes',
      status_logo_added: 'Logo added',
      status_terms_attached: 'Terms PDF attached',
      status_data_saved: 'Data saved ✓',
      status_data_loaded: 'Data loaded ✓',
      status_new_ready: 'New invoice ready',
      status_generating: 'Generating PDF…',
      status_pdf_generated: 'PDF generated ✓',
      confirm_new: 'Start a new invoice? Unsaved changes will be lost.',
      alert_bad_json: 'That file could not be read as invoice data (invalid JSON).',
      alert_pdf_error: 'Something went wrong generating the PDF. Check the console for details.',
      devis_word: 'Invoice No.',
      devis_connector: 'dated',
    },
  };

  let currentLang = 'fr';
  const t = (key) => (I18N[currentLang] && I18N[currentLang][key]) ?? I18N.fr[key] ?? key;

  function localize(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  }

  function setLanguage(lang) {
    currentLang = (lang === 'en') ? 'en' : 'fr';
    document.documentElement.lang = currentLang;
    langSelect.value = currentLang;
    localize(document);
    try { localStorage.setItem('invoiceme-lang', currentLang); } catch (e) { /* storage unavailable, ignore */ }
    syncHeader();
    updateSummary();
    refreshTermsUI();
  }

  langSelect.addEventListener('change', (e) => setLanguage(e.target.value));

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

  const formatDate = (isoStr) => {
    if (!isoStr) return '—';
    const d = new Date(isoStr + 'T00:00:00');
    if (isNaN(d.getTime())) return isoStr;
    const locale = currentLang === 'fr' ? 'fr-FR' : 'en-GB';
    return d.toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' });
  };

  function invoiceHeadingText(number, date, title) {
    const num = number || '—';
    const d = formatDate(date);
    return `${t('devis_word')} ${num} ${t('devis_connector')} ${d}` + (title ? ` — ${title}` : '');
  }

  function titleBlockLine(number, date) {
    const num = number || '—';
    const d = formatDate(date);
    return currentLang === 'fr'
      ? `N° ${num}   •   ${d}   •   RÉV. A`
      : `No. ${num}   •   ${d}   •   REV. A`;
  }

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
    localize(tr);
    tr.querySelector('.item-desc').value = data.desc || '';
    tr.querySelector('.item-qty').value = data.qty ?? 1;
    tr.querySelector('.item-unit').value = data.unit || '';
    tr.querySelector('.item-price').value = data.price ?? 0;
    updateItemTotal(tr);
    return tr;
  }

  function createSection(data = {}) {
    const card = $('tplSection').content.firstElementChild.cloneNode(true);
    localize(card);
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
    localize(row);
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
      const title = card.querySelector('.section-title-input').value || t('untitled_section');
      const total = updateSectionTotal(card);
      totalHT += total;
      sectionRows.push({ title, total });
    });

    const taxRows = Array.from(taxList.querySelectorAll('.tax-row')).map((row) => ({
      label: row.querySelector('.tax-label').value || 'Tax',
      rate: parseNum(row.querySelector('.tax-rate').value),
    }));

    let ttc = totalHT;
    let html = '';
    sectionRows.forEach((s) => {
      html += `<tr><td>${escapeHtml(s.title)}</td><td>${formatMoney(s.total)}</td></tr>`;
    });
    html += `<tr class="total-ht"><td>${t('total_ht')}</td><td>${formatMoney(totalHT)}</td></tr>`;
    taxRows.forEach((t2) => {
      const amt = totalHT * (t2.rate / 100);
      ttc += amt;
      html += `<tr><td>${escapeHtml(t2.label)} ${t2.rate}%</td><td>${formatMoney(amt)}</td></tr>`;
    });
    html += `<tr class="total-ttc"><td>${t('total_ttc')}</td><td>${formatMoney(ttc)}</td></tr>`;
    summaryTable.innerHTML = html;
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
  }

  function syncHeader() {
    sheetCompanyName.textContent = companyName.value || t('sheet_company_placeholder');
    sheetCompanyAddress.textContent = companyAddress.value;
    sheetCompanyContact.textContent = companyContact.value;
    sheetClientName.textContent = clientName.value || t('sheet_client_placeholder');
    sheetClientAddress.textContent = clientAddress.value;
    sheetInvoiceTitle.textContent = invoiceHeadingText(invoiceNumber.value, invoiceDate.value, invoiceTitle.value);
    sheetFooterNotes.textContent = footerNotes.value;
    tbNumber.textContent = invoiceNumber.value || '—';
    tbDate.textContent = formatDate(invoiceDate.value);
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
      termsFileNameEl.textContent = `${t('terms_attached_prefix')}${termsFileName}`;
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
    (state.taxes && state.taxes.length ? state.taxes : [{ label: 'TVA', rate: 10 }]).forEach((tx) => {
      taxList.appendChild(createTaxRow(tx));
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
    const titleText = invoiceHeadingText(state.invoice.number, state.invoice.date, state.invoice.title);
    const titleLines = doc.splitTextToSize(titleText, pageW - marginL - marginR - 80);
    titleLines.forEach((line) => { doc.text(line, pageW / 2, y, { align: 'center' }); y += 14; });
    y += 8;

    // ---- sections ----
    const sectionTotals = [];
    state.sections.forEach((sec) => {
      y = ensureSpace(doc, y, 70, pageH);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text(`${sec.title || t('untitled_section')}:`, marginL, y);
      y += 4;

      if (sec.description) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
        const descLines = doc.splitTextToSize(sec.description, pageW - marginL - marginR);
        descLines.forEach((l) => { y += 12; doc.text(l, marginL, y); });
      }

      let total = 0;
      const body = sec.items.map((it) => {
        const t3 = (parseNum(it.qty)) * (parseNum(it.price));
        total += t3;
        return [it.desc || '', String(it.qty ?? 0), it.unit || '', formatMoney(it.price), formatMoney(t3)];
      });
      sectionTotals.push({ title: sec.title || t('untitled_section'), total });

      doc.autoTable({
        startY: y + 8,
        margin: { left: marginL, right: marginR },
        head: [[t('col_desc'), t('col_qty'), t('col_unit'), t('col_price'), t('col_amount_ht')]],
        body,
        foot: [['', '', '', t('total_ht'), formatMoney(total)]],
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
    doc.text(t('recap_label'), marginL, y);
    y += 8;

    const totalHT = sectionTotals.reduce((s, x) => s + x.total, 0);
    let ttc = totalHT;
    const summaryBody = sectionTotals.map((s) => [s.title, formatMoney(s.total)]);
    const totalHtLabel = t('total_ht');
    const totalTtcLabel = t('total_ttc');
    summaryBody.push([totalHtLabel, formatMoney(totalHT)]);
    state.taxes.forEach((tx) => {
      const amt = totalHT * (parseNum(tx.rate) / 100);
      ttc += amt;
      summaryBody.push([`${tx.label || 'Tax'} ${tx.rate || 0}%`, formatMoney(amt)]);
    });
    summaryBody.push([totalTtcLabel, formatMoney(ttc)]);

    doc.autoTable({
      startY: y + 6,
      margin: { left: marginL, right: marginR },
      body: summaryBody,
      styles: { font: 'helvetica', fontSize: 10, cellPadding: 6, lineColor: [30, 45, 60], lineWidth: 0.5 },
      columnStyles: { 0: { cellWidth: 'auto' }, 1: { halign: 'right', cellWidth: 120 } },
      didParseCell: (data) => {
        const label = data.row.raw[0];
        if (label === totalHtLabel) {
          data.cell.styles.fillColor = [239, 233, 217];
          data.cell.styles.fontStyle = 'bold';
        }
        if (label === totalTtcLabel) {
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
    doc.text(titleBlockLine(state.invoice.number, state.invoice.date), pageW - marginR, y, { align: 'right' });

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
    el.addEventListener('input', () => { syncHeader(); setStatus(t('status_unsaved')); });
  });

  // number / currency format
  [currencySymbolEl, currencyPositionEl, numberFormatPresetEl, customThousandsSepEl,
    customDecimalSepEl, decimalPlacesEl].forEach((el) => {
    el.addEventListener('input', () => {
      readFormatSettingsFromUI();
      updateSummary();
      setStatus(t('status_unsaved'));
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
    setStatus(t('status_unsaved'));
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
    setStatus(t('status_unsaved'));
  });

  $('btnAddSection').addEventListener('click', () => {
    sectionsMount.appendChild(createSection({}));
    updateSummary();
    setStatus(t('status_unsaved'));
  });

  // taxes
  taxList.addEventListener('input', () => { updateSummary(); setStatus(t('status_unsaved')); });
  taxList.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-remove-tax')) {
      e.target.closest('.tax-row').remove();
      updateSummary();
      setStatus(t('status_unsaved'));
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
      setStatus(t('status_logo_added'));
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
    setStatus(t('status_unsaved'));
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
      setStatus(t('status_terms_attached'));
    };
    reader.readAsDataURL(file);
  });
  btnRemoveTerms.addEventListener('click', () => {
    termsDataUrl = null;
    termsFileName = '';
    fileTerms.value = '';
    refreshTermsUI();
    setStatus(t('status_unsaved'));
  });

  // top-level actions
  $('btnNew').addEventListener('click', () => {
    if (confirm(t('confirm_new'))) {
      populateFromState({ invoice: { date: todayISO() } });
      setStatus(t('status_new_ready'));
    }
  });

  $('btnSaveData').addEventListener('click', () => {
    const state = collectState();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    triggerDownload(blob, `InvoiceMe-data-${state.invoice.number || 'draft'}.json`);
    setStatus(t('status_data_saved'));
  });

  $('fileLoadData').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const state = JSON.parse(reader.result);
        populateFromState(state);
        setStatus(t('status_data_loaded'));
      } catch (err) {
        alert(t('alert_bad_json'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  $('btnGeneratePdf').addEventListener('click', async () => {
    setStatus(t('status_generating'), 0);
    try {
      await generatePdf();
      setStatus(t('status_pdf_generated'));
    } catch (err) {
      console.error(err);
      setStatus('');
      alert(t('alert_pdf_error'));
    }
  });

  // ============================================================
  // Init
  // ============================================================
  let initialLang = 'fr';
  try {
    const saved = localStorage.getItem('invoiceme-lang');
    if (saved === 'en' || saved === 'fr') initialLang = saved;
  } catch (e) { /* storage unavailable, default to French */ }
  setLanguage(initialLang);
  populateFromState({ invoice: { date: todayISO() } });
})();
