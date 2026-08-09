/* Custom tooltip positioner: keeps horizontal tracking (so you can still
   tell which date's tooltip you're looking at) but fixes the vertical
   position to the chart's vertical center, always. Chart.js's default
   positions the tooltip right at the hovered point, which means it can
   sit directly on top of the exact bubble or line point you're trying
   to click — this avoids that by keeping the tooltip out of the way of
   the data itself. */
if (typeof Chart !== 'undefined') {
  Chart.Tooltip.positioners.centerY = function (elements, eventPosition) {
    const chart = this.chart;
    return {
      x: eventPosition.x,
      y: chart.chartArea.top + (chart.chartArea.bottom - chart.chartArea.top) / 2,
    };
  };
}

/* ============================================================
   EasyView — indicator registry
   Curated list of chart-ready series (id must match a data/<id>.json
   file with {date, value} records). Series with multi-field records
   (debt_to_penny, interest_expense, CFTC positioning) aren't listed
   here directly — their derived single-value equivalents are
   (e.g. debt_to_gdp) — until they get their own chart treatment.
   ============================================================ */
const INDICATORS = [
  { id: 'cpi_yoy',           label: 'CPI (YoY)',            group: 'Inflation & Rates', unit: '%', color: '#c9a227', description: 'The Consumer Price Index — how much more expensive a typical basket of goods and services is than a year ago. The most widely cited measure of inflation.' },
  { id: 'cpi_core_yoy',      label: 'Core CPI (YoY)',       group: 'Inflation & Rates', unit: '%', color: '#e0bd4a', description: 'CPI excluding food and energy, whose prices swing a lot month to month. The Fed watches this closely to see the underlying inflation trend.' },
  { id: 'fed_funds',         label: 'Fed Funds Rate',       group: 'Inflation & Rates', unit: '%', color: '#7fb3d5', description: "The interest rate banks charge each other for overnight loans, set by the Federal Reserve. The Fed's main lever for tightening or loosening monetary policy." },
  { id: 'treasury_3mo',      label: '3M Treasury Yield',    group: 'Inflation & Rates', unit: '%', color: '#8b6bb0', description: 'Yield on U.S. government debt maturing in 3 months. Tracks the Fed Funds Rate closely and feeds into the recession probability model.' },
  { id: 'treasury_10y',      label: '10Y Treasury Yield',   group: 'Inflation & Rates', unit: '%', color: '#5b9bd5', description: 'Yield on U.S. government debt maturing in 10 years. A benchmark for mortgage rates and a gauge of investor expectations for growth and inflation.' },
  { id: 'real_yield_10y',    label: 'Real 10Y Yield',       group: 'Inflation & Rates', unit: '%', color: '#4f9d69', description: 'The 10-year Treasury yield minus CPI inflation — what lenders actually earn after inflation. Negative means lending money loses purchasing power.' },
  { id: 'unemployment',      label: 'Unemployment Rate',    group: 'Inflation & Rates', unit: '%', color: '#a389d4', description: "The U-3 rate — the share of the labor force that's jobless and actively looking for work." },
  { id: 'debt_to_gdp',       label: 'Debt / GDP',           group: 'Debt & Fiscal',     unit: '%', color: '#c9a227', description: "Total federal debt as a percentage of the economy's annual output. A common gauge of how sustainable a country's debt load is relative to its size." },
  { id: 'total_debt',        label: 'Total Public Debt',    group: 'Debt & Fiscal',     unit: '$', color: '#e0bd4a', description: 'The total amount the U.S. federal government currently owes, across all forms of debt.' },
  { id: 'deficit',           label: 'Monthly Deficit (+) / Surplus (\u2212)', group: 'Debt & Fiscal', unit: '$', color: '#b34a42', description: 'How much more (or less) the government spent than it collected that month. Positive = deficit, negative = surplus — the Treasury\u2019s own sign convention.' },
  { id: 'sp500',             label: 'S&P 500',              group: 'Markets',           unit: '',  color: '#c9a227', description: 'An index of 500 large U.S. companies, the standard benchmark for the overall U.S. stock market.' },
  { id: 'djia',              label: 'Dow Jones Industrial', group: 'Markets',           unit: '',  color: '#5b9bd5', description: 'An index of 30 large, established U.S. companies. Narrower and older than the S&P 500, but still widely watched.' },
  { id: 'nasdaq_composite',  label: 'Nasdaq Composite',     group: 'Markets',           unit: '',  color: '#4f9d69', description: 'An index of every company listed on the Nasdaq exchange, heavily weighted toward technology stocks.' },
  { id: 'usd_broad_index',   label: 'USD Broad Index',      group: 'Currency',          unit: '',  color: '#7fb3d5', description: "The Federal Reserve's trade-weighted measure of the dollar's value against a broad basket of foreign currencies." },
  { id: 'usd_vs_eur',        label: 'USD / EUR',            group: 'Currency',          unit: '',  color: '#e0bd4a', description: 'How many U.S. dollars it takes to buy one euro.' },
  { id: 'usd_vs_jpy',        label: 'USD / JPY',            group: 'Currency',          unit: '',  color: '#4f9d69', description: 'How many Japanese yen it takes to buy one U.S. dollar.' },
  { id: 'usd_vs_gbp',        label: 'USD / GBP',            group: 'Currency',          unit: '',  color: '#a389d4', description: 'How many U.S. dollars it takes to buy one British pound.' },
  { id: 'usd_vs_cny',        label: 'USD / CNY',            group: 'Currency',          unit: '',  color: '#b34a42', description: 'How many Chinese yuan it takes to buy one U.S. dollar.' },
  { id: 'gold_price',        label: 'Gold Price (USD/oz)',  group: 'Gold',              unit: '$', color: '#c9a227', description: "The price of one troy ounce of gold in U.S. dollars, from the LBMA's daily benchmark." },
  { id: 'recession_probability', label: 'Recession Probability (12mo, model est.)', group: 'Recession Model', unit: '%', color: '#b34a42', description: 'A modeled estimate of the odds of a recession within 12 months, based on the gap between long- and short-term Treasury yields. See the note below the chart for its real limitations.' },
];

