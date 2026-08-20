// GhalamRadio Web — shared config

// Version scheme: plain MAJOR.MINOR.PATCH, bumped by hand here on each
// deploy-worthy change. No build tooling reads this — it exists purely so
// the running app can tell you (and us, when debugging) what's actually
// live, shown in small text next to the control bar.
//   MAJOR — a breaking change to stored data or the backup/share format
//   MINOR — a new feature (e.g. video playback, metadata, tag filter)
//   PATCH — a fix with no new feature
const APP_VERSION = '1.2.5';

const CONFIG = {
  DB_URL: 'data/stations.db.gz',
  SHARE_BASE_URL: 'https://ghalam.net/ghalamradio/share/index.html',
  MAX_SHARE_LINK_LENGTH: 8000,     // mirrors the iOS app's link-length guard
  LOCAL_STORAGE_KEY: 'ghalamradio_my_stations',
  SEARCH_DEBOUNCE_MS: 300,
  SEARCH_RESULT_LIMIT: 200,        // cap results for a snappy UI on broad queries
  CSV_DELIMITER: '^%^',
  CSV_HEADER: 'name^%^url^%^image^%^tags^%^description^%^homepage^%^countrycode',
  GCSVX_MIME: 'text/plain'
};
