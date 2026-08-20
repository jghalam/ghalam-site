// GhalamRadio Web — on-page debug console
//
// Chrome/Safari on iOS have no way to view console output without a cable
// and a Mac's Web Inspector. Visiting the site with ?debug=1 in the URL
// turns on a small on-screen panel that mirrors console.log/warn/error and
// any uncaught errors, with a "Copy log" button — so a log can be captured
// and shared from a phone alone. Loaded first (before every other script)
// so its console overrides are already in place if something throws during
// their own startup. Does nothing at all when the flag isn't present.

(function () {
  if (new URLSearchParams(location.search).get('debug') !== '1') return;

  function init() {
    const panel = document.createElement('div');
    panel.id = 'debugConsole';
    panel.style.cssText = [
      'position:fixed', 'left:0', 'right:0', 'bottom:0', 'z-index:99999',
      'max-height:45vh', 'display:flex', 'flex-direction:column',
      'background:rgba(5,6,10,0.96)', 'color:#d7dae2',
      'font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace',
      'border-top:2px solid #e3a83b',
      'padding-bottom:max(6px, env(safe-area-inset-bottom))'
    ].join(';');

    const toolbar = document.createElement('div');
    toolbar.style.cssText = 'display:flex; gap:6px; padding:6px 8px; flex-shrink:0;';
    function makeBtn(label) {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = 'background:#e3a83b; color:#151824; border:none; border-radius:6px; padding:4px 10px; font-size:12px; font-weight:600;';
      return b;
    }
    const copyBtn = makeBtn('Copy log');
    const clearBtn = makeBtn('Clear');
    const hideBtn = makeBtn('Hide');
    toolbar.append(copyBtn, clearBtn, hideBtn);

    const log = document.createElement('div');
    log.style.cssText = 'overflow-y:auto; padding:0 8px 8px; -webkit-overflow-scrolling:touch;';

    panel.append(toolbar, log);
    document.body.appendChild(panel);

    function addLine(level, args) {
      const line = document.createElement('div');
      line.style.cssText = 'white-space:pre-wrap; word-break:break-word; border-bottom:1px solid #2a2d3a; padding:3px 0;';
      line.style.color = level === 'error' ? '#ff8a8a' : level === 'warn' ? '#f0c060' : '#d7dae2';
      const text = args.map((a) => {
        if (a instanceof Error) return a.stack || a.message;
        if (typeof a === 'object' && a !== null) { try { return JSON.stringify(a); } catch (e) { return String(a); } }
        return String(a);
      }).join(' ');
      line.textContent = `[${new Date().toISOString().slice(11, 19)}] ${level}: ${text}`;
      log.appendChild(line);
      log.scrollTop = log.scrollHeight;
    }

    ['log', 'warn', 'error', 'info'].forEach((level) => {
      const original = console[level] ? console[level].bind(console) : function () {};
      console[level] = function (...args) {
        original(...args);
        addLine(level, args);
      };
    });

    window.addEventListener('error', (e) => {
      addLine('error', [`${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`]);
    });
    window.addEventListener('unhandledrejection', (e) => {
      addLine('error', ['Unhandled promise rejection:', e.reason]);
    });

    copyBtn.addEventListener('click', () => {
      const text = Array.from(log.children).map((l) => l.textContent).join('\n');
      const done = () => { copyBtn.textContent = 'Copied!'; setTimeout(() => { copyBtn.textContent = 'Copy log'; }, 1200); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, done);
      } else {
        // Fallback for browsers that won't allow clipboard writes here —
        // selects the text so it can be copied manually instead.
        const range = document.createRange();
        range.selectNodeContents(log);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });
    clearBtn.addEventListener('click', () => { log.innerHTML = ''; });
    hideBtn.addEventListener('click', () => {
      const isHidden = log.style.display === 'none';
      log.style.display = isHidden ? '' : 'none';
      hideBtn.textContent = isHidden ? 'Hide' : 'Show';
    });

    addLine('info', ['Debug console active — reload or replay the failing action now.']);
  }

  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init);
})();