const DEFAULT_ACTIVE = ['cpi_yoy', 'fed_funds', 'gold_price'];

// Must match forecast.py's FORECAST_CONFIG keys — only these have a
// forecast_<id>.json to show on the Forecast tab.
const FORECASTABLE_IDS = new Set([
  'cpi_yoy', 'cpi_core_yoy', 'fed_funds', 'treasury_10y', 'real_yield_10y',
  'unemployment', 'debt_to_gdp', 'gold_price', 'usd_broad_index',
]);

const forecastState = {
  active: new Set(),
  chart: null,
};

// Matches fetch_cofer.py's COFER_SERIES output exactly
const RESERVE_CURRENCIES = [
  { id: 'cofer_usd_share', label: 'USD', color: '#c9a227' },
  { id: 'cofer_eur_share', label: 'EUR', color: '#e0bd4a' },
  { id: 'cofer_jpy_share', label: 'JPY', color: '#4f9d69' },
  { id: 'cofer_gbp_share', label: 'GBP', color: '#a389d4' },
  { id: 'cofer_cny_share', label: 'CNY', color: '#b34a42' },
];

const reservesState = {
  cache: new Map(),   // id -> [{date, value}] or null if unavailable
  loaded: false,
  chart: null,
};

const state = {
  active: new Set(),
  cache: new Map(),         // id -> [{date: 'YYYY-MM-DD', value: number}]
  forecastCache: new Map(), // id -> [{date, value, lower, upper}] or null if none exists
  events: [],                // [{id, date, ts, title, narrative, linked_series}]
  minTs: null,
  maxTs: null,
  selectedTs: null,
  chart: null,
  chartZoomYears: 10,         // 'all' or a number of years — chart display only,
                               // independent of the slider's full-history bounds
  shownEventId: null,         // id of the event currently shown in the panel — only ever
                               // set by explicitly clicking a bubble, never by scrubbing
};

/* ---------- helpers ---------- */

function tsFromDateStr(s) {
  return Date.parse(s + 'T00:00:00Z');
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function formatValue(indicator, value) {
  if (value === null || value === undefined) return '—';
  const rounded = Math.abs(value) >= 100 ? value.toFixed(1) : value.toFixed(2);
  if (indicator.unit === '%') return `${rounded}%`;
  if (indicator.unit === '$') {
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
    return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }
  return rounded;
}

function indicatorById(id) {
  return INDICATORS.find(i => i.id === id);
}

/* nearest value at-or-before a timestamp; falls back to nearest after
   if nothing precedes it (e.g. scrubbed before a series' start date) */
function valueAtOrBefore(records, ts) {
  let best = null;
  for (const r of records) {
    const rTs = tsFromDateStr(r.date);
    if (rTs <= ts) {
      if (best === null || rTs > tsFromDateStr(best.date)) best = r;
    }
  }
  if (best) return best.value;
  return records.length ? records[0].value : null;
}

/* ---------- data loading ---------- */

async function loadIndicator(id) {
  if (state.cache.has(id)) return state.cache.get(id);
  const res = await fetch(`../data/${id}.json`);
  if (!res.ok) throw new Error(`data/${id}.json — ${res.status}`);
  const payload = await res.json();
  state.cache.set(id, payload.records);
  return payload.records;
}

async function loadForecast(id) {
  if (state.forecastCache.has(id)) return state.forecastCache.get(id);
  try {
    const res = await fetch(`../data/forecast_${id}.json`);
    if (!res.ok) {
      state.forecastCache.set(id, null);   // no forecast for this indicator — expected, not an error
      return null;
    }
    const payload = await res.json();
    state.forecastCache.set(id, payload.records);
    return payload.records;
  } catch (err) {
    state.forecastCache.set(id, null);
    return null;
  }
}

function recomputeBounds() {
  let min = null, max = null;
  for (const id of state.active) {
    const records = state.cache.get(id);
    if (!records || !records.length) continue;
    const first = tsFromDateStr(records[0].date);
    const last = tsFromDateStr(records[records.length - 1].date);
    if (min === null || first < min) min = first;
    if (max === null || last > max) max = last;
  }
  if (min === null) {
    // no active indicators — keep a sane default range rather than a broken slider
    min = tsFromDateStr('1970-01-01');
    max = Date.now();
  }
  state.minTs = min;
  state.maxTs = max;
  if (state.selectedTs === null || state.selectedTs < min || state.selectedTs > max) {
    state.selectedTs = max;
  }
}

/* ---------- picker UI ---------- */

/* ---------- chip help tooltip ---------- */

let chipTooltipEl = null;

function getChipTooltipEl() {
  if (!chipTooltipEl) {
    chipTooltipEl = document.createElement('div');
    chipTooltipEl.className = 'chip-tooltip';
    chipTooltipEl.hidden = true;
    document.body.appendChild(chipTooltipEl);
  }
  return chipTooltipEl;
}

function showChipTooltip(anchor, text) {
  const tooltip = getChipTooltipEl();
  tooltip.textContent = text;
  tooltip.hidden = false;
  tooltip.classList.remove('visible');

  const rect = anchor.getBoundingClientRect();
  const tooltipWidth = tooltip.offsetWidth;
  const tooltipHeight = tooltip.offsetHeight;

  let left = rect.left + rect.width / 2 - tooltipWidth / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - tooltipWidth - 8));

  let top = rect.top - tooltipHeight - 8;
  if (top < 8) top = rect.bottom + 8;   // not enough room above — show below instead

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  requestAnimationFrame(() => tooltip.classList.add('visible'));
}

