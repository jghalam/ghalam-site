// GhalamRadio Web — basic play/stop playback

const Player = (() => {
  const audio = new Audio();
  audio.preload = 'none';
  let currentStation = null;
  let onStateChange = () => {};

  function setOnStateChange(fn) { onStateChange = fn; }

  function play(station) {
    if (currentStation && currentStation.url === station.url) {
      // toggle: same station tapped again
      if (!audio.paused) { stop(); return; }
    }
    currentStation = station;
    audio.src = station.url;
    audio.play().catch(err => {
      console.error('Playback failed:', err);
      onStateChange({ status: 'error', station, error: err });
    });
    onStateChange({ status: 'loading', station });
  }

  function stop() {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    onStateChange({ status: 'stopped', station: currentStation });
    currentStation = null;
  }

  audio.addEventListener('playing', () => onStateChange({ status: 'playing', station: currentStation }));
  audio.addEventListener('waiting', () => onStateChange({ status: 'loading', station: currentStation }));
  audio.addEventListener('error', () => {
    onStateChange({ status: 'error', station: currentStation });
    currentStation = null; // playback failed — don't keep showing it as active
  });

  function isPlaying(station) {
    return currentStation && currentStation.url === station.url && !audio.paused;
  }

  return { play, stop, isPlaying, setOnStateChange, get current() { return currentStation; } };
})();
