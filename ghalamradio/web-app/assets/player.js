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

  function playPlain(station) {
    audio.src = station.url;
    audio.play().catch(err => {
      console.warn('Plain audio fallback failed to play:', station.url, err && err.name, err && err.message);
      onStateChange({ status: 'error', station });
    });
  }

  function playViaHls(station) {
    loadHlsJs().then(Hls => {
      if (currentStation !== station) return; // superseded by a newer play() call
      if (!Hls.isSupported()) { playPlain(station); return; }
      hls = new Hls();
      hls.on(Hls.Events.ERROR, (evt, data) => {
        if (data.fatal) onStateChange({ status: 'error', station });
      });
      hls.on(Hls.Events.FRAG_PARSING_METADATA, (evt, data) => {
        const parsed = extractId3FromHlsEvent(data);
        if (parsed) onMetadata(parsed);
      });
      hls.loadSource(station.url);
      hls.attachMedia(audio);
      audio.play().catch(() => {});
    }).catch(() => playPlain(station));
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

  function playViaIcecast(station) {
    loadIcecastPlayer().then(IcecastMetadataPlayer => {
      if (currentStation !== station) return; // superseded by a newer play() call

      const guard = withFallbackTimeout(station, 8000, () => {
        console.warn('ICY playback stalled or failed — falling back to plain audio:', station.url);
        if (icyPlayer) { try { icyPlayer.detachAudioElement(); } catch {} icyPlayer = null; }
        // icecast-metadata-player's own error/cleanup chain doesn't finish in
        // this same tick — it calls audio.pause() on this shared element
        // shortly *after* returning from onError. Calling audio.play() here
        // synchronously races that trailing pause() and gets aborted
        // (AbortError: interrupted by a call to pause()). Deferring to the
        // next tick lets its cleanup fully settle before we touch the
        // element ourselves.
        setTimeout(() => {
          if (currentStation === station) playPlain(station);
        }, 50);
      });

      try {
        icyPlayer = new IcecastMetadataPlayer(station.url, {
          audioElement: audio,
          metadataTypes: ['icy'],
          enableLogging: false,
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
    }).catch(() => playPlain(station));
  }

  function play(station) {
    if (currentStation && currentStation.url === station.url && !audio.paused) {
      stop();
      return;
    }
    teardown();
    currentStation = station;
    onMetadata(null); // clear any previous track info immediately
    onStateChange({ status: 'loading', station });

    if (isHlsUrl(station.url)) {
      playViaHls(station);
    } else {
      playViaIcecast(station);
    }
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
