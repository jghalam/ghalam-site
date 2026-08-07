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

  function fallbackArt(name) {
    const letter = (name || '?').trim().charAt(0).toUpperCase() || '?';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">
      <rect width="40" height="40" rx="8" fill="#1c2030"/>
      <text x="50%" y="54%" text-anchor="middle" fill="#e3a83b" font-family="DM Sans" font-size="16" dy=".1em">${letter}</text>
    </svg>`;
    return 'data:image/svg+xml;base64,' + btoa(svg);
  }

  function stationRow(station, { onPlay, onAdd, onRemove } = {}) {
    const li = document.createElement('li');
    li.className = 'station-row';

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
    const descEl = document.createElement('div');
    descEl.className = 'station-desc';
    descEl.textContent = station.description || station.url;
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
    if (onAdd) {
      const addBtn = document.createElement('button');
      addBtn.className = 'icon-btn';
      addBtn.setAttribute('aria-label', 'Add to My Stations');
      addBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
      addBtn.addEventListener('click', () => onAdd(station));
      actions.appendChild(addBtn);
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
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => { t.classList.remove('is-active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');
      Object.values(panels).forEach(p => { p.classList.remove('is-active'); p.hidden = true; });
      const target = panels[tab.dataset.tab];
      target.classList.add('is-active');
      target.hidden = false;
    });
  });

  // ---------- player ----------

  const playerBar = document.getElementById('playerBar');
  const playerName = document.getElementById('playerName');
  const playerStatus = document.getElementById('playerStatus');
  const playerToggle = document.getElementById('playerToggle');
  let activePlayBtn = null;

  function setPlayIcon(btn, playing) {
    if (!btn) return;
    btn.classList.toggle('is-playing', playing);
    btn.innerHTML = playing
      ? '<svg viewBox="0 0 24 24" width="16" height="16"><rect x="6" y="5" width="4" height="14" fill="currentColor"/><rect x="14" y="5" width="4" height="14" fill="currentColor"/></svg>'
      : '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
  }

  Player.setOnStateChange(({ status, station }) => {
    if (!station) { playerBar.hidden = true; return; }
    playerBar.hidden = false;
    playerName.textContent = station.name || station.url;
    if (status === 'loading') playerStatus.textContent = 'Connecting…';
    else if (status === 'playing') playerStatus.textContent = 'Playing';
    else if (status === 'error') playerStatus.textContent = 'Couldn\u2019t play this station';
    else if (status === 'stopped') playerStatus.textContent = 'Stopped';

    if (activePlayBtn) setPlayIcon(activePlayBtn, false);
    activePlayBtn = null;
    if (status === 'playing' || status === 'loading') {
      // find the row button currently associated, set via handlePlay below
    }
  });

  function handlePlay(station, btn) {
    if (Player.isPlaying(station)) {
      Player.stop();
      setPlayIcon(btn, false);
      activePlayBtn = null;
      return;
    }
    if (activePlayBtn) setPlayIcon(activePlayBtn, false);
    Player.play(station);
    setPlayIcon(btn, true);
    activePlayBtn = btn;
  }

  playerToggle.addEventListener('click', () => {
    Player.stop();
    if (activePlayBtn) setPlayIcon(activePlayBtn, false);
    activePlayBtn = null;
  });

  // ---------- browse / search ----------

  const searchName = document.getElementById('searchName');
  const searchCountry = document.getElementById('searchCountry');
  const searchResults = document.getElementById('searchResults');
  const searchHint = document.getElementById('searchHint');
  const dbStatus = document.getElementById('dbStatus');

  function renderSearch() {
    const results = StationDB.search(searchName.value, searchCountry.value);
    searchResults.innerHTML = '';
    if (!searchName.value.trim() && !searchCountry.value) {
      searchHint.hidden = false;
      searchHint.textContent = 'Type a name or pick a country to search.';
      return;
    }
    searchHint.hidden = results.length > 0;
    if (results.length === 0) {
      searchHint.hidden = false;
      searchHint.textContent = 'No stations found.';
      return;
    }
    for (const station of results) {
      searchResults.appendChild(stationRow(station, {
        onPlay: handlePlay,
        onAdd: (s) => {
          MyStations.add(s);
          refreshMyStations();
          toast(`Added “${s.name || 'station'}”`);
        }
      }));
    }
  }

  const debouncedSearch = debounce(renderSearch, CONFIG.SEARCH_DEBOUNCE_MS);
  searchName.addEventListener('input', debouncedSearch);
  searchCountry.addEventListener('change', renderSearch);

  StationDB.load((msg) => { dbStatus.textContent = msg; })
    .then(() => {
      const count = StationDB.getStationCount();
      dbStatus.textContent = `${count.toLocaleString()} stations available`;
      const countries = StationDB.listCountries();
      for (const c of countries) {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        searchCountry.appendChild(opt);
      }
    })
    .catch(err => {
      console.error(err);
      dbStatus.textContent = 'Couldn\u2019t load the station database. Check your connection and reload.';
    });

  // ---------- my stations ----------

  const myStationsList = document.getElementById('myStationsList');
  const mineEmpty = document.getElementById('mineEmpty');
  const mineCount = document.getElementById('mineCount');

  function refreshMyStations() {
    const stations = MyStations.load();
    myStationsList.innerHTML = '';
    mineEmpty.hidden = stations.length > 0;
    mineCount.textContent = stations.length ? String(stations.length) : '';
    stations.forEach((station, index) => {
      myStationsList.appendChild(stationRow(station, {
        onPlay: handlePlay,
        onRemove: () => {
          MyStations.removeAt(index);
          refreshMyStations();
        }
      }));
    });
  }
  refreshMyStations();

  // ---------- manual add ----------

  const addModal = document.getElementById('addModal');
  const addForm = document.getElementById('addForm');
  document.getElementById('btnAddManual').addEventListener('click', () => {
    addForm.reset();
    addModal.showModal();
  });
  document.getElementById('addCancel').addEventListener('click', () => addModal.close());
  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const station = {
      name: document.getElementById('addName').value.trim(),
      url: document.getElementById('addUrl').value.trim(),
      image: document.getElementById('addImage').value.trim(),
      homepage: document.getElementById('addHomepage').value.trim(),
      countrycode: document.getElementById('addCountry').value.trim().toUpperCase(),
      tags: document.getElementById('addTags').value.trim(),
      description: ''
    };
    if (!station.name || !station.url) return;
    MyStations.add(station);
    refreshMyStations();
    addModal.close();
    toast(`Added “${station.name}”`);
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
    fresh.forEach(s => importFreshList.appendChild(stationRow(s)));

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