function hideChipTooltip() {
  if (chipTooltipEl) {
    chipTooltipEl.classList.remove('visible');
    chipTooltipEl.hidden = true;
  }
}

window.addEventListener('scroll', hideChipTooltip, true);

function buildPickerInto(containerId, indicatorList, onToggle) {
  const groups = {};
  for (const ind of indicatorList) {
    (groups[ind.group] = groups[ind.group] || []).push(ind);
  }

  const container = document.getElementById(containerId);
  container.innerHTML = '';

  for (const [groupName, inds] of Object.entries(groups)) {
    const label = document.createElement('div');
    label.className = 'picker-group-label';
    label.textContent = groupName;
    container.appendChild(label);

    const row = document.createElement('div');
    row.className = 'picker-chips';
    for (const ind of inds) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.dataset.id = ind.id;
      chip.innerHTML = `<span class="chip-swatch" style="background:${ind.color}"></span>${ind.label}`;
      chip.addEventListener('click', () => onToggle(ind.id, chip));
      if (ind.description) {
        chip.addEventListener('mouseenter', () => showChipTooltip(chip, ind.description));
        chip.addEventListener('mouseleave', hideChipTooltip);
        chip.addEventListener('focus', () => showChipTooltip(chip, ind.description));
        chip.addEventListener('blur', hideChipTooltip);
      }
      row.appendChild(chip);
    }
    container.appendChild(row);
  }
}

function buildPicker() {
  buildPickerInto('pickerGroups', INDICATORS, toggleIndicator);
}

function buildForecastPicker() {
  const forecastable = INDICATORS.filter(ind => FORECASTABLE_IDS.has(ind.id));
  buildPickerInto('forecastPickerGroups', forecastable, toggleForecastIndicator);
}

async function toggleIndicator(id, chipEl) {
  if (state.active.has(id)) {
    state.active.delete(id);
    chipEl.classList.remove('active');
  } else {
    chipEl.classList.add('active');
    try {
      await loadIndicator(id);
      state.active.add(id);
      await loadForecast(id);   // best-effort — not every indicator has a forecast
    } catch (err) {
      chipEl.classList.remove('active');
      chipEl.classList.add('chip-error');
      console.error(err);
      setStatus(`Couldn't load ${id}`, 'error');
      return;
    }
  }
  recomputeBounds();
  syncSliderBounds();
  renderChart();
  renderSnapshot();
  updateModelNoteVisibility();
}

function updateModelNoteVisibility() {
  const note = document.getElementById('recessionModelNote');
  note.hidden = !state.active.has('recession_probability');
}

async function toggleForecastIndicator(id, chipEl) {
  if (forecastState.active.has(id)) {
    forecastState.active.delete(id);
    chipEl.classList.remove('active');
  } else {
    chipEl.classList.add('active');
    try {
      await loadIndicator(id);   // shares the same cache as the Historical tab
      await loadForecast(id);
      forecastState.active.add(id);
    } catch (err) {
      chipEl.classList.remove('active');
      chipEl.classList.add('chip-error');
      console.error(err);
      return;
    }
  }
  renderForecastChart();
}

/* ---------- slider ---------- */

const DAY_MS = 86400000;

function syncSliderBounds() {
  const slider = document.getElementById('timelineSlider');
  slider.min = Math.floor(state.minTs / DAY_MS);
  slider.max = Math.floor(state.maxTs / DAY_MS);
  slider.value = Math.floor(state.selectedTs / DAY_MS);
  updateSliderFill();
  updateDateReadout();
}

function updateSliderFill() {
  const slider = document.getElementById('timelineSlider');
  const pct = slider.max > slider.min
    ? ((slider.value - slider.min) / (slider.max - slider.min)) * 100
    : 0;
  slider.style.setProperty('--fill', `${pct}%`);
}

function updateDateReadout() {
  document.getElementById('boundStart').textContent = formatDate(state.minTs);
  document.getElementById('boundEnd').textContent = formatDate(state.maxTs);
  document.getElementById('snapshotDate').textContent = formatDate(state.selectedTs);
}

function initSlider() {
  const slider = document.getElementById('timelineSlider');
  slider.addEventListener('input', () => {
    state.selectedTs = Number(slider.value) * DAY_MS;
    updateSliderFill();
    updateDateReadout();
    renderChart();   // redraw crosshair position
    renderSnapshot();
    // deliberately NOT touching the event panel here — scrubbing should
    // never show, hide, or otherwise affect it; only clicking a bubble does
  });
}

/* ---------- chart zoom (display only — does not affect the slider) ---------- */

const YEAR_MS = 365.25 * DAY_MS;

/* Computes the chart's visible [min, max] window for the current zoom
   level. Normally this is just "the most recent N years" (unchanged
   behavior), but if the currently selected/scrubbed date falls OUTSIDE
   that default window, the window pans to center on the selected date
   instead — so picking an old date on the slider while zoomed to e.g.
   1Y doesn't leave the crosshair off-screen. Forecast extension only
   applies to the natural (unpanned, "current") view — panning back to
   view a past date has no reason to also show the projection. */
function computeChartWindow(forecastMaxTs) {
  const naturalMax = forecastMaxTs !== null ? Math.max(state.maxTs, forecastMaxTs) : state.maxTs;

  if (state.chartZoomYears === 'all' || state.minTs === null || state.maxTs === null) {
    return { min: state.minTs, max: naturalMax };
  }

  const spanMs = state.chartZoomYears * YEAR_MS;
  const defaultMin = Math.max(state.minTs, state.maxTs - spanMs);

  if (state.selectedTs === null || state.selectedTs >= defaultMin) {
    return { min: defaultMin, max: naturalMax };   // default "recent" view, forecast included
  }

  // Selected date is older than the default window — pan to show it,
  // centered within the same zoom span, clamped to real data bounds.
  let panMin = state.selectedTs - spanMs / 2;
  let panMax = panMin + spanMs;
  if (panMin < state.minTs) {
    panMin = state.minTs;
    panMax = panMin + spanMs;
  }
  if (panMax > state.maxTs) {
    panMax = state.maxTs;
    panMin = Math.max(state.minTs, panMax - spanMs);
  }
  return { min: panMin, max: panMax };
}

