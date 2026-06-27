# Dark Patterns Detector

Detect dark patterns and deceptive UX on websites — fake urgency, misleading scarcity, hidden fees, and more.

## Stack

- **Next.js 16** (App Router, Server Actions)
- **Prisma** + **Prisma Postgres** (PostgreSQL)
- **Vercel AI SDK** for structured AI analysis
- **Playwright** for JavaScript-rendered page fetching

## Setup

### 1. Install dependencies

```bash
npm install
npx playwright install chromium
```

### 2. Provision a database

Create a free temporary Prisma Postgres database (no account required):

```bash
npx create-db@latest
```

Copy the connection string into `.env`:

```env
DATABASE_URL="postgres://...@db.prisma.io:5432/postgres?sslmode=require"
OPENAI_API_KEY="sk-..."
# Optional:
# AI_MODEL=gpt-4o
```

**Note:** Unclaimed databases expire after 24 hours. Use the claim URL from the CLI output to keep it permanently on a free Prisma account.

### 3. Run migrations

```bash
npx prisma migrate dev
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How it works

1. User submits a URL on the home page.
2. `submitScan` server action validates the URL (including SSRF checks), fetches the page with Playwright, runs heuristic pre-scan, then AI analysis via Vercel AI SDK.
3. Results are stored in Prisma Postgres and displayed at `/scan/[id]`.

Without `OPENAI_API_KEY`, the app falls back to heuristic-only analysis.

## Deployment (Vercel)

Per [Vercel's Puppeteer guide](https://vercel.com/kb/guide/deploying-puppeteer-with-nextjs-on-vercel), serverless browser automation must use a **small browser driver + remote Chromium pack**, not the full Playwright/Puppeteer bundle.

This project uses:

- **`playwright-core`** — lightweight driver (no bundled browser)
- **`@sparticuz/chromium-min`** — minimal package; downloads Chromium from a remote tarball at runtime
- **`vercel.json`** — `maxDuration: 60`, `memory: 2048` on scan routes (Hobby plan max)
- **`next.config.ts`** — `serverExternalPackages` so binaries are not bundled incorrectly
- **`src/app/page.tsx`** — `runtime = "nodejs"`, `maxDuration = 60`

### Required Vercel environment variables

| Variable | Required |
|----------|----------|
| `DATABASE_URL` | Yes |
| `OPENAI_API_KEY` | Recommended |
| `CHROMIUM_REMOTE_EXEC_PATH` | Optional (defaults to Sparticuz v131.0.1 pack on GitHub) |

### Limits to expect

- First scan on a cold function downloads ~50MB Chromium — can take 10–20s extra
- Scans need up to ~60s total (`maxDuration`)
- **Hobby plan:** max **2048 MB** memory per function. **Pro plan:** up to 3008 MB if scans need more headroom for Chromium
- If GitHub download fails or times out, host the `.tar` pack on **Vercel Blob** and set `CHROMIUM_REMOTE_EXEC_PATH` to that URL

### Local development

Uses full **`playwright`** + `npx playwright install chromium` (not the remote pack).

After deploying, check Vercel function logs for `[submitScan] failed:` if scans still fail.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Generate Prisma client and build |
| `npm run lint` | Run Biome checks |
| `npx prisma studio` | Open database GUI |

## Disclaimer

Automated analysis only. Results are not legal, financial, or security advice.
