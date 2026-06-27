# DarkLens Implementation Plan

Audit date: 2026-06-27 (updated)

## Features already in codebase

| Area | Status | Location |
|------|--------|----------|
| Homepage disclaimer (P0) | Done | `src/lib/constants/disclaimers.ts`, `HeroUrlScanner.tsx` |
| Report disclaimer (P0) | Done | `ScanReport.tsx`, `disclaimers.ts` |
| Terms modal — 12 sections + screenshot notice (P0) | Done | `TermsOfUseDialog.tsx`, `constants/terms.ts` |
| Terms version + localStorage (P0) | Done | `TERMS_VERSION`, `terms-storage.ts` |
| Prohibited wording + sanitizer (P0) | Done | `constants/wording.ts`, `wording/sanitize.ts`, AI prompts |
| Safe summary templates (P0) | Done | `buildSafeSummary()` in `wording.ts` |
| Safe caution labels (P0/P2) | Done | `Badge.tsx`, `RiskGauge.tsx` — no “scam risk” labels |
| Private repo language (P0) | Done | `PRIVATE_REPOSITORY_NOTE`, terms section 5, landing copy |
| Rate limiting (P0) | Partial | `rate-limit.ts` — in-memory, 10/hr per IP |
| SSRF / private URL blocking (P0) | Done | `url-validation.ts` |
| No public shame pages (P0) | Partial | No leaderboard; `/scan/[id]` is public by link |
| URL submission + validation (P1) | Done | `HeroUrlScanner.tsx`, `validateScanUrl()` |
| Redirect + final URL capture (P1) | Done | `fetch-page.ts`, `ScanReport.tsx` |
| HTTPS technical signal (P1) | Partial | Submitted URL protocol only |
| Reputation check (P1) | Placeholder | “Unable to assess reputation…” in report |
| Auto screenshot capture (P1) | Done | `fetch-page.ts` viewport + full-page (full-page not stored) |
| Viewport screenshot storage (P1) | Done | `submitScan.ts`, Prisma `viewportScreenshot` |
| Heuristics MVP (P1) | Done | Urgency, scarcity, social proof, confirmshaming, preselection, popups |
| Report generation (P1) | Done | `ScanReport.tsx`, `DetectionCard.tsx` |
| Real scan flow (P1) | Done | Terms → `submitScan` → `/scan/[id]` |
| Loading copy (P1) | Done | `ScanProgressOverlay.tsx`, `SCAN_LOADING_*` |
| User education — next steps (P2) | Done | `NEXT_STEPS` in report |
| Landing page UI (P2) | Done | `LandingPageContent.tsx` + landing components |
| Sample report demo (P2) | Done | `SampleReportCard.tsx` (static) |

## Features missing or deferred

| Priority | Gap | Notes |
|----------|-----|-------|
| P0 | Website owner review route | Footer “Request review” link only; no form/API |
| P0 | Distributed rate limiting | In-memory only |
| P1 | Full-page screenshot storage | Captured but discarded |
| P1 | Screenshot crops per finding | Not implemented |
| P1 | PII redaction | Terms mention; no code |
| P1 | URL reputation API | Placeholder signal only |
| P1 | Prisma migration for screenshots | Schema has fields; verify migration applied |
| P2 | Private domain repository | No `DomainProfile` model |
| P2 | Trust subscores | Not implemented |
| P2 | Longitudinal / auto-rescan | Landing demo cards only |
| P2 | “What this means” education cards | Added in this pass to report |
| P2 | Suggested action per finding | Added in this pass to `DetectionCard` |
| — | Automated tests | No test runner in project |

## Files changed in this pass

- `docs/IMPLEMENTATION_PLAN.md` — this audit update
- `src/components/scan/ScanReport.tsx` — fix imports, add education section
- `src/components/scan/DetectionCard.tsx` — confidence labels, suggested actions
- `src/components/landing/LandingPageContent.tsx` — remove dead scan state, use `PRIVATE_REPOSITORY_NOTE`
- `src/components/landing/HeroUrlScanner.tsx` — homepage disclaimer copy only
- `src/components/landing/Footer.tsx` — request review mailto link
- `src/components/scan/UrlScanForm.tsx` — safe copy + terms flow alignment
- `src/components/layout/SiteHeader.tsx`, `SiteFooter.tsx` — safe legacy copy
- `src/lib/constants/wording.ts` — education cards, suggested actions, prohibited phrases

## Assumptions

1. Terms acceptance is client-side `localStorage` keyed by `TERMS_VERSION`.
2. Homepage scan navigates to `/scan/[id]`; landing sample report stays static.
3. `UrlScanForm` is preserved for reuse but not mounted on homepage.
4. P2 repository, longitudinal analysis, and reputation APIs remain future work.
5. “Request review” uses a mailto placeholder until a form exists.

## Scan flow (implemented)

1. User pastes URL → clicks “Scan webpage”
2. Client validates URL format
3. If terms not accepted for current version → `TermsOfUseDialog`
4. User ticks checkbox → “Accept and start scan”
5. `submitScan` runs (rate limit, fetch, heuristics, AI, auto screenshot)
6. `ScanProgressOverlay` shows evidence-capture loading copy
7. Navigate to `/scan/[id]` with disclaimers and cautious report