function initChartZoom() {
  const buttons = document.querySelectorAll('#chartZoom .zoom-btn');
  for (const btn of buttons) {
    btn.addEventListener('click', () => {
      const years = btn.dataset.years;
      state.chartZoomYears = years === 'all' ? 'all' : Number(years);
      for (const b of buttons) b.classList.toggle('active', b === btn);
      renderChart();
    });
  }
}

/* ---------- events ---------- */

async function loadEvents() {
  try {
    const res = await fetch('../data/events.json');
    if (!res.ok) {
      // no events.json yet (nothing published) is a normal, expected state —
      // not an error worth surfacing to the status pill
      state.events = [];
      return;
    }
    const raw = await res.json();
    state.events = raw.map(e => ({ ...e, ts: tsFromDateStr(e.date) }));
  } catch (err) {
    console.error('Failed to load events:', err);
    state.events = [];
  }
}

function jumpToDate(ts) {
  state.selectedTs = ts;
  const slider = document.getElementById('timelineSlider');
  slider.value = Math.floor(ts / DAY_MS);
  updateSliderFill();
  updateDateReadout();
  renderChart();
  renderSnapshot();
  renderEventPanel();   // shows whatever shownEventId the caller set, if any
}

/* Used while dragging on the chart — the underlying line data hasn't
   changed, only the crosshair position, so this skips buildDatasets()
   entirely and just asks Chart.js to redraw (which re-runs crosshairPlugin
   with the new state.selectedTs). Much cheaper than jumpToDate() for
   something that can fire many times per second during a drag. */
function updateSelectedDateLight(ts) {
  state.selectedTs = Math.max(state.minTs, Math.min(state.maxTs, ts));
  const slider = document.getElementById('timelineSlider');
  slider.value = Math.floor(state.selectedTs / DAY_MS);
  updateSliderFill();
  updateDateReadout();
  if (state.chart) state.chart.update('none');
  renderSnapshot();
  // deliberately NOT touching the event panel here — same reasoning as the slider
}

function renderEventPanel() {
  const panel = document.getElementById('eventPanel');
  const ev = state.shownEventId ? state.events.find(e => e.id === state.shownEventId) : null;

  if (!ev) {
    panel.hidden = true;
    return;
  }

  panel.hidden = false;
  document.getElementById('eventDate').textContent = formatDate(ev.ts);
  document.getElementById('eventTitle').textContent = ev.title;
  document.getElementById('eventNarrative').textContent = ev.narrative;
  const linkedLabels = (ev.linked_series || [])
    .map(id => (indicatorById(id) ? indicatorById(id).label : id));
  document.getElementById('eventLinked').textContent = linkedLabels.length
    ? `Evidence: ${linkedLabels.join(', ')}`
    : '';

  positionEventPanel();
}

/* Positions the popup so its tail points at the event's actual bubble on
   the chart. Called both when the popup first opens and after every full
   chart re-render (zoom change, scrub-triggered pan, etc.) so the tail
   stays accurate — this only ever moves the popup, never changes whether
   it's shown, keeping the earlier "scrubbing doesn't affect the popup"
   behavior intact. */
function positionEventPanel() {
  const panel = document.getElementById('eventPanel');
  if (panel.hidden || !state.shownEventId) return;

  const wrap = document.querySelector('#tabHistorical .chart-wrap');
  const bubble = drawnEventBubbles.find(b => b.event.id === state.shownEventId);
  if (!wrap || !bubble) return;   // event isn't currently drawn (e.g. no longer in an active series) — leave position as-is

  const PADDING = 8;
  const GAP = 12;   // space between the tail tip and the bubble itself
  const popupWidth = panel.offsetWidth || 320;
  const wrapWidth = wrap.clientWidth;
  const wrapHeight = wrap.clientHeight;

  let left = bubble.px - popupWidth / 2;
  left = Math.max(PADDING, Math.min(left, wrapWidth - popupWidth - PADDING));

  const tailLeft = Math.max(16, Math.min(bubble.px - left, popupWidth - 16));

  const bottom = (wrapHeight - bubble.py) + GAP;

  panel.style.left = `${left}px`;
  panel.style.bottom = `${bottom}px`;
  panel.style.setProperty('--tail-left', `${tailLeft}px`);
}

function showEvent(ev) {
  state.shownEventId = ev.id;
  jumpToDate(ev.ts);   // also moves the crosshair/snapshot to match, since you clicked a specific point
}

function dismissEventPanel() {
  state.shownEventId = null;
  renderEventPanel();
}

/* ---------- chart ---------- */

const crosshairPlugin = {
  id: 'crosshair',
  afterDraw(chart) {
    if (state.selectedTs === null || !chart.scales.x) return;
    const x = chart.scales.x.getPixelForValue(state.selectedTs);
    if (x < chart.chartArea.left || x > chart.chartArea.right) return;
    const { ctx, chartArea } = chart;
    ctx.save();
    ctx.strokeStyle = 'rgba(224, 189, 74, 0.55)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.stroke();
    ctx.restore();
  },
};

/* Positions of the last-drawn event bubbles, in canvas pixel coordinates —
   used by the click handler below to detect when someone clicks directly
   on one. Rebuilt every time the plugin draws. */
