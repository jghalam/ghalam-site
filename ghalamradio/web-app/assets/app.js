// GhalamRadio Web — app wiring

document.addEventListener('DOMContentLoaded', () => {

  // ---------- helpers ----------

  function toast(msg, ms = 2400) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, ms);
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  // Mirrors the iOS app's isVideoURL(_:) + "description contains 'video'"
  // check exactly, so a station tagged as video on one platform shows the
  // same way on the other. Note: unlike AVPlayer on iOS, browsers can only
  // actually play a narrow set of these containers/codecs (reliably mp4,
  // usually mov; avi/mkv/flv will very likely fail to decode) — detection
  // matches iOS 1:1, but playback support is a real browser limitation.
  const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'flv'];
  function isVideoUrl(urlStr) {
    try {
      const path = new URL(urlStr).pathname;
      const ext = path.split('.').pop().toLowerCase();
      return VIDEO_EXTENSIONS.includes(ext);
    } catch {
      return false;
    }
  }
  function isVideoStation(station) {
    return (station.description || '').includes('video') || isVideoUrl(station.url || '');
  }
  function isYouTubeUrl(urlStr) {
    return /(^|\.)youtube\.com$/.test(safeHost(urlStr)) || /(^|\.)youtu\.be$/.test(safeHost(urlStr));
  }
  function safeHost(urlStr) {
    try { return new URL(urlStr).hostname; } catch { return ''; }
  }
  function extractYouTubeId(urlStr) {
    try {
      const u = new URL(urlStr);
      if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const parts = u.pathname.split('/');
      const embedIdx = parts.indexOf('embed');
      if (embedIdx !== -1 && parts[embedIdx + 1]) return parts[embedIdx + 1];
      return null;
    } catch {
      return null;
    }
  }

  function fallbackArt(name) {
    const letter = (name || '?').trim().charAt(0).toUpperCase() || '?';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">
      <rect width="40" height="40" rx="8" fill="#1c2030"/>
      <text x="50%" y="54%" text-anchor="middle" fill="#e3a83b" font-family="DM Sans" font-size="16" dy=".1em">${letter}</text>
    </svg>`;
    // URI-encoding (not base64/btoa) — btoa only supports Latin-1 and throws
    // on non-Latin script station names/initials (Persian, Arabic, etc.).
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  function stationRow(station, { onPlay, onAdd, onRemove, onEdit } = {}) {
    const li = document.createElement('li');
    li.className = 'station-row';
    li.dataset.url = station.url || '';

    const img = document.createElement('img');
    img.className = 'station-art';
    img.loading = 'lazy';
    img.src = station.image || fallbackArt(station.name);
    img.onerror = () => { img.onerror = null; img.src = fallbackArt(station.name); };
    li.appendChild(img);

    const meta = document.createElement('div');
    meta.className = 'station-meta';
    const nameEl = document.createElement('div');
    nameEl.className = 'station-name';
    nameEl.textContent = station.name || '(unnamed station)';
    if (isVideoStation(station)) {
      const badge = document.createElement('span');
      badge.className = 'video-badge';
      badge.title = 'Video stream';
      badge.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13"><path d="M15 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" fill="currentColor"/></svg>';
      nameEl.appendChild(badge);
    }
    const descEl = document.createElement('div');
    descEl.className = 'station-desc';
    if (station.countrycode && COUNTRY_NAMES[station.countrycode.toUpperCase()]) {
      const flag = document.createElement('img');
      flag.className = 'station-flag';
      flag.alt = '';
      flag.loading = 'lazy';
      flag.src = flagUrl(station.countrycode);
      flag.onerror = () => { flag.style.display = 'none'; };
      descEl.appendChild(flag);
    }
    const descText = document.createElement('span');
    descText.className = 'station-desc-text';
    descText.textContent = station.description || station.url;
    descEl.appendChild(descText);
    meta.appendChild(nameEl);
    meta.appendChild(descEl);
    li.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'station-actions';

    if (onPlay) {
      const playBtn = document.createElement('button');
      playBtn.className = 'icon-btn';
      playBtn.setAttribute('aria-label', 'Play');
      playBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
      playBtn.addEventListener('click', () => onPlay(station, playBtn));
      actions.appendChild(playBtn);
      li._playBtn = playBtn;
    }
    if (station.homepage) {
      const linkBtn = document.createElement('a');
      linkBtn.className = 'icon-btn';
      linkBtn.href = station.homepage;
      linkBtn.target = '_blank';
      linkBtn.rel = 'noopener noreferrer';
      linkBtn.setAttribute('aria-label', 'Open station website');
      linkBtn.title = 'Open station website';
      linkBtn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15"><path d="M14 4h6v6M10 14L20 4M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      // Row click handlers elsewhere use bare clicks, not <a> navigation —
      // stop propagation so this doesn't also trigger a parent row action.
      linkBtn.addEventListener('click', (e) => e.stopPropagation());
      actions.appendChild(linkBtn);
    }
    if (onAdd) {
      const addBtn = document.createElement('button');
      addBtn.className = 'icon-btn';
      addBtn.setAttribute('aria-label', 'Add to My Stations');
      addBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
      addBtn.addEventListener('click', () => onAdd(station));
      actions.appendChild(addBtn);
    }
    if (onEdit) {
      const editBtn = document.createElement('button');
      editBtn.className = 'icon-btn';
      editBtn.setAttribute('aria-label', 'Edit');
      editBtn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15"><path d="M4 20h4l10.5-10.5a1.5 1.5 0 0 0 0-2.12l-1.88-1.88a1.5 1.5 0 0 0-2.12 0L4 16v4z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/></svg>';
      editBtn.addEventListener('click', () => onEdit(station));
      actions.appendChild(editBtn);
    }
    if (onRemove) {
      const rmBtn = document.createElement('button');
      rmBtn.className = 'icon-btn danger';
      rmBtn.setAttribute('aria-label', 'Remove');
      rmBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
      rmBtn.addEventListener('click', () => onRemove(station));
      actions.appendChild(rmBtn);
    }

    li.appendChild(actions);
    return li;
  }

  // ---------- tabs ----------

  const tabs = document.querySelectorAll('.tab');
  const panels = { browse: document.getElementById('panel-browse'), mine: document.getElementById('panel-mine') };

  function activateTab(name) {
    const tab = Array.from(tabs).find(t => t.dataset.tab === name);
    if (!tab) return;
    tabs.forEach(t => { t.classList.remove('is-active'); t.setAttribute('aria-selected', 'false'); });
    tab.classList.add('is-active');
    tab.setAttribute('aria-selected', 'true');
    Object.values(panels).forEach(p => { p.classList.remove('is-active'); p.hidden = true; });
    panels[name].classList.add('is-active');
    panels[name].hidden = false;
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => activateTab(tab.dataset.tab));
  });

  // Land on My Stations if there's already a saved list — Browse only makes
  // sense as the starting point when there's nothing saved yet.
  if (MyStations.load().length > 0) activateTab('mine');

  // ---------- player ----------

  const playerBar = document.getElementById('playerBar');
  const playerName = document.getElementById('playerName');
  const playerDesc = document.getElementById('playerDesc');
  const playerStatus = document.getElementById('playerStatus');
  const playerToggle = document.getElementById('playerToggle');

  function setPlayIcon(btn, playing) {
    if (!btn) return;
    btn.classList.toggle('is-playing', playing);
    btn.innerHTML = playing
      ? '<svg viewBox="0 0 24 24" width="16" height="16"><rect x="6" y="5" width="4" height="14" fill="currentColor"/><rect x="14" y="5" width="4" height="14" fill="currentColor"/></svg>'
      : '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
  }

  // Single source of truth for "is this row the active station": Player.current.
  // Re-applied to every rendered row on every state change and every list
  // re-render, so it can never drift out of sync with what's actually playing.
  function syncPlaybackUI() {
    const activeUrl = Player.current ? Player.current.url : null;
    document.querySelectorAll('.station-row[data-url]').forEach(row => {
      const isActive = !!activeUrl && row.dataset.url === activeUrl;
      row.classList.toggle('is-selected', isActive);
      if (row._playBtn) setPlayIcon(row._playBtn, isActive);
    });
    setPlayIcon(playerToggle, !!activeUrl);
    playerToggle.setAttribute('aria-label', activeUrl ? 'Stop' : 'Play');
  }

  Player.setOnStateChange(({ status, station }) => {
    lastStatus = status;
    if (!station) { playerBar.hidden = true; syncPlaybackUI(); return; }
    playerBar.hidden = false;
    playerName.textContent = station.name || station.url;
    playerDesc.textContent = station.description || '';
    renderPlayerStatusText();
    syncPlaybackUI();
  });

  // Prefer showing the live track (artist — title) once metadata arrives;
  // fall back to the connection status otherwise. Metadata can arrive after
  // the 'playing' state fires, so both paths funnel through this one function
  // so neither can clobber the other out of order.
  let lastStatus = null;
  let lastMetadata = null;
  function renderPlayerStatusText() {
    if (lastStatus === 'loading') { playerStatus.textContent = 'Connecting…'; return; }
    if (lastStatus === 'error') { playerStatus.textContent = 'Couldn\u2019t play this station'; return; }
    if (lastStatus === 'stopped') { playerStatus.textContent = 'Stopped'; return; }
    if (lastMetadata && (lastMetadata.title || lastMetadata.artist)) {
      playerStatus.textContent = [lastMetadata.artist, lastMetadata.title].filter(Boolean).join(' — ');
    } else {
      playerStatus.textContent = 'Playing';
    }
  }

  Player.setOnMetadata((info) => {
    lastMetadata = info;
    renderPlayerStatusText();
  });

  // ---------- video playback ----------

  const videoModal = document.getElementById('videoModal');
  const videoModalBody = document.getElementById('videoModalBody');
  const videoModalTitle = document.getElementById('videoModalTitle');
  const videoModalError = document.getElementById('videoModalError');

  function openVideoModal(station) {
    videoModalTitle.textContent = station.name || 'Video stream';
    videoModalError.hidden = true;
    videoModalBody.innerHTML = '';

    if (isYouTubeUrl(station.url)) {
      const id = extractYouTubeId(station.url);
      if (id) {
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube.com/embed/${id}?autoplay=1`;
        iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
        iframe.allowFullscreen = true;
        videoModalBody.appendChild(iframe);
      } else {
        videoModalError.hidden = false;
        videoModalError.textContent = 'Couldn\u2019t determine the YouTube video from this link.';
      }
    } else {
      const video = document.createElement('video');
      video.src = station.url;
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      video.addEventListener('error', () => { videoModalError.hidden = false; });
      videoModalBody.appendChild(video);
    }

    videoModal.showModal();
  }

  // Clearing the body (not just closing the dialog) matters — a <video> or
  // YouTube iframe left in the DOM keeps playing in the background otherwise.
  function closeVideoModal() {
    videoModalBody.innerHTML = '';
    if (videoModal.open) videoModal.close();
  }

  document.getElementById('videoModalClose').addEventListener('click', closeVideoModal);
  videoModal.addEventListener('close', () => { videoModalBody.innerHTML = ''; });

  function handlePlay(station) {
    if (isVideoStation(station)) {
      Player.stop(); // don't let audio keep playing underneath the video
      syncPlaybackUI();
      openVideoModal(station);
      return;
    }
    closeVideoModal(); // don't let a video keep playing behind the audio bar
    if (Player.current && Player.current.url === station.url) {
      Player.stop();
    } else {
      Player.play(station);
    }
    syncPlaybackUI();
  }

  playerToggle.addEventListener('click', () => {
    Player.stop();
    syncPlaybackUI();
  });

  // ---------- browse / search ----------

  const searchName = document.getElementById('searchName');
  const searchResults = document.getElementById('searchResults');
  const searchHint = document.getElementById('searchHint');
  const searchCount = document.getElementById('searchCount');
  const dbStatus = document.getElementById('dbStatus');
  let selectedCountryCode = '';

  function appendRowSafely(list, station, callbacks) {
    try {
      list.appendChild(stationRow(station, callbacks));
    } catch (err) {
      // Never let one malformed record (bad characters, missing fields, etc.
      // — this DB is uncurated global data) take down the rest of the list.
      console.error('Skipped a station row due to a render error:', station, err);
    }
  }

  function renderSearch() {
    const results = StationDB.search(searchName.value, selectedCountryCode);
    searchResults.innerHTML = '';
    if (!searchName.value.trim() && !selectedCountryCode) {
      searchHint.hidden = false;
      searchHint.textContent = 'Type a name or pick a country to search.';
      searchCount.hidden = true;
      return;
    }
    searchHint.hidden = results.length > 0;
    if (results.length === 0) {
      searchHint.hidden = false;
      searchHint.textContent = 'No stations found.';
      searchCount.hidden = true;
      return;
    }
    searchCount.hidden = false;
    searchCount.textContent = results.length >= CONFIG.SEARCH_RESULT_LIMIT
      ? `Showing first ${results.length} matches — refine your search to narrow it down`
      : `${results.length} station${results.length === 1 ? '' : 's'} found`;
    for (const station of results) {
      appendRowSafely(searchResults, station, {
        onPlay: handlePlay,
        onAdd: (s) => {
          MyStations.add(s);
          refreshMyStations();
          toast(`Added “${s.name || 'station'}”`);
        }
      });
    }
    syncPlaybackUI();
  }

  const debouncedSearch = debounce(renderSearch, CONFIG.SEARCH_DEBOUNCE_MS);
  searchName.addEventListener('input', debouncedSearch);

  // ---------- custom country dropdown (flag + name) ----------

  const countrySelect = document.getElementById('countrySelect');
  const countrySelectBtn = document.getElementById('countrySelectBtn');
  const countrySelectPanel = document.getElementById('countrySelectPanel');
  const countrySelectList = document.getElementById('countrySelectList');
  const countrySelectLabel = document.getElementById('countrySelectLabel');
  const countrySelectFlag = document.getElementById('countrySelectFlag');
  const countryFilter = document.getElementById('countryFilter');
  let countryOptions = []; // [{code, name}]

  function renderCountryList(filterText) {
    const q = (filterText || '').trim().toLowerCase();
    countrySelectList.innerHTML = '';

    const allItem = document.createElement('li');
    allItem.setAttribute('role', 'option');
    allItem.innerHTML = '<span class="no-flag"></span><span>All countries</span>';
    allItem.addEventListener('click', () => selectCountry('', 'All countries'));
    if (!selectedCountryCode) allItem.classList.add('is-active');
    countrySelectList.appendChild(allItem);

    for (const { code, name } of countryOptions) {
      if (q && !name.toLowerCase().includes(q) && !code.toLowerCase().includes(q)) continue;
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      // Some entries (e.g. "XX") are radio-browser's placeholder for an
      // unknown country and have no real flag — skip the request entirely
      // rather than firing it and letting onerror clean up after a 404.
      if (COUNTRY_NAMES[code.toUpperCase()]) {
        const img = document.createElement('img');
        img.src = flagUrl(code);
        img.alt = '';
        img.loading = 'lazy';
        img.onerror = () => { img.replaceWith(Object.assign(document.createElement('span'), { className: 'no-flag' })); };
        li.appendChild(img);
      } else {
        li.appendChild(Object.assign(document.createElement('span'), { className: 'no-flag' }));
      }
      const label = document.createElement('span');
      label.textContent = name;
      li.appendChild(label);
      li.addEventListener('click', () => selectCountry(code, name));
      if (code === selectedCountryCode) li.classList.add('is-active');
      countrySelectList.appendChild(li);
    }
  }

  function selectCountry(code, name) {
    selectedCountryCode = code;
    countrySelectLabel.textContent = name;
    if (code) {
      countrySelectFlag.src = flagUrl(code);
      countrySelectFlag.hidden = false;
      countrySelectFlag.onerror = () => { countrySelectFlag.hidden = true; };
    } else {
      countrySelectFlag.hidden = true;
    }
    closeCountryPanel();
    renderSearch();
  }

  function openCountryPanel() {
    countrySelectPanel.hidden = false;
    countrySelectBtn.setAttribute('aria-expanded', 'true');
    countryFilter.value = '';
    renderCountryList('');
    countryFilter.focus();
  }
  function closeCountryPanel() {
    countrySelectPanel.hidden = true;
    countrySelectBtn.setAttribute('aria-expanded', 'false');
  }

  countrySelectBtn.addEventListener('click', () => {
    countrySelectPanel.hidden ? openCountryPanel() : closeCountryPanel();
  });
  countryFilter.addEventListener('input', () => renderCountryList(countryFilter.value));
  document.addEventListener('click', (e) => {
    if (!countrySelect.contains(e.target)) closeCountryPanel();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCountryPanel();
  });

  StationDB.load((msg) => { dbStatus.textContent = msg; })
    .then(() => {
      const count = StationDB.getStationCount();
      dbStatus.textContent = `${count.toLocaleString()} stations available`;
      const codes = StationDB.listCountries();
      countryOptions = codes
        .map(code => ({ code, name: countryName(code) }))
        .sort((a, b) => a.name.localeCompare(b.name));
    })
    .catch(err => {
      console.error(err);
      dbStatus.textContent = 'Couldn\u2019t load the station database. Check your connection and reload.';
    });

  // ---------- my stations ----------

  const myStationsList = document.getElementById('myStationsList');
  const mineEmpty = document.getElementById('mineEmpty');
  const mineCount = document.getElementById('mineCount');
  const tagFilterSelect = document.getElementById('tagFilter');
  let selectedTag = '';

  // Mirrors the iOS app's tag handling: tags is a comma-separated string,
  // split/trimmed into a unique, sorted set for the filter dropdown, and
  // matched exactly (not a substring match) when filtering.
  function extractStationTags(stations) {
    const set = new Set();
    for (const s of stations) {
      (s.tags || '').split(',').map(t => t.trim()).filter(Boolean).forEach(t => set.add(t));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  function stationHasTag(station, tag) {
    return (station.tags || '').split(',').map(t => t.trim()).includes(tag);
  }

  function populateTagFilter(allStations) {
    const tags = extractStationTags(allStations);
    tagFilterSelect.innerHTML = '<option value="">All tags</option>';
    for (const t of tags) {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      tagFilterSelect.appendChild(opt);
    }
    if (tags.includes(selectedTag)) {
      tagFilterSelect.value = selectedTag;
    } else {
      selectedTag = '';
      tagFilterSelect.value = '';
    }
  }

  tagFilterSelect.addEventListener('change', () => {
    selectedTag = tagFilterSelect.value;
    refreshMyStations();
  });

  function refreshMyStations() {
    const allStations = MyStations.load();
    populateTagFilter(allStations);
    const visible = selectedTag ? allStations.filter(s => stationHasTag(s, selectedTag)) : allStations;

    myStationsList.innerHTML = '';
    mineEmpty.hidden = visible.length > 0;
    mineEmpty.textContent = allStations.length === 0
      ? 'No stations saved yet. Search the directory or add one manually.'
      : 'No saved stations match this tag.';
    mineCount.textContent = allStations.length ? String(allStations.length) : '';

    visible.forEach((station) => {
      const index = allStations.indexOf(station); // real index in the unfiltered saved list
      appendRowSafely(myStationsList, station, {
        onPlay: handlePlay,
        onEdit: () => openEditModal(index, station),
        onRemove: () => {
          MyStations.removeAt(index);
          refreshMyStations();
        }
      });
    });
    syncPlaybackUI();
  }
  refreshMyStations();

  // ---------- manual add / edit ----------

  const addModal = document.getElementById('addModal');
  const addForm = document.getElementById('addForm');
  const addModalTitle = document.getElementById('addModalTitle');
  const addSubmitBtn = document.getElementById('addSubmitBtn');
  const addNameEl = document.getElementById('addName');
  const addUrlEl = document.getElementById('addUrl');
  const addHomepageEl = document.getElementById('addHomepage');
  const addImageEl = document.getElementById('addImage');
  const addCountryEl = document.getElementById('addCountry');
  const addDescriptionEl = document.getElementById('addDescription');
  const addTagsEl = document.getElementById('addTags');
  let editingIndex = null; // null = adding new; number = editing MyStations[index]

  function openAddModal() {
    editingIndex = null;
    addForm.reset();
    addModalTitle.textContent = 'Add a station';
    addSubmitBtn.textContent = 'Save station';
    addModal.showModal();
  }

  function openEditModal(index, station) {
    editingIndex = index;
    addNameEl.value = station.name || '';
    addUrlEl.value = station.url || '';
    addHomepageEl.value = station.homepage || '';
    addImageEl.value = station.image || '';
    addCountryEl.value = station.countrycode || '';
    addDescriptionEl.value = station.description || '';
    addTagsEl.value = station.tags || '';
    addModalTitle.textContent = 'Edit station';
    addSubmitBtn.textContent = 'Save changes';
    addModal.showModal();
  }

  document.getElementById('btnAddManual').addEventListener('click', openAddModal);
  document.getElementById('addCancel').addEventListener('click', () => addModal.close());
  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const countrycode = addCountryEl.value.trim().toUpperCase();
    const description = addDescriptionEl.value.trim();
    const station = {
      name: addNameEl.value.trim(),
      url: addUrlEl.value.trim(),
      image: addImageEl.value.trim(),
      homepage: addHomepageEl.value.trim(),
      countrycode,
      tags: addTagsEl.value.trim(),
      description
    };
    if (!station.name || !station.url) return;
    if (editingIndex !== null) {
      MyStations.updateAt(editingIndex, station);
      toast(`Saved changes to “${station.name}”`);
    } else {
      MyStations.add(station);
      toast(`Added “${station.name}”`);
    }
    refreshMyStations();
    addModal.close();
  });

  // ---------- import (file) ----------

  const importFileInput = document.getElementById('importFileInput');
  document.getElementById('btnImport').addEventListener('click', () => importFileInput.click());
  importFileInput.addEventListener('change', async () => {
    const file = importFileInput.files[0];
    importFileInput.value = '';
    if (!file) return;
    try {
      const stations = await Backup.parseFile(file);
      presentImport(stations);
    } catch (err) {
      console.error(err);
      toast('Couldn\u2019t read that file.');
    }
  });

  // ---------- import review modal ----------

  const importModal = document.getElementById('importModal');
  const importSummary = document.getElementById('importSummary');
  const importFreshList = document.getElementById('importFreshList');
  const importConflicts = document.getElementById('importConflicts');
  let pendingFresh = [];
  let pendingConflictChoices = []; // [{incoming, existing, saveBoth}]

  function presentImport(incoming) {
    if (!incoming.length) { toast('Nothing to import.'); return; }
    const existing = MyStations.load();
    const { fresh, conflicts } = Backup.diffAgainstExisting(incoming, existing);
    pendingFresh = fresh;
    pendingConflictChoices = conflicts.map(c => ({ ...c, saveBoth: false }));

    importSummary.textContent = `${fresh.length} new station${fresh.length === 1 ? '' : 's'}` +
      (conflicts.length ? `, ${conflicts.length} duplicate${conflicts.length === 1 ? '' : 's'} (already in your list)` : '');

    importFreshList.innerHTML = '';
    fresh.forEach(s => appendRowSafely(importFreshList, s, {}));

    importConflicts.innerHTML = '';
    pendingConflictChoices.forEach((c, i) => {
      const row = document.createElement('div');
      row.className = 'conflict-row';
      const label = document.createElement('div');
      label.className = 'station-desc';
      label.textContent = `Duplicate: ${c.incoming.name || c.incoming.url}`;
      row.appendChild(label);
      const choice = document.createElement('div');
      choice.className = 'conflict-choice';
      choice.innerHTML = `
        <label><input type="radio" name="conflict-${i}" value="skip" checked> Skip</label>
        <label><input type="radio" name="conflict-${i}" value="both"> Save both</label>
      `;
      choice.addEventListener('change', (e) => {
        pendingConflictChoices[i].saveBoth = e.target.value === 'both';
      });
      row.appendChild(choice);
      importConflicts.appendChild(row);
    });

    importModal.showModal();
  }

  document.getElementById('importCancel').addEventListener('click', () => importModal.close());
  document.getElementById('importConfirm').addEventListener('click', () => {
    const toAdd = [...pendingFresh, ...pendingConflictChoices.filter(c => c.saveBoth).map(c => c.incoming)];
    if (toAdd.length) {
      MyStations.addMany(toAdd);
      refreshMyStations();
      toast(`Imported ${toAdd.length} station${toAdd.length === 1 ? '' : 's'}`);
    }
    importModal.close();
  });

  // ---------- backup / share ----------

  const shareModal = document.getElementById('shareModal');
  const shareLinkResult = document.getElementById('shareLinkResult');
  document.getElementById('btnExport').addEventListener('click', () => {
    shareLinkResult.hidden = true;
    shareModal.showModal();
  });
  document.getElementById('shareClose').addEventListener('click', () => shareModal.close());

  document.getElementById('shareDownload').addEventListener('click', () => {
    const stations = MyStations.load();
    if (!stations.length) { toast('Nothing to back up yet.'); return; }
    Backup.downloadAsFile(stations);
  });

  document.getElementById('shareLink').addEventListener('click', async () => {
    const stations = MyStations.load();
    if (!stations.length) { toast('Nothing to share yet.'); return; }
    const result = Backup.buildShareLink(stations);
    if (result.type === 'file') {
      toast('Too many stations for a link — use the backup file instead.');
      return;
    }
    try {
      await navigator.clipboard.writeText(result.url);
      shareLinkResult.hidden = false;
      shareLinkResult.textContent = 'Link copied to clipboard.';
    } catch {
      shareLinkResult.hidden = false;
      shareLinkResult.textContent = result.url;
    }
  });

  // ---------- incoming share link on page load ----------

  const params = new URLSearchParams(location.search);
  if (params.has('d')) {
    const incoming = Backup.parseShareUrl(location.href);
    // Switch to My Stations tab so the review modal has context behind it.
    document.querySelector('.tab[data-tab="mine"]').click();
    if (incoming.length) presentImport(incoming);
    // Clean the URL so reloading doesn't re-trigger the import.
    history.replaceState(null, '', location.pathname);
  }
});
