# InvoiceMe — Construction Invoice Builder

A static, no-backend web app for building construction invoices (devis) as branded PDFs.
Everything runs in the browser — nothing is uploaded anywhere, so it's safe to host as a
plain GitHub Pages site.

## What it does

- **Letterhead** — drop in a logo/title image, used at the top of the PDF.
- **Company & client info** — free-text fields for address/contact, matching the layout of
  a typical French *devis*.
- **Custom sections** — add as many sections as you want (Démolition, Plomberie, Électricité…),
  each with a title, optional description, and unlimited line items (description, quantity,
  unit, unit price → line total is calculated automatically).
- **Summary** — auto-totals every section, plus any number of customizable tax lines
  (e.g. "TVA 10%"), down to a final TOTAL TTC.
- **Configurable currency & number format** — set the currency symbol/code and whether it
  goes before or after the amount, pick a separator preset (`1 234,56`, `1,234.56`,
  `1.234,56`, `1'234.56`, `1234.56`) or define a fully custom thousands/decimal separator
  and decimal-place count. Applies everywhere — line items, section totals, and the summary.
- **Attached terms PDF** — optionally attach an existing PDF (T&Cs, legal boilerplate,
  signature page). Its pages are appended after the generated invoice pages in the final PDF.
- **Two outputs, one click each:**
  1. **Generate PDF** — the finished invoice (+ appended terms pages if provided).
  2. **Save Data** — a `.json` file with everything you entered (including the logo and the
     attached terms PDF, base64-encoded inside the file). Use **Load Data** later to reopen
     it and make edits, instead of starting from scratch.

## Deploying to GitHub Pages

1. Create a new GitHub repo (or use an existing one) and add these files to the repo
   root, keeping the folder structure: `index.html`, `style.css`, `app.js`, and the
   `assets/icon.svg` file (used as the browser tab icon).
2. Push to GitHub.
3. In the repo, go to **Settings → Pages**, set **Source** to your default branch and
   root folder (`/`), and save.
4. GitHub will give you a URL like `https://yourusername.github.io/your-repo/` — that's
   your invoice tool. No build step, no server, no database.

You can also just open `index.html` directly in a browser (double-click it) — it works
fully offline except for the three CDN script tags (jsPDF, jsPDF-AutoTable, pdf-lib) and
the Google Fonts stylesheet, which need an internet connection the first time they load.

## Day-to-day use

1. Fill in the **Letterhead**, **Company**, **Bill To**, and **Invoice details** panels
   on the left.
2. Click **+ Add Section** on the canvas, give it a title (e.g. "Plomberie"), and add
   line items. Add as many sections and line items as the job needs.
3. Set your tax line(s) under **Taxes** (defaults to a single "TVA 10%" line — add more,
   rename, or delete as needed).
4. Optionally attach a terms/signature PDF under **Attached terms PDF**.
5. Click **Generate PDF** to download the finished invoice.
6. Click **Save Data** to download a `.json` file so you (or a colleague) can reopen this
   exact invoice later via **Load Data** and tweak it rather than rebuilding it.

A sample data file, `sample-data.json`, is included — use **Load Data** to see a filled-out
example (based on a real multi-section devis) and get a feel for the structure before you
build your own.

## Notes / limitations

- This is a client-side tool: there's no server, login, or storage — every invoice lives
  in the `.json` file you save. Keep those files somewhere sensible (a folder, Drive, etc.).
- PDF generation uses [jsPDF](https://github.com/parallax/jsPDF) +
  [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) for layout, and
  [pdf-lib](https://pdf-lib.js.org/) to append the terms PDF's pages onto the generated
  invoice.
- Very large logo images or terms PDFs will make the `.json` data file large (everything
  is embedded as base64) — that's expected and fine for typical logo/PDF sizes.