let drawnEventBubbles = [];

/* Draws a circular marker directly on a dataset's line at the date of any
   curated ("major") event linked to that specific indicator. Only curated
   events, deliberately — auto-detected candidates would clutter the chart
   with statistical noise rather than genuinely notable moments. */
/* Event bubble radius scales gently with zoom level — bigger as you zoom
   in, small enough steps that it reads as "the view is zooming" rather
   than the markers suddenly demanding attention or crowding the chart. */
const EVENT_BUBBLE_RADII = { all: 4, 10: 7, 5: 10, 1: 13 };
function eventBubbleRadius() {
  return EVENT_BUBBLE_RADII[state.chartZoomYears] ?? 6;
}

const eventBubblePlugin = {
  id: 'eventBubbles',
  afterDatasetsDraw(chart) {
    drawnEventBubbles = [];
    if (!state.events || !state.events.length || !chart.scales.x) return;
    const xScale = chart.scales.x;

    const activeIndicatorIds = new Set(
      chart.data.datasets.map(d => d._indicatorId).filter(Boolean)
    );
    if (!activeIndicatorIds.size) return;

    const y = chart.chartArea.bottom - 14;   // one fixed row, just above the x-axis labels

    for (const ev of state.events) {
      if (!ev.curated) continue;
      if (!ev.linked_series || !ev.linked_series.some(id => activeIndicatorIds.has(id))) continue;
      if (ev.ts < xScale.min || ev.ts > xScale.max) continue;

      const px = xScale.getPixelForValue(ev.ts);
      const radius = eventBubbleRadius();
      drawnEventBubbles.push({ px, py: y, radius, event: ev });

      chart.ctx.save();
      chart.ctx.beginPath();
      chart.ctx.arc(px, y, radius, 0, Math.PI * 2);
      chart.ctx.fillStyle = '#e0bd4a';
      chart.ctx.fill();
      chart.ctx.lineWidth = 1.5;
      chart.ctx.strokeStyle = '#0d0f14';
      chart.ctx.stroke();
      chart.ctx.restore();
    }
  },
};

const emptyStatePlugin = {
  id: 'emptyState',
  afterDraw(chart) {
    if (chart.data.datasets.length > 0) return;
    const { ctx, chartArea } = chart;
    ctx.save();
    ctx.fillStyle = '#565c6c';
    ctx.font = '14px "DM Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      'Select an indicator above to begin.',
      (chartArea.left + chartArea.right) / 2,
      (chartArea.top + chartArea.bottom) / 2
    );
    ctx.restore();
  },
};

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* Builds the (band-upper, band-lower, dashed-line) datasets for a forecast,
   continuous with the last real historical point. Shared by both the
   Historical tab's overlay and the dedicated Forecast tab, so the
   anchor-continuity and fill-ordering logic — both verified by tests —
   only exists in one place. Returns null if there's no forecast or no
   historical anchor point to continue from. */
function buildForecastOverlay(ind, records, forecast, yAxisID) {
  if (!forecast || !forecast.length || !records.length) return null;

  const anchor = records[records.length - 1];
  const anchorPoint = { x: tsFromDateStr(anchor.date), y: anchor.value };

  const upperData = [anchorPoint, ...forecast.map(r => ({ x: tsFromDateStr(r.date), y: r.upper }))];
  const lowerData = [anchorPoint, ...forecast.map(r => ({ x: tsFromDateStr(r.date), y: r.lower }))];
  const lineData = [anchorPoint, ...forecast.map(r => ({ x: tsFromDateStr(r.date), y: r.value }))];
  const lastForecastTs = tsFromDateStr(forecast[forecast.length - 1].date);

  return {
    lastForecastTs,
    datasets: [
      // upper and lower pushed adjacently so lower's fill:'-1' shades exactly
      // between them — order matters for Chart.js's relative fill index
      { label: `${ind.label} (forecast band)`, data: upperData, borderWidth: 0, pointRadius: 0, fill: false, yAxisID },
      { label: `${ind.label} (forecast band)`, data: lowerData, borderWidth: 0, pointRadius: 0, fill: '-1', backgroundColor: hexToRgba(ind.color, 0.12), yAxisID },
      { label: `${ind.label} (forecast)`, data: lineData, borderColor: ind.color, backgroundColor: 'transparent', borderDash: [6, 4], borderWidth: 2, pointRadius: 0, tension: 0.15, fill: false, yAxisID },
    ],
  };
}

function buildDatasets() {
  const usesPct = [...state.active].some(id => indicatorById(id).unit === '%');
  const usesOther = [...state.active].some(id => indicatorById(id).unit !== '%');

  const datasets = [];
  let maxForecastTs = null;

  for (const id of state.active) {
    const ind = indicatorById(id);
    const records = state.cache.get(id) || [];
    const yAxisID = ind.unit === '%' ? 'yPct' : 'yOther';

    datasets.push({
      label: ind.label,
      data: records.map(r => ({ x: tsFromDateStr(r.date), y: r.value })),
      borderColor: ind.color,
      backgroundColor: 'transparent',
      pointRadius: 0,
      borderWidth: 2,
      tension: 0.15,
      yAxisID,
      spanGaps: true,
      _indicatorId: id,   // used by eventBubblePlugin to match events to the right line
    });

    const overlay = buildForecastOverlay(ind, records, state.forecastCache.get(id), yAxisID);
    if (overlay) {
      datasets.push(...overlay.datasets);
      if (maxForecastTs === null || overlay.lastForecastTs > maxForecastTs) maxForecastTs = overlay.lastForecastTs;
    }
  }

  return { datasets, usesPct, usesOther, maxForecastTs };
}

