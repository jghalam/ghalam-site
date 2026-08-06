# EasyCVE

A friendly search UI for CISA's [Known Exploited Vulnerabilities (KEV) catalog](https://www.cisa.gov/known-exploited-vulnerabilities-catalog), built as a static site for GitHub Pages.

## How it works

- **`data/kev.json`** is a mirror of CISA's KEV JSON feed, kept in your own repo.
- **`.github/workflows/update-kev.yml`** is a scheduled GitHub Action (daily at 06:00 UTC, plus manual "Run workflow") that re-downloads the CISA feed and commits it to `data/kev.json` if it changed. Because the site then fetches `data/kev.json` from its own origin, there's no cross-origin (CORS) issue — CISA's server doesn't need to allow browser fetches from your domain.
- **`index.html`** is the whole app: filters, table, CSV export, and shareable/auto-download links. No build step, no dependencies beyond Google Fonts.
- If `data/kev.json` is ever missing or fails to load, the page falls back to fetching directly from `cisa.gov` client-side. That fetch may be blocked by the browser depending on CISA's CORS headers — the repo mirror is the reliable path.

## Setup

1. Create a repo (e.g. `easycve`) and push these files to the default branch.
2. In **Settings → Pages**, set the source to deploy from that branch (root).
3. In **Settings → Actions → General → Workflow permissions**, select **"Read and write permissions"** so the scheduled Action can commit `data/kev.json`.
4. Run the **"Update KEV data"** workflow once manually (Actions tab → Update KEV data → Run workflow) so `data/kev.json` is populated instead of the empty placeholder.
5. Visit `https://<your-username>.github.io/easycve/`.

## Filters

| Filter | Matches against |
|---|---|
| CVE ID contains | `cveID` (substring, case-insensitive) |
| Description / name contains | `vulnerabilityName` + `shortDescription` |
| Vendor / product contains | `vendorProject` + `product` |
| Known ransomware use | exact match on `knownRansomwareCampaignUse` |
| Date added range | `dateAdded` |
| Due date range | `dueDate` |

## Shareable / auto-download URLs

Every filter has a matching query parameter, so anyone can copy a URL and land on the same filtered view — or trigger an instant CSV download with no clicks.

| Param | Meaning |
|---|---|
| `cve` | CVE ID substring |
| `q` | Description/name substring |
| `vendor` | Vendor/product substring |
| `ransomware` | `Known` or `Unknown` |
| `addedFrom`, `addedTo` | `YYYY-MM-DD` |
| `dueFrom`, `dueTo` | `YYYY-MM-DD` |
| `format=csv` **or** `download=1` | Skip the table and immediately download a CSV of the matching rows |

**Examples:**

View TeamCity-related CVEs added since Jan 1, 2026:
```
https://<you>.github.io/easycve/?q=TeamCity&addedFrom=2026-01-01
```

Auto-download a CSV of everything with known ransomware use added in the last week:
```
https://<you>.github.io/easycve/?ransomware=Known&addedFrom=2026-07-30&format=csv
```

## Notes / possible next steps

- The CSV includes `requiredAction`, which isn't shown in the table (kept the table lean) — open the file to see it.
- Rows whose due date has passed are highlighted red; due within 7 days is highlighted amber.
- Because everything runs client-side against a static JSON file, there's no server cost and no rate limits to worry about.
