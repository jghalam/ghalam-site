# Impasto — Pizza Dough Calculator

A single-page pizza dough calculator for Neapolitan, New York, Canotto, and Tonda Romana dough. Pure HTML/CSS/JS — no build step, no dependencies beyond two Google Fonts. Deploys straight to GitHub Pages.

## Files

- `index.html` — page structure
- `styles.css` — all styling (design tokens, ticket receipt visual, responsive layout)
- `script.js` — dough math and interactivity
- `favicon.ico`, `favicon-16.png`, `favicon-32.png`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` — favicon set generated from a photo of an oil painting, cropped square
- `impasto-swatch.png` — the same crop, used next to the wordmark in the page header

The favicon/swatch source is a close-up of an oil painting with heavy palette-knife texture — a nod to "impasto," the painting term for thickly applied paint, which doubles nicely as the name of a dough calculator.

## How the math works

Everything is calculated as a **baker's percentage**, where flour is always 100% and every other ingredient is a percentage of the flour weight:

```
total dough weight = dough ball size (g) × number of balls
total % = 100 (flour) + hydration % + salt % + yeast % + [oil % + sugar %, NY only]
flour weight        = total dough weight ÷ (total % / 100)
water weight         = flour weight × hydration %
salt weight          = flour weight × salt %
yeast weight         = flour weight × yeast %
oil / sugar weight    = flour weight × their % (New York / Tonda Romana only)
```

### Yeast scales with resting time, not with pizza style

Yeast quantity is set by a "resting time" dial (3–24+ hours) rather than being fixed per style, since how long the dough will ferment matters more than which pizza it becomes. It's the same curve for all four styles:

| Resting time | Instant dry | Fresh |
|---|---|---|
| 3 hours | 1.5% | 2.5% |
| 24+ hours | 0.06% | 0.15% |

Values in between are interpolated on an exponential curve (linear in log-yeast% vs. hours), not a straight line — fermentation speed compounds over time, so yeast needed roughly halves every few hours of added rest rather than dropping at a constant rate. The curve is defined in `script.js` as `YEAST_REST`, fit exactly through those two reference points, so if you have a different pair of reference values, updating those four numbers reshapes the whole curve.

### Defaults baked in

| | Neapolitan | New York | Canotto | Tonda Romana |
|---|---|---|---|---|
| Ball size | 240 g | 270 g | 250 g | 175 g |
| Balls | 4 | 4 | 4 | 4 |
| Hydration | 65% | 66% | 70% | 60% |
| Salt | 2.5% | 2% | 3% | 2.5% |
| Olive oil | — | 3% | — | 6% |
| Sugar | — | 1% | — | — |

Yeast isn't in this table since it's now driven by the resting-time dial (see above) rather than being fixed per style — it defaults to a 24+ hour rest (0.06% instant / 0.15% fresh) regardless of which pizza style is selected.

Switching styles resets ball size, ball count, and hydration to that style's defaults, and shows a short explanation of what defines the style. Salt/oil/sugar percentages are fixed per style (they're what define the style), while ball size, ball count, hydration, yeast type, and resting time stay adjustable.

## Deploying to GitHub Pages

1. Create a new repository on GitHub (or use an existing one).
2. Add these three files (`index.html`, `styles.css`, `script.js`) to the repo root — or push this whole folder.
3. In the repo, go to **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to "Deploy from a branch".
5. Choose your default branch (usually `main`) and `/ (root)` as the folder, then **Save**.
6. GitHub will give you a URL like `https://<your-username>.github.io/<repo-name>/` within a minute or two.

Once you have that live URL, update the `og:image` line in `index.html` to the full absolute path (e.g. `https://<your-username>.github.io/<repo-name>/icon-512.png`) — social platforms like iMessage and Slack need an absolute URL to render a link preview image, a relative path won't resolve.

No build process, no npm install, no server — it's just static files.

## Versioning (and avoiding stale-cache deploys)

`styles.css` and `script.js` are linked with a `?v=1.0.0` query string, and the same number is shown in plain text at the bottom of the page. GitHub Pages' CDN (and browsers) can cache `.css`/`.js` files for a while, so if you push a change and it doesn't show up right away, it's almost always this — the CDN is still serving the old file under the old URL.

**On every deploy where you change `styles.css` or `script.js`, bump the version number in three spots in `index.html`:**

1. `<link rel="stylesheet" href="styles.css?v=1.0.0">`
2. `<script src="script.js?v=1.0.0"></script>`
3. `<p class="version-tag">v1.0.0</p>` in the footer

Bumping the query string changes the URL, so the CDN/browser treats it as a brand new file instead of reusing a cached one — no waiting for cache expiry. The visible footer tag doubles as a quick sanity check: load the live site, glance at the bottom, and confirm it matches the version you just pushed before assuming a fix didn't take.

Any bump works (`1.0.1` for a small fix, `1.1.0` for a new feature, or just an incrementing integer) — the number itself has no functional meaning, it just needs to change.

## Local preview

Just open `index.html` directly in a browser, or serve the folder locally:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000`.

## Customizing

- **Colors / fonts**: all defined as CSS custom properties at the top of `styles.css` (`:root` and the `body[data-style="newyork"]` override).
- **Recipe percentages**: all defined in one place — the `RECIPES` object at the top of `script.js` (with matching display names in `STYLE_NAMES` and explanations in `STYLE_BLURBS`). Add a fifth style by adding entries to all three and a matching button in `index.html`.
