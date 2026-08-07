// GhalamRadio Web — the user's own saved station list (localStorage)
// Station shape matches the iOS app: { name, url, image, tags, description, homepage, countrycode }

const MyStations = (() => {
  function load() {
    try {
      const raw = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function save(stations) {
    localStorage.setItem(CONFIG.LOCAL_STORAGE_KEY, JSON.stringify(stations));
  }

  function add(station) {
    const stations = load();
    stations.push(station);
    save(stations);
    return stations;
  }

  function addMany(newStations) {
    const stations = load();
    stations.push(...newStations);
    save(stations);
    return stations;
  }

  function removeAt(index) {
    const stations = load();
    stations.splice(index, 1);
    save(stations);
    return stations;
  }

  return { load, save, add, addMany, removeAt };
})();
