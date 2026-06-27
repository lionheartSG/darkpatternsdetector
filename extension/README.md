# Dark Patterns Detector — Chrome Extension

Browser extension that auto-analyzes pages for potential pressure tactics and design cues, syncing every scan to the Next.js backend.

## Prerequisites

- Node.js 20+
- Web app running locally or deployed (see root [README](../README.md))
- `EXTENSION_API_KEY` set on the server (optional in local dev when `NODE_ENV !== production`)

## Setup

1. Install dependencies from the repo root:

```bash
npm install
```

2. Configure the extension in **Options** (right-click extension icon → Options) or after loading unpacked:

| Setting | Example |
|---------|---------|
| API base URL | `http://localhost:3000` or your Vercel URL |
| Extension API key | Same as server `EXTENSION_API_KEY` |
| Accept terms | Required before auto-scan runs |

3. Run the extension in dev mode:

```bash
npm run dev:extension
```

4. Load unpacked in Chrome:

- Open `chrome://extensions`
- Enable **Developer mode**
- **Load unpacked** → select `extension/.output/chrome-mv3-dev`

## Usage

1. Accept terms in extension options.
2. Browse any public `http(s)` page — analysis runs automatically after page load.
3. Click the extension icon to open the **side panel** report.
4. Use **Rescan page** to bypass the 5-minute dedupe window.

## Build for Chrome Web Store

```bash
npm run build:extension
```

Output zip: `extension/.output/` (use `npm run zip -w @darkpatterns/extension` for store upload).

## Architecture

- **Content script** — extracts visible text and interactive DOM snippets, hooks SPA navigation.
- **Background** — debounces scans, calls `POST /api/extension/analyze`, updates badge.
- **Side panel** — shows PRD-safe concern labels, findings, and decision checklist.
- **Shared package** — `@darkpatterns/shared` heuristics and wording used by web + extension.

See root [PRD.md](../PRD.md) §8 for API contract and monorepo layout.

## Privacy

- Auto-scan runs only after explicit terms acceptance.
- Page text is sent to your configured backend for analysis and storage.
- No public rankings or hall of shame.
