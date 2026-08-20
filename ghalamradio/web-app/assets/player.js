// GhalamRadio Web — playback + metadata (title/artist only)
//
// Three playback paths, chosen at play-time and always falling back to the
// one before it on failure:
//   1. HLS (.m3u8 URLs)         -> hls.js, reads ID3 timed metadata
//   2. Everything else          -> icecast-metadata-player, reads ICY metadata
//   3. Fallback for either      -> plain <audio src>, no metadata
//
// Both metadata libraries are lazy-loaded from CDN on first use, so a
// station that never needs them never pays for them.

const Player = (() => {
  const audio = new Audio();
  audio.preload = 'none';
  let currentStation = null;
  let onStateChange = () => {};
  let onMetadata = () => {};
  let hls = null;
  let icyPlayer = null;
  let hlsLoadPromise = null;
  let icyLoadPromise = null;

  function setOnStateChange(fn) { onStateChange = fn; }
  function setOnMetadata(fn) { onMetadata = fn; } // called with {artist, title} or null

  // The page is always served over https, so a plain http:// stream URL is
  // "active mixed content". Chrome/Safari auto-upgrade it for <audio>/<video>
  // elements, but a raw fetch() (which icecast-metadata-player uses to read
  // ICY metadata) is blocked outright, with no upgrade attempt at all —
  // it fails immediately every time. Upgrading the scheme ourselves before
  // playback means both the ICY path and the plain fallback get a real shot
  // at working (whichever the origin server actually supports), instead of
  // guaranteeing the ICY attempt fails and wasting a round trip. We only use
  // this for the outgoing request — the station's stored URL is untouched.
  function toPlayableUrl(url) {
    if (location.protocol === 'https:' && /^http:\/\//i.test(url || '')) {
      return 'https://' + url.slice('http://'.length);
    }
    return url;
  }

  function loadHlsJs() {
    if (window.Hls) return Promise.resolve(window.Hls);
    if (hlsLoadPromise) return hlsLoadPromise;
    hlsLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js';
      script.onload = () => resolve(window.Hls);
      script.onerror = () => reject(new Error('Failed to load hls.js'));
      document.head.appendChild(script);
    });
    return hlsLoadPromise;
  }

  function loadIcecastPlayer() {
    if (window.IcecastMetadataPlayer) return Promise.resolve(window.IcecastMetadataPlayer);
    if (icyLoadPromise) return icyLoadPromise;
    icyLoadPromise = import('https://cdn.jsdelivr.net/npm/icecast-metadata-player/+esm')
      .then(mod => {
        window.IcecastMetadataPlayer = mod.default;
        return mod.default;
      });
    return icyLoadPromise;
  }

  function teardown() {
    if (hls) { try { hls.destroy(); } catch {} hls = null; }
    if (icyPlayer) {
      try { icyPlayer.stop(); } catch {}
      try { icyPlayer.detachAudioElement(); } catch {}
      icyPlayer = null;
    }
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }

  function isHlsUrl(url) {
    return /\.m3u8(\?|$)/i.test(url || '');
  }

  // .pls/.m3u files aren't audio — they're small text playlists pointing at
  // the real stream, a format some directories (and StreamTheWorld/Triton,
  // used by many broadcast affiliates including the CBC) still hand out
  // instead of a direct URL. Native players like iOS's AVPlayer parse these
  // transparently; <audio> and the ICY/HLS libraries here cannot, so handing
  // one straight to them fails no matter what — the CORS error a browser
  // reports when a metadata library tries to fetch() one is a symptom of
  // that, not the root cause.
  function isPlaylistUrl(url) {
    return /\.(pls|m3u)(\?|$)/i.test(url || '');
  }

  function parsePlsBody(text) {
    const m = /^\s*File1\s*=\s*(\S+)/im.exec(text || '');
    return m ? m[1].trim() : null;
  }

  function parseM3uBody(text) {
    const line = (text || '').split(/\r?\n/).find(l => l.trim() && !l.trim().startsWith('#'));
    return line ? line.trim() : null;
  }

  // Resolves a playlist URL to the real stream URL it points at. Returns
  // the original URL unchanged for anything that isn't a known playlist
  // format, or if resolution fails — playback then fails the same way it
  // would have without this step, just with a clearer error.
  async function resolvePlaylistUrl(url) {
    // StreamTheWorld publishes a documented redirect endpoint that resolves
    // a .pls callsign straight to a playable stream. Using it sidesteps
    // fetching the .pls text at all, which playerservices.streamtheworld.com
    // blocks via CORS (no Access-Control-Allow-Origin) regardless.
    const stw = /^https?:\/\/playerservices\.streamtheworld\.com\/pls\/([^./?#]+)\.pls/i.exec(url || '');
    if (stw) return `https://playerservices.streamtheworld.com/api/livestream-redirect/${stw[1]}.mp3`;

    if (!isPlaylistUrl(url)) return url;
    try {
      const res = await fetch(url);
      if (!res.ok) return url;
      const text = await res.text();
      const resolved = /\.pls(\?|$)/i.test(url) ? parsePlsBody(text) : parseM3uBody(text);
      return resolved || url;
    } catch (err) {
      // Most other playlist hosts don't set CORS headers either — nothing
      // more we can do client-side.
      console.warn('Could not fetch/parse playlist, playing URL as-is will likely fail:', url, err);
      return url;
    }
  }

  function playPlain(station, playUrl) {
    audio.src = playUrl || station.url;
    audio.play().catch(err => {
      console.warn('Plain audio fallback failed to play:', station.url, err && err.name, err && err.message);
      onStateChange({ status: 'error', station });
    });
  }

  function playViaHls(station, playUrl) {
    loadHlsJs().then(Hls => {
      if (currentStation !== station) return; // superseded by a newer play() call
      if (!Hls.isSupported()) { playPlain(station, playUrl); return; }
      hls = new Hls();
      hls.on(Hls.Events.ERROR, (evt, data) => {
        if (data.fatal) onStateChange({ status: 'error', station });
      });
      hls.on(Hls.Events.FRAG_PARSING_METADATA, (evt, data) => {
        const parsed = extractId3FromHlsEvent(data);
        if (parsed) onMetadata(parsed);
      });
      hls.loadSource(playUrl);
      hls.attachMedia(audio);
      audio.play().catch(() => {});
    }).catch(() => playPlain(station, playUrl));
  }

  // Not every failure mode surfaces cleanly through onError/play().catch() —
  // some libraries have internal fetch/network failures (e.g. a CORS
  // preflight rejection) that end up as an unhandled internal promise
  // rather than reaching our callbacks. A hard timeout is the only reliable
  // way to guarantee we never leave a station stuck silently "loading".
  function withFallbackTimeout(station, ms, onTimeout) {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled || currentStation !== station) return;
      settled = true;
      onTimeout();
    }, ms);
    return {
      resolve() { settled = true; clearTimeout(timer); },
      fallbackNow() {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        onTimeout();
      }
    };
  }

  function playViaIcecast(station, playUrl) {
    loadIcecastPlayer().then(IcecastMetadataPlayer => {
      if (currentStation !== station) return; // superseded by a newer play() call

      const guard = withFallbackTimeout(station, 8000, () => {
        console.warn('ICY playback stalled or failed — falling back to plain audio:', playUrl);
        if (icyPlayer) { try { icyPlayer.detachAudioElement(); } catch {} icyPlayer = null; }
        // icecast-metadata-player's own error/cleanup chain doesn't finish in
        // this same tick — it calls audio.pause() on this shared element
        // shortly *after* returning from onError. Calling audio.play() here
        // synchronously races that trailing pause() and gets aborted
        // (AbortError: interrupted by a call to pause()). Deferring to the
        // next tick lets its cleanup fully settle before we touch the
        // element ourselves.
        setTimeout(() => {
          if (currentStation === station) playPlain(station, playUrl);
        }, 50);
      });

      try {
        icyPlayer = new IcecastMetadataPlayer(playUrl, {
          audioElement: audio,
          metadataTypes: ['icy'],
          enableLogging: true, // surfaces warnings like missing/undetectable Icy-MetaInt
          retryTimeout: 6, // fail fast to the plain-audio fallback rather than hang
          onMetadata: (metadata) => {
            const parsed = parseStreamTitle(metadata.StreamTitle);
            if (parsed) onMetadata(parsed);
          },
          onPlay: () => {
            guard.resolve();
            onStateChange({ status: 'playing', station });
          },
          onLoad: () => onStateChange({ status: 'loading', station }),
          onError: () => guard.fallbackNow()
        });
        icyPlayer.play().catch(() => guard.fallbackNow());
      } catch (err) {
        guard.fallbackNow();
      }
    }).catch(() => playPlain(station, playUrl));
  }

  function play(station) {
    if (currentStation && currentStation.url === station.url && !audio.paused) {
      stop();
      return;
    }
    // iOS Safari/Chrome (same WebKit engine) only allow audio.play() to
    // start real playback when it's called synchronously inside the click
    // that triggered it — reject it otherwise, with no visible error. Below
    // this point, resolving playlists and lazy-loading the ICY/HLS library
    // from a CDN are both async (the CDN fetch alone is a real network
    // round trip on first use), so by the time we'd normally call play(),
    // that window has already closed. Calling it here — synchronously,
    // before any of that — "activates" this element for the gesture; once
    // an element has been activated this way, WebKit continues to honor
    // programmatic play() calls on it afterward, even asynchronous ones,
    // which is what actually starts the stream once the real URL is ready
    // further down. It's harmless if this fails (nothing valid is loaded
    // yet) or if it's not needed on a given browser.
    audio.play().catch(() => {});
    teardown();
    currentStation = station;
    onMetadata(null); // clear any previous track info immediately
    onStateChange({ status: 'loading', station });

    resolvePlaylistUrl(station.url).then(resolvedUrl => {
      if (currentStation !== station) return; // superseded by a newer play() call
      const playUrl = toPlayableUrl(resolvedUrl);
      if (isHlsUrl(playUrl)) {
        playViaHls(station, playUrl);
      } else {
        playViaIcecast(station, playUrl);
      }
    });
  }

  function stop() {
    teardown();
    currentStation = null;
    onMetadata(null);
    onStateChange({ status: 'stopped', station: null });
  }

  audio.addEventListener('playing', () => onStateChange({ status: 'playing', station: currentStation }));
  audio.addEventListener('waiting', () => onStateChange({ status: 'loading', station: currentStation }));
  audio.addEventListener('error', () => {
    onStateChange({ status: 'error', station: currentStation });
    currentStation = null;
  });

  function isPlaying(station) {
    return !!currentStation && currentStation.url === station.url && !audio.paused;
  }

  return { play, stop, isPlaying, setOnStateChange, setOnMetadata, get current() { return currentStation; } };
})();
