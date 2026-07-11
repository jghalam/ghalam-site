(function(){
  "use strict";

  // ---------- Recipe definitions (baker's percentages, relative to flour = 100%) ----------
  const RECIPES = {
    neapolitan: {
      label: "Neapolitan Dough",
      defaults: { ballWeight: 240, ballCount: 4, hydration: 65 },
      salt: 2.5,
      yeast: { instant: 0.06, fresh: 0.15 },
      extras: [] // no oil/sugar
    },
    newyork: {
      label: "New York Dough",
      defaults: { ballWeight: 270, ballCount: 4, hydration: 66 },
      salt: 2,
      yeast: { instant: 0.06, fresh: 0.15 },
      extras: [
        { key: "oil", name: "Olive oil", pct: 3 },
        { key: "sugar", name: "Sugar", pct: 1 }
      ]
    },
    canotto: {
      label: "Canotto Dough",
      defaults: { ballWeight: 250, ballCount: 4, hydration: 70 },
      salt: 3,
      yeast: { instant: 0.06, fresh: 0.15 },
      extras: []
    },
    tonda: {
      label: "Tonda Romana Dough",
      defaults: { ballWeight: 175, ballCount: 4, hydration: 60 },
      salt: 2.5,
      yeast: { instant: 0.06, fresh: 0.15 },
      extras: [
        { key: "oil", name: "Olive oil", pct: 6 }
      ]
    }
  };

  const STYLE_NAMES = {
    neapolitan: "Neapolitan",
    newyork: "New York",
    canotto: "Canotto",
    tonda: "Tonda Romana"
  };

  const STYLE_BLURBS = {
    neapolitan: "Naples' original: a soft, thin center with a tall, airy, leopard-spotted cornicione, cooked scorching hot and fast in a wood-fired oven.",
    newyork: "Foldable slice pizza, baked at a lower heat for longer. A touch of oil and sugar add browning and chew that hold up to a reheat the next day.",
    canotto: "Neapolitan's puffier cousin — very high hydration blows the rim up into a thick, cloud-like \u2018dinghy\u2019 (canotto) around a thin, delicate center.",
    tonda: "Rome's round pizza: lower hydration plus olive oil roll out into a thin, cracker-crisp base — almost the opposite instinct from Naples' pillowy crust."
  };

  // ---------- State ----------
  let state = {
    style: "neapolitan",
    ballWeight: 240,
    ballCount: 4,
    hydration: 65,
    yeastType: "instant"
  };

  // ---------- DOM refs ----------
  const el = {
    body: document.body,
    styleButtons: document.querySelectorAll("[data-style-btn]"),
    ballWeight: document.getElementById("ballWeight"),
    ballWeightVal: document.getElementById("ballWeightVal"),
    ballCount: document.getElementById("ballCount"),
    stepButtons: document.querySelectorAll("[data-step]"),
    hydration: document.getElementById("hydration"),
    hydrationVal: document.getElementById("hydrationVal"),
    yeastButtons: document.querySelectorAll("[data-yeast]"),
    resetBtn: document.getElementById("resetBtn"),
    resetStyleName: document.getElementById("resetStyleName"),
    styleBlurb: document.getElementById("styleBlurb"),
    ticketStyleName: document.getElementById("ticketStyleName"),
    ticketBallSummary: document.getElementById("ticketBallSummary"),
    ticketTotal: document.getElementById("ticketTotal"),
    ticketItems: document.getElementById("ticketItems"),
    ticketGrandTotal: document.getElementById("ticketGrandTotal"),
    ticketFoot: document.getElementById("ticketFoot"),
    edgeTop: document.getElementById("edgeTop"),
    edgeBottom: document.getElementById("edgeBottom")
  };

  // ---------- Torn / serrated ticket edges ----------
  function buildZigzagClipPath(teeth, amplitudePx, pointingDown){
    // builds a polygon() string across 0-100% width with `teeth` triangular notches
    const points = [];
    const step = 100 / teeth;
    for(let i = 0; i <= teeth; i++){
      const x = (i * step).toFixed(3) + "%";
      const yPeak = pointingDown ? amplitudePx + "px" : "0px";
      const yValley = pointingDown ? "0px" : amplitudePx + "px";
      points.push(`${x} ${i % 2 === 0 ? yPeak : yValley}`);
    }
    // build a closed shape: top row of points, then a flat bottom (or top) to close the rect
    const top = points.join(", ");
    if(pointingDown){
      return `polygon(${top}, 100% 100%, 0% 100%)`;
    } else {
      return `polygon(0% 0%, 100% 0%, ${top})`;
    }
  }

  function applyTornEdges(){
    el.edgeTop.style.clipPath = buildZigzagClipPath(22, 7, false);
    el.edgeBottom.style.clipPath = buildZigzagClipPath(22, 7, true);
  }

  // ---------- Helpers ----------
  function fmt(n, decimals){
    return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  function fmtPct(n){
    // up to 2 decimals, trims trailing zeros (2.50 -> 2.5, 100.00 -> 100)
    return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function pulse(elem){
    elem.classList.remove("pulse");
    // force reflow to restart animation
    void elem.offsetWidth;
    elem.classList.add("pulse");
  }

  function orderNumber(){
    // stable-ish per-session order number just for ticket flavor
    if(!window.__impastoOrder){
      window.__impastoOrder = 100 + Math.floor(Math.random() * 800);
    }
    return window.__impastoOrder;
  }

  // ---------- Core calculation ----------
  function calculate(){
    const recipe = RECIPES[state.style];
    const totalDoughWeight = state.ballWeight * state.ballCount;

    const saltPct = recipe.salt;
    const yeastPct = recipe.yeast[state.yeastType];
    const extrasPct = recipe.extras.reduce((sum, ex) => sum + ex.pct, 0);

    const totalPct = 100 + state.hydration + saltPct + yeastPct + extrasPct;
    const flourWeight = totalDoughWeight / (totalPct / 100);
    const waterWeight = flourWeight * (state.hydration / 100);
    const saltWeight = flourWeight * (saltPct / 100);
    const yeastWeight = flourWeight * (yeastPct / 100);

    const extras = recipe.extras.map(ex => ({
      name: ex.name,
      pct: ex.pct,
      weight: flourWeight * (ex.pct / 100)
    }));

    const items = [
      { name: "Flour", pct: 100, weight: flourWeight, decimals: 0 },
      { name: "Water", pct: state.hydration, weight: waterWeight, decimals: 0 },
      { name: "Salt", pct: saltPct, weight: saltWeight, decimals: 1 },
      ...extras.map(ex => ({ name: ex.name, pct: ex.pct, weight: ex.weight, decimals: ex.name === "Sugar" ? 1 : 1 })),
      { name: `Yeast (${state.yeastType === "instant" ? "instant dry" : "fresh"})`, pct: yeastPct, weight: yeastWeight, decimals: 2 }
    ];

    const grandTotal = items.reduce((sum, i) => sum + i.weight, 0);

    return { totalDoughWeight, items, grandTotal, label: recipe.label };
  }

  // ---------- Render ----------
  function render(){
    const result = calculate();

    el.ticketStyleName.textContent = result.label;
    el.ticketBallSummary.textContent = `${state.ballCount} ball${state.ballCount === 1 ? "" : "s"} × ${state.ballWeight} g`;
    el.ticketTotal.textContent = `${fmt(result.totalDoughWeight, 0)} g`;

    el.ticketItems.innerHTML = "";
    result.items.forEach(item => {
      const li = document.createElement("li");
      li.className = "ticket-item";
      li.innerHTML = `
        <div class="ticket-item-row">
          <span class="ticket-item-name">${item.name}</span>
          <span class="ticket-item-weight">${fmt(item.weight, item.decimals)} g</span>
        </div>
        <span class="ticket-item-pct">${fmtPct(item.pct)}% of flour</span>
      `;
      el.ticketItems.appendChild(li);
    });

    el.ticketGrandTotal.textContent = `${fmt(result.grandTotal, 0)} g`;
    el.ticketFoot.textContent = `baked fresh — order #${orderNumber()}`;

    pulse(el.ticketTotal);
    pulse(el.ticketGrandTotal);
  }

  // ---------- Style switching ----------
  function setStyle(styleKey){
    state.style = styleKey;
    const defaults = RECIPES[styleKey].defaults;
    state.ballWeight = defaults.ballWeight;
    state.ballCount = defaults.ballCount;
    state.hydration = defaults.hydration;

    el.body.setAttribute("data-style", styleKey);
    el.ballWeight.value = state.ballWeight;
    el.ballWeightVal.textContent = `${state.ballWeight} g`;
    el.ballCount.value = state.ballCount;
    el.hydration.value = state.hydration;
    el.hydrationVal.textContent = `${state.hydration}%`;

    el.styleButtons.forEach(btn => {
      const isActive = btn.dataset.styleBtn === styleKey;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    el.resetStyleName.textContent = STYLE_NAMES[styleKey];
    el.styleBlurb.textContent = STYLE_BLURBS[styleKey];

    render();
  }

  function resetDefaults(){
    setStyle(state.style);
  }

  // ---------- Event wiring ----------
  el.styleButtons.forEach(btn => {
    btn.addEventListener("click", () => setStyle(btn.dataset.styleBtn));
  });

  el.ballWeight.addEventListener("input", () => {
    state.ballWeight = Number(el.ballWeight.value);
    el.ballWeightVal.textContent = `${state.ballWeight} g`;
    render();
  });

  el.ballCount.addEventListener("input", () => {
    let v = Math.max(1, Math.min(24, Number(el.ballCount.value) || 1));
    state.ballCount = v;
    render();
  });

  el.stepButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const delta = Number(btn.dataset.step);
      let v = Math.max(1, Math.min(24, state.ballCount + delta));
      state.ballCount = v;
      el.ballCount.value = v;
      render();
    });
  });

  el.hydration.addEventListener("input", () => {
    state.hydration = Number(el.hydration.value);
    el.hydrationVal.textContent = `${state.hydration}%`;
    render();
  });

  el.yeastButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      state.yeastType = btn.dataset.yeast;
      el.yeastButtons.forEach(b => {
        const active = b === btn;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-checked", active ? "true" : "false");
      });
      render();
    });
  });

  el.resetBtn.addEventListener("click", resetDefaults);

  // ---------- Init ----------
  applyTornEdges();
  setStyle("neapolitan");
})();