function renderChart() {
  if (typeof Chart === 'undefined') {
    setStatus('chart library failed to load — check your connection and reload', 'error');
    return;
  }

  const ctx = document.getElementById('mainChart').getContext('2d');
  const { datasets, usesPct, usesOther, maxForecastTs } = buildDatasets();
  const { min: chartMinTs, max: chartMaxTs } = computeChartWindow(maxForecastTs);

  const scales = {
    x: {
      type: 'linear',
      min: chartMinTs,
      max: chartMaxTs,
      ticks: {
        color: '#8b90a0',
        font: { family: 'JetBrains Mono', size: 10 },
        callback: (val) => new Date(val).toLocaleDateString('en-US', { year: 'numeric', month: 'short', timeZone: 'UTC' }),
        maxRotation: 0,
        autoSkip: true,
        autoSkipPadding: 24,
      },
      grid: { color: '#1c2029' },
    },
  };
  if (usesPct) {
    scales.yPct = {
      position: 'left',
      ticks: { color: '#8b90a0', font: { family: 'JetBrains Mono', size: 10 }, callback: v => `${v}%` },
      grid: { color: '#1c2029' },
    };
  }
  if (usesOther) {
    scales.yOther = {
      position: 'right',
      ticks: { color: '#8b90a0', font: { family: 'JetBrains Mono', size: 10 } },
      grid: { drawOnChartArea: false },
    };
  }

  if (state.chart) {
    state.chart.data.datasets = datasets;
    state.chart.options.scales = scales;
    state.chart.update('none');
    positionEventPanel();   // keep the tail accurate if the view just panned/zoomed
    return;
  }

  state.chart = new Chart(ctx, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#e8e6df',
            font: { family: 'DM Sans', size: 12 },
            boxWidth: 10,
            usePointStyle: true,
            filter: (item) => !item.text.includes('(forecast') && !item.text.includes('(forecast band)'),
          },
        },
        tooltip: {
          backgroundColor: '#191d27',
          borderColor: '#262b38',
          borderWidth: 1,
          titleFont: { family: 'JetBrains Mono', size: 14, weight: '700' },
          bodyFont: { family: 'JetBrains Mono', size: 11 },
          position: 'centerY',
          callbacks: {
            title: (items) => (items.length ? formatDate(items[0].parsed.x) : ''),
          },
          filter: (item) => !item.dataset.label.includes('(forecast band)'),
        },
      },
      scales,
    },
    plugins: [crosshairPlugin, eventBubblePlugin, emptyStatePlugin],
  });
  positionEventPanel();

  const HIT_MARGIN = 4;   // extra tap tolerance beyond the drawn radius, for comfortable clicking
  function findBubbleAt(clientX, clientY) {
    const rect = state.chart.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    for (const b of drawnEventBubbles) {
      if (Math.hypot(b.px - x, b.py - y) <= b.radius + HIT_MARGIN) return b;
    }
    return null;
  }

  function pixelToTs(clientX) {
    const rect = state.chart.canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    return state.chart.scales.x.getValueForPixel(canvasX);
  }

  let isDraggingChart = false;
  let latestDragClientX = null;
  let dragRAFPending = false;

  function processDragFrame() {
    dragRAFPending = false;
    if (!isDraggingChart || latestDragClientX === null) return;
    updateSelectedDateLight(pixelToTs(latestDragClientX));
  }

  state.chart.canvas.addEventListener('mousedown', (e) => {
    const hit = findBubbleAt(e.clientX, e.clientY);
    if (hit) {
      showEvent(hit.event);   // discrete jump to a specific event — not a drag
      return;
    }
    isDraggingChart = true;
    updateSelectedDateLight(pixelToTs(e.clientX));
  });

  window.addEventListener('mousemove', (e) => {
    if (isDraggingChart) {
      latestDragClientX = e.clientX;
      if (!dragRAFPending) {
        dragRAFPending = true;
        requestAnimationFrame(processDragFrame);
      }
      return;
    }
    // not dragging — just show pointer cursor when hovering a bubble or the plot area
    const rect = state.chart.canvas.getBoundingClientRect();
    const withinChart = e.clientX >= rect.left && e.clientX <= rect.right
      && e.clientY >= rect.top && e.clientY <= rect.bottom;
    state.chart.canvas.style.cursor = withinChart ? (findBubbleAt(e.clientX, e.clientY) ? 'pointer' : 'crosshair') : '';
  });

  window.addEventListener('mouseup', () => {
    isDraggingChart = false;
  });

  state.chart.canvas.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    const hit = findBubbleAt(touch.clientX, touch.clientY);
    if (hit) {
      showEvent(hit.event);
      return;
    }
    isDraggingChart = true;
    updateSelectedDateLight(pixelToTs(touch.clientX));
    e.preventDefault();   // prevents the page from scrolling while dragging the chart
  }, { passive: false });

  state.chart.canvas.addEventListener('touchmove', (e) => {
    if (!isDraggingChart) return;
    latestDragClientX = e.touches[0].clientX;
    if (!dragRAFPending) {
      dragRAFPending = true;
      requestAnimationFrame(processDragFrame);
    }
    e.preventDefault();
  }, { passive: false });

  state.chart.canvas.addEventListener('touchend', () => {
    isDraggingChart = false;
  });
}

/* ---------- forecast tab chart ---------- */

