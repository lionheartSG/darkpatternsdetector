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

- Set `DATABASE_URL` and `OPENAI_API_KEY` in project environment variables.
- For Playwright on serverless, the app uses `@sparticuz/chromium` + `playwright-core`.
- `next.config.ts` marks those packages as `serverExternalPackages` so Chromium binaries are not bundled incorrectly.
- The home page exports `maxDuration = 60` so the `submitScan` server action can finish page fetch + AI analysis (Vercel default is 10s without this).
- **Vercel Pro** (or higher) is required for function durations above 10 seconds on most plans.

After deploying, if a scan still fails, open the failed scan at `/scan/[id]` — the stored `errorMessage` and Vercel function logs show the underlying cause.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Generate Prisma client and build |
| `npm run lint` | Run Biome checks |
| `npx prisma studio` | Open database GUI |

## Disclaimer

Automated analysis only. Results are not legal, financial, or security advice.
