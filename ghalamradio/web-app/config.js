// GhalamRadio Web — shared config
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