function renderForecastChart() {
  if (typeof Chart === 'undefined') return;   // historical tab's check already surfaces this in the status pill

  if (forecastState.chart) {
    forecastState.chart.destroy();
    forecastState.chart = null;
  }

  const ctx = document.getElementById('forecastChart').getContext('2d');

  if (forecastState.active.size === 0) {
    forecastState.chart = new Chart(ctx, {
      type: 'line',
      data: { datasets: [] },
      options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } }, scales: {} },
      plugins: [emptyStatePlugin],
    });
    return;
  }

  // "today" for this tab = the most recent historical date among the active indicators
  let recentAnchorTs = null;
  for (const id of forecastState.active) {
    const records = state.cache.get(id) || [];
    if (!records.length) continue;
    const last = tsFromDateStr(records[records.length - 1].date);
    if (recentAnchorTs === null || last > recentAnchorTs) recentAnchorTs = last;
  }
  if (recentAnchorTs === null) recentAnchorTs = Date.now();
  const chartMinTs = recentAnchorTs - YEAR_MS;   // last 12 months only

  const usesPct = [...forecastState.active].some(id => indicatorById(id).unit === '%');
  const usesOther = [...forecastState.active].some(id => indicatorById(id).unit !== '%');

  const datasets = [];
  let chartMaxTs = recentAnchorTs;

  for (const id of forecastState.active) {
    const ind = indicatorById(id);
    const records = state.cache.get(id) || [];
    const yAxisID = ind.unit === '%' ? 'yPct' : 'yOther';
    const trimmed = records.filter(r => tsFromDateStr(r.date) >= chartMinTs);

    datasets.push({
      label: ind.label,
      data: trimmed.map(r => ({ x: tsFromDateStr(r.date), y: r.value })),
      borderColor: ind.color,
      backgroundColor: 'transparent',
      pointRadius: 0,
      borderWidth: 2,
      tension: 0.15,
      yAxisID,
      spanGaps: true,
    });

    const overlay = buildForecastOverlay(ind, records, state.forecastCache.get(id), yAxisID);
    if (overlay) {
      datasets.push(...overlay.datasets);
      if (overlay.lastForecastTs > chartMaxTs) chartMaxTs = overlay.lastForecastTs;
    }
  }

  const scales = {
    x: {
      type: 'linear',
      min: chartMinTs,
      max: chartMaxTs,
      ticks: {
        color: '#8b90a0',
        font: { family: 'JetBrains Mono', size: 10 },
        callback: (val) => new Date(val).toLocaleDateString('en-US', { year: 'numeric', month: 'short', timeZone: 'UTC' }),
        maxRotation: 0,
        autoSkip: true,
        autoSkipPadding: 24,
      },
      grid: { color: '#1c2029' },
    },
  };
  if (usesPct) {
    scales.yPct = { position: 'left', ticks: { color: '#8b90a0', font: { family: 'JetBrains Mono', size: 10 }, callback: v => `${v}%` }, grid: { color: '#1c2029' } };
  }
  if (usesOther) {
    scales.yOther = { position: 'right', ticks: { color: '#8b90a0', font: { family: 'JetBrains Mono', size: 10 } }, grid: { drawOnChartArea: false } };
  }

  forecastState.chart = new Chart(ctx, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#e8e6df',
            font: { family: 'DM Sans', size: 12 },
            boxWidth: 10,
            usePointStyle: true,
            filter: (item) => !item.text.includes('(forecast'),
          },
        },
        tooltip: {
          backgroundColor: '#191d27',
          borderColor: '#262b38',
          borderWidth: 1,
          titleFont: { family: 'JetBrains Mono', size: 14, weight: '700' },
          bodyFont: { family: 'JetBrains Mono', size: 11 },
          position: 'centerY',
          callbacks: {
            title: (items) => (items.length ? formatDate(items[0].parsed.x) : ''),
          },
          filter: (item) => !item.dataset.label.includes('(forecast band)'),
        },
      },
      scales,
    },
    plugins: [emptyStatePlugin],
  });
}

/* ---------- reserves tab ---------- */

async function loadReservesData() {
  if (reservesState.loaded) return;
  for (const cur of RESERVE_CURRENCIES) {
    try {
      const res = await fetch(`../data/${cur.id}.json`);
      if (!res.ok) {
        reservesState.cache.set(cur.id, null);
        continue;
      }
      const payload = await res.json();
      reservesState.cache.set(cur.id, payload.records);
    } catch (err) {
      console.error(`Failed to load ${cur.id}:`, err);
      reservesState.cache.set(cur.id, null);
    }
  }
  reservesState.loaded = true;
}

function renderReservesChart() {
  if (typeof Chart === 'undefined') return;

  if (reservesState.chart) {
    reservesState.chart.destroy();
    reservesState.chart = null;
  }

  const ctx = document.getElementById('reservesChart').getContext('2d');
  const datasets = [];
  let minTs = null, maxTs = null;

  for (const cur of RESERVE_CURRENCIES) {
    const records = reservesState.cache.get(cur.id);
    if (!records || !records.length) continue;
    const first = tsFromDateStr(records[0].date);
    const last = tsFromDateStr(records[records.length - 1].date);
    if (minTs === null || first < minTs) minTs = first;
    if (maxTs === null || last > maxTs) maxTs = last;

    datasets.push({
      label: cur.label,
      data: records.map(r => ({ x: tsFromDateStr(r.date), y: r.value })),
      borderColor: cur.color,
      backgroundColor: 'transparent',
      pointRadius: 0,
      borderWidth: 2,
      tension: 0.15,
      spanGaps: true,
    });
  }

  reservesState.chart = new Chart(ctx, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: '#e8e6df', font: { family: 'DM Sans', size: 12 }, boxWidth: 10, usePointStyle: true },
        },
        tooltip: {
          backgroundColor: '#191d27',
          borderColor: '#262b38',
          borderWidth: 1,
          titleFont: { family: 'JetBrains Mono', size: 14, weight: '700' },
          bodyFont: { family: 'JetBrains Mono', size: 11 },
          position: 'centerY',
          callbacks: {
            title: (items) => (items.length ? formatDate(items[0].parsed.x) : ''),
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          min: minTs,
          max: maxTs,
          ticks: {
            color: '#8b90a0',
            font: { family: 'JetBrains Mono', size: 10 },
            callback: (val) => new Date(val).toLocaleDateString('en-US', { year: 'numeric', month: 'short', timeZone: 'UTC' }),
            maxRotation: 0,
            autoSkip: true,
            autoSkipPadding: 24,
          },
          grid: { color: '#1c2029' },
        },
        y: {
          ticks: { color: '#8b90a0', font: { family: 'JetBrains Mono', size: 10 }, callback: v => `${v}%` },
          grid: { color: '#1c2029' },
        },
      },
    },
    plugins: [emptyStatePlugin],
  });
}

