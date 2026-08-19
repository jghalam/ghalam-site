// GhalamRadio Web — album art lookup via the iTunes Search API
//
// Free, keyless, and fetchable directly from the browser (no proxy needed).
// Given an {artist, title} pair parsed from ICY/ID3 stream metadata, looks
// up the best-matching track and returns artwork URLs at two sizes.
//
// Results are cached in-memory by artist+title — ICY resends the same
// StreamTitle every few seconds while a song is playing, and this avoids
// re-querying for something we already looked up this session.

const Artwork = (() => {
  const cache = new Map(); // cacheKey(artist,title) -> { small, large } | null

  function cacheKey(artist, title) {
    return `${(artist || '').trim().toLowerCase()}|${(title || '').trim().toLowerCase()}`;
  }

  // iTunes artwork URLs end in a fixed-size crop, e.g. ".../100x100bb.jpg"
  // or (on older CDN paths) ".../100x100-75.jpg" — swapping that segment
  // gets a bigger image with no second request.
  function resizeArtworkUrl(url, size) {
    return url.replace(
      /(\d+)x(\d+)(bb)?(-\d+)?(\.\w+)$/i,
      (_, w, h, bb, quality, ext) => `${size}x${size}${bb || ''}${quality || ''}${ext}`
    );
  }

  // Returns { small, large } on a match, or null (no match, or the lookup
  // failed) — either way it's cached, so a station with no clean metadata
  // doesn't retry the same failing query every few seconds.
  async function lookup(artist, title) {
    if (!artist && !title) return null;
    const key = cacheKey(artist, title);
    if (cache.has(key)) return cache.get(key);

    const term = encodeURIComponent(`${artist || ''} ${title || ''}`.trim());
    const url = `https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=1`;

    let result = null;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`iTunes search returned ${res.status}`);
      const data = await res.json();
      const hit = data.results && data.results[0];
      if (hit && hit.artworkUrl100) {
        result = { small: resizeArtworkUrl(hit.artworkUrl100, 100), large: resizeArtworkUrl(hit.artworkUrl100, 1200) };
      }
    } catch (err) {
      console.warn('Artwork lookup failed:', artist, title, err);
    }
    cache.set(key, result);
    return result;
  }

  return { lookup, cacheKey };
})();
