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
- **Bilingual (French / English)** — a language switcher in the top bar; French is the
  default. It translates every label, button, tooltip, and status message, and also
  switches the invoice document's own built-in wording (column headers, "Récapitulatif" /
  "Summary", "TOTAL HT" / "SUBTOTAL", date formatting, etc.) in both the live sheet and the
  generated PDF. Your choice is remembered in the browser for next time.
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
- **Import from PDF (best effort)** — pulls text out of an existing invoice PDF and tries
  to pre-fill the form: company/client info, invoice number and date, section titles and
  line items (description/qty/unit/price), tax lines, and footer notes (IBAN/SIRET/etc.).
  **Read this before relying on it:**
  - It only works on **text-based PDFs** — ones where you can select/copy the text in a
    normal PDF viewer. A **scanned or photographed invoice has no text layer at all**, and
    the tool will tell you plainly that no matching data was found rather than guess.
  - Even on text PDFs, it's a **heuristic, not a real table parser** — PDFs don't store
    "tables," just positioned text, so the importer reconstructs rows/columns by looking at
    coordinates and column gaps. It works well on cleanly laid-out invoices (including ones
    this tool itself generated) and gets shakier on unusual layouts, merged cells, or
    multi-line descriptions that wrap unpredictably.
  - **Always review the result before generating a PDF or saving.** Treat it as a
    time-saving first draft, not a guaranteed-accurate import — it will occasionally split
    a description wrong, miss a line item, or misread a number.
  - Importing replaces the current sections, taxes, and contact info — if you've already
    got unsaved work in progress, it'll ask for confirmation first.

## Deploying to GitHub Pages

1. Create a new GitHub repo (or use an existing one) and add these files to the repo
   root, keeping the folder structure: `index.html`, `style.css`, `app.js`, and the
   whole `assets/` folder (icon.svg, favicon-16.png, favicon-32.png, apple-touch-icon.png,
   icon-512.png, og-image.png — these cover the browser tab icon, phone bookmark icon,
   and link-preview image).
2. Push to GitHub.
3. In the repo, go to **Settings → Pages**, set **Source** to your default branch and
   root folder (`/`), and save.
4. GitHub will give you a URL like `https://yourusername.github.io/your-repo/` — that's
   your invoice tool. No build step, no server, no database.

`og:url` / `og:image` / `twitter:image` in `index.html` are currently hardcoded to
`https://ghalam.net/InvoiceMe/`. If you ever move the app to a different URL, update
those three tags to match — Slack, iMessage, Twitter/X, etc. read them straight from the
HTML (they don't run JavaScript, so this can't be done automatically) and need an
absolute URL.

### If the tab icon or link preview still isn't showing

1. **Confirm the asset files actually made it to the server.** Visit these two URLs
   directly in a browser tab:
   - `https://ghalam.net/InvoiceMe/assets/favicon-32.png`
   - `https://ghalam.net/InvoiceMe/assets/og-image.png`

   If either one 404s, the `assets/` folder wasn't deployed (or wasn't deployed to that
   exact path) — re-check that it was committed and pushed alongside `index.html`, in an
   `assets` subfolder right next to it.
2. **Chrome's favicon cache is separate from its normal page cache.** A hard refresh
   often isn't enough. Try closing every tab for the site, then reopening it fresh, or
   open it in an Incognito window to confirm the icon loads with no cache involved.
3. **iMessage/Slack/Twitter cache link previews per exact URL, very aggressively** —
   sometimes for days. If you already sent/pasted the link once before the image
   existed, the old (image-less) preview can stick around. Test with a slightly
   different URL to force a fresh fetch, e.g. `https://ghalam.net/InvoiceMe/?v=2`.
4. Each time you update files, bump the `?v=` numbers on the favicon `<link>` tags and
   the `style.css` / `app.js` `<script>` tags in `index.html` — browsers cache those
   aggressively by exact filename+query.

If the browser tab still doesn't show the icon after deploying, do a hard refresh
(Ctrl+Shift+R / Cmd+Shift+R) — favicons are cached aggressively by browsers, so a normal
reload sometimes keeps showing the old (missing) one from before the icon existed.

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