function renderReservesSnapshot() {
  const grid = document.getElementById('reservesSnapshotGrid');
  grid.innerHTML = '';

  let latestDateTs = null;
  for (const cur of RESERVE_CURRENCIES) {
    const records = reservesState.cache.get(cur.id);
    if (!records || !records.length) continue;
    const lastTs = tsFromDateStr(records[records.length - 1].date);
    if (latestDateTs === null || lastTs > latestDateTs) latestDateTs = lastTs;
  }
  document.getElementById('reservesDate').textContent = latestDateTs !== null ? formatDate(latestDateTs) : '\u2014';

  for (const cur of RESERVE_CURRENCIES) {
    const records = reservesState.cache.get(cur.id);
    const item = document.createElement('div');
    item.className = 'snapshot-item';
    const dt = document.createElement('dt');
    dt.textContent = cur.label;
    const dd = document.createElement('dd');
    dd.textContent = records && records.length ? `${records[records.length - 1].value.toFixed(2)}%` : '\u2014';
    item.appendChild(dt);
    item.appendChild(dd);
    grid.appendChild(item);
  }
}

async function activateReservesTab() {
  await loadReservesData();
  renderReservesChart();
  renderReservesSnapshot();
}

/* ---------- tabs ---------- */

function initTabs() {
  const tabs = [
    { btn: document.getElementById('tabBtnHistorical'), panel: document.getElementById('tabHistorical'), onActivate: null },
    { btn: document.getElementById('tabBtnForecast'), panel: document.getElementById('tabForecast'), onActivate: renderForecastChart },
    { btn: document.getElementById('tabBtnReserves'), panel: document.getElementById('tabReserves'), onActivate: activateReservesTab },
  ];

  for (const tab of tabs) {
    tab.btn.addEventListener('click', () => {
      for (const other of tabs) {
        const isActive = other === tab;
        other.btn.classList.toggle('active', isActive);
        other.btn.setAttribute('aria-selected', String(isActive));
        other.panel.hidden = !isActive;
      }
      // (re)build charts now that the canvas is actually visible and sized correctly
      if (tab.onActivate) tab.onActivate();
    });
  }
}

/* ---------- snapshot ---------- */

function renderSnapshot() {
  const grid = document.getElementById('snapshotGrid');
  grid.innerHTML = '';

  if (state.active.size === 0) {
    const empty = document.createElement('p');
    empty.className = 'snapshot-empty';
    empty.textContent = 'Select an indicator above to see its value here.';
    grid.appendChild(empty);
    return;
  }

  for (const id of state.active) {
    const ind = indicatorById(id);
    const records = state.cache.get(id) || [];
    const value = valueAtOrBefore(records, state.selectedTs);

    const item = document.createElement('div');
    item.className = 'snapshot-item';
    const dt = document.createElement('dt');
    dt.textContent = ind.label;
    const dd = document.createElement('dd');
    dd.textContent = formatValue(ind, value);
    item.appendChild(dt);
    item.appendChild(dd);
    grid.appendChild(item);
  }
}

/* ---------- status pill ---------- */

function setStatus(text, kind) {
  const pill = document.getElementById('statusPill');
  pill.textContent = text;
  pill.className = 'status' + (kind ? ` ${kind}` : '');
}

async function loadManifestStatus() {
  try {
    const res = await fetch('../data/manifest.json');
    if (!res.ok) throw new Error(String(res.status));
    const manifest = await res.json();
    const timestamps = Object.values(manifest).map(m => new Date(m.updated).getTime()).filter(Boolean);
    if (timestamps.length) {
      const latest = new Date(Math.max(...timestamps));
      setStatus(`data as of ${latest.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })}`, 'ready');
    } else {
      setStatus('data loaded', 'ready');
    }
  } catch (err) {
    console.error(err);
    setStatus('manifest unavailable', 'error');
  }
}

/* ---------- init ---------- */

async function init() {
  buildPicker();
  buildForecastPicker();
  initSlider();
  initChartZoom();
  initTabs();
  document.getElementById('eventClose').addEventListener('click', dismissEventPanel);
  window.addEventListener('resize', positionEventPanel);
  loadManifestStatus();
  await loadEvents();

  for (const id of DEFAULT_ACTIVE) {
    const chip = document.querySelector(`.chip[data-id="${id}"]`);
    if (!chip) continue;
    try {
      await toggleIndicator(id, chip);
    } catch (err) {
      // one bad default shouldn't block the rest from loading
      console.error(`Failed to load default indicator ${id}:`, err);
    }
  }

  if (state.active.size === 0) {
    recomputeBounds();
    syncSliderBounds();
    renderChart();
    renderSnapshot();
  }
  renderEventPanel();

  // Pre-populate the Forecast tab's defaults from data already loaded above —
  // no extra fetches, since both tabs share the same cache. The chart itself
  // isn't built yet (canvas is still hidden); that happens on first tab view.
  for (const id of DEFAULT_ACTIVE) {
    if (!FORECASTABLE_IDS.has(id) || !state.cache.has(id)) continue;
    forecastState.active.add(id);
    const fChip = document.querySelector(`#forecastPickerGroups .chip[data-id="${id}"]`);
    if (fChip) fChip.classList.add('active');
  }
}

document.addEventListener('DOMContentLoaded', init);
