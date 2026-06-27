# Product Requirements Document — Dark Patterns Detector

**Product:** Dark Patterns Detector (`darkpatternsdetector`)  
**Last updated:** 27/06/2026 (SGT)  
**Status:** Active — baseline in development

---

## 1. Product vision

Help users identify **potential pressure tactics and deceptive design cues** on public webpages. The tool describes **observable design signals** only. It does **not** determine whether a website is unlawful, fraudulent, or unsafe.

### Positioning

| Use | Avoid |
|-----|-------|
| “Check whether a webpage uses pressure tactics or potentially deceptive design cues.” | “Find out if this site is a scam.” |
| “Potential urgency cue detected.” | “This website is a scam.” |
| “Some caution” / “Moderate caution” | “Fraud” / “Predatory business” |

---

## 2. User flow

### 2.1 Homepage

1. User lands on homepage.
2. **Headline / framing:** “Check whether a webpage uses pressure tactics or potentially deceptive design cues.”
3. **Input label:** “Paste a public webpage URL.”
4. **Helper text:** “Best for shopping, booking, subscription, donation, and checkout pages.”
5. **Disclaimer (P0):** “This tool identifies potential pressure tactics and design cues. It does not determine whether a website is unlawful, fraudulent, or unsafe.”

### 2.2 URL submission

1. User pastes a URL and submits.
2. System runs a **safety pre-check** before scanning.

### 2.3 Safety pre-check

Validate and block unsafe targets:

- URL must be public (no localhost, private IPs, internal networks, `file:` URLs).
- Block suspicious redirects.
- Check HTTPS presence.
- Check basic URL reputation signals (when source available).
- Rate-limit scans per IP/session.

**User-facing wording:** “We are checking technical and design signals. We do not make legal findings.”

**Neutral technical signals (P1):**

- “HTTPS present”
- “Redirect detected”
- “Unable to assess reputation”
- “Known unsafe URL signal found” — only when supported by a reputable source

### 2.4 Page scan

1. Load page in a controlled browser session (Playwright).
2. Capture screenshot **privately** (full-page + viewport).
3. Extract visible text.
4. Inspect page structure (DOM snippets where relevant).
5. Detect popups, countdowns, price claims, checkout options, stock claims, subscription language.

**User-facing wording:** “Evidence snapshot captured for analysis.”

**Restrictions (P0):**

- Public pages only — no login bypass, CAPTCHA bypass, or paywall bypass.
- Hosts that block automated browsers (e.g. SiteGround `sgcaptcha`, Cloudflare) may prevent a full fetch. The scanner waits up to ~35s for automatic proof-of-work interstitials to finish; if access is still blocked, the report shows an obstruction notice and the user can upload a screenshot from their own browser instead.

### 2.5 Design cue detection

| Category | Examples |
|----------|----------|
| **Urgency** | Countdown timers, “sale ending soon”, “offer expires today” |
| **Scarcity** | “Only X left”, “selling fast”, “limited stock” |
| **Social proof** | “X people viewing now”, recent purchase popups |
| **Consent / preselection** | Pre-ticked boxes, add-ons selected by default |
| **Pricing** | Hidden fees, late-stage charges, unclear discounts |
| **Subscription** | Auto-renewal, cancellation friction, free-trial conversion |

Rule-based detection runs first; LLM analysis (P3) runs only after rules and must cite evidence.

### 2.6 Report generation

Use **cautious result labels:**

| Allowed | Prohibited |
|---------|------------|
| Low concern | Scam |
| Some caution | Fraud |
| Moderate caution | Illegal |
| High caution | Predatory business |
| Unable to assess | Deceptive company |

**Report disclaimer (P0):** “Findings are based on automated analysis and may be incomplete or incorrect.”

**Summary template:**

- “We found N potential pressure cues.”
- “These cues are not proof of wrongdoing.”
- “Use the evidence below to make your own decision.”

### 2.7 Findings presentation

Each finding includes:

| Field | Example |
|-------|---------|
| Pattern name | “Potential urgency cue” |
| Evidence | Screenshot crop (private) |
| Explanation | “This may encourage faster decision-making.” |
| Qualifier | “This does not mean the offer is false.” |
| Confidence | Low / Medium / High / Needs repeated scan |
| Suggested action | “Consider revisiting the page later to check whether the offer changes.” |

**Safe wording templates (P0):**

- “Potential urgency cue”
- “Possible scarcity cue”
- “May encourage faster decision-making”
- “Unable to verify claim”
- “Consider checking independently”

**Prohibited wording in generated conclusions (P0):** scam, fraud, criminal, illegal, cheating, dishonest seller.

### 2.8 Trust signal summary

**Use:**

- “This page contains several design cues that may pressure users into acting quickly.”
- “Review the evidence before deciding.”

**Avoid:**

- “Do not buy from this website.”
- “This website is dishonest.”
- “This seller is manipulating users.”

### 2.9 Decision checklist

Present after findings:

- Check refund terms.
- Compare prices elsewhere.
- Look for independent reviews.
- Avoid rushing because of timers.
- Check whether fees appear only at checkout.
- Save a copy of important terms before paying.

### 2.10 Private evidence storage

Store internally (never public by default):

| Data | Notes |
|------|-------|
| Domain | Grouping key for longitudinal analysis |
| URL | Original + final resolved URL |
| Timestamp | SGT display: DD/MM/YYYY |
| Screenshot crop | Per finding; full-page retained for limited time |
| Extracted claims | Sale/stock/visitor text |
| Detected cues | Rule + AI outputs |
| Confidence score | Per finding and aggregate |
| Scan metadata | HTTPS, redirects, reputation, model version |

**User-facing wording:** “Private evidence snapshot saved to improve future consistency checks.”

**Privacy redaction (P0):** Blur emails, phone numbers, addresses, names, payment fields, account IDs, cart details before storage.

### 2.11 Longitudinal comparison

When the same domain is scanned again:

- Compare countdown behaviour.
- Compare sale labels, stock claims, visitor counts, checkout fees.

**Safe wording:**

- “Across repeated scans, similar urgency wording was observed.”
- “The tool cannot verify whether the underlying claim is true.”

### 2.12 Website owner review

Public page or email contact:

- “Request a correction or review.”
- “Report outdated or inaccurate findings.”

Reduces legal risk and demonstrates good faith. Admin can delete or amend records.

---

## 3. Entity relationship diagram (ERD)

The ERD below covers **current implementation** (solid) and **planned entities** (dashed in notes). Current Prisma models: `Scan`, `Detection`.

```mermaid
erDiagram
    Domain ||--o{ Scan : "has many"
    Scan ||--o{ Detection : "has many"
    Scan ||--o| ScanMetadata : "has one"
    Scan ||--o{ EvidenceSnapshot : "has many"
    Scan ||--o{ ExtractedClaim : "has many"
    Scan ||--o{ RescanSchedule : "may schedule"
    Detection ||--o| EvidenceCrop : "may link"
    EvidenceSnapshot ||--o{ EvidenceCrop : "contains"
    Domain ||--o| DomainProfile : "has one"
    DomainProfile ||--o{ DomainSubscore : "has many"
    Domain ||--o{ LongitudinalComparison : "compared on"
    Scan ||--o{ LongitudinalComparison : "baseline or follow-up"
    ReviewRequest }o--|| Scan : "references"
    ReviewRequest }o--o| Domain : "may reference"
    UserReport }o--|| Scan : "references"
    AdminNote }o--|| Scan : "attached to"
    AdminNote }o--o| ReviewRequest : "may reference"
    AuditLog }o--o| Scan : "may reference"
    AuditLog }o--o| EvidenceSnapshot : "may reference"

    Domain {
        string id PK
        string hostname UK
        datetime firstSeenAt
        datetime lastSeenAt
        int scanCount
    }

    Scan {
        string id PK
        string domainId FK
        string url
        string normalizedUrl
        string finalUrl
        enum status "PENDING|PROCESSING|COMPLETED|FAILED"
        enum concernLevel "LOW|SOME|MODERATE|HIGH|UNABLE"
        int riskScore "internal only"
        string summary
        string pageTitle
        string errorMessage
        datetime createdAt
        datetime completedAt
        string modelVersion
        string rulesVersion
    }

    ScanMetadata {
        string id PK
        string scanId FK UK
        boolean httpsPresent
        boolean redirectDetected
        string redirectChain "JSON"
        enum reputationSignal "UNKNOWN|CLEAN|FLAGGED"
        string reputationSource
        int preCheckDurationMs
    }

    Detection {
        string id PK
        string scanId FK
        enum category "URGENCY|SCARCITY|SOCIAL_PROOF|..."
        string patternType
        enum severity "LOW|MEDIUM|HIGH"
        enum confidenceLevel "LOW|MEDIUM|HIGH|NEEDS_RESCAN"
        string description
        string evidence "text excerpt"
        string suggestedAction
        float confidence
        string evidenceCropId FK
    }

    EvidenceSnapshot {
        string id PK
        string scanId FK
        enum type "FULL_PAGE|VIEWPORT"
        string storagePath "private blob"
        datetime capturedAt
        datetime expiresAt
        boolean redacted
    }

    EvidenceCrop {
        string id PK
        string snapshotId FK
        string storagePath "private blob"
        int boundingBoxX
        int boundingBoxY
        int boundingBoxW
        int boundingBoxH
        datetime capturedAt
    }

    ExtractedClaim {
        string id PK
        string scanId FK
        enum claimType "COUNTDOWN|SALE_LABEL|STOCK|VISITOR_COUNT|FEE|SUBSCRIPTION"
        string rawText
        string normalizedText
        string domSelector
        datetime extractedAt
    }

    DomainProfile {
        string id PK
        string domainId FK UK
        enum overallLabel "NO_MAJOR|SOME|MODERATE|HIGH|INSUFFICIENT"
        datetime updatedAt
        int totalScans
    }

    DomainSubscore {
        string id PK
        string domainProfileId FK
        enum dimension "TECHNICAL_SAFETY|TRANSPARENCY|PRESSURE_CUES|CONSISTENCY|CHECKOUT_FAIRNESS"
        int score "0-100 internal"
        string rationale
    }

    LongitudinalComparison {
        string id PK
        string domainId FK
        string baselineScanId FK
        string followUpScanId FK
        enum comparisonType "COUNTDOWN|SALE_LABEL|STOCK|VISITOR|CHECKOUT_FEE"
        string observation "safe wording"
        boolean claimChanged
        datetime comparedAt
    }

    RescanSchedule {
        string id PK
        string scanId FK
        datetime scheduledFor
        enum interval "ONE_HOUR|TWENTY_FOUR_HOURS|SEVEN_DAYS"
        enum status "PENDING|COMPLETED|CANCELLED"
        string resultingScanId FK
    }

    ReviewRequest {
        string id PK
        string scanId FK
        string domainId FK
        string requesterEmail
        string requesterRole "OWNER|AGENT|OTHER"
        enum status "OPEN|IN_REVIEW|RESOLVED|REJECTED"
        string message
        datetime createdAt
        datetime resolvedAt
    }

    UserReport {
        string id PK
        string scanId FK
        string reporterNote
        enum reason "FALSE_POSITIVE|OUTDATED|OTHER"
        enum status "OPEN|REVIEWED|DISMISSED"
        datetime createdAt
    }

    AdminNote {
        string id PK
        string scanId FK
        string reviewRequestId FK
        string adminUserId
        string note
        enum action "CORRECTED|DELETED_SCREENSHOT|MARKED_QUALITY|NO_ACTION"
        datetime createdAt
    }

    AuditLog {
        string id PK
        string actorId
        enum action "VIEW_SCAN|VIEW_SCREENSHOT|DELETE|AMEND|EXPORT"
        string scanId FK
        string snapshotId FK
        datetime occurredAt
        string ipHash
    }
```

### 3.1 ERD — entity summaries

| Entity | Purpose | Priority |
|--------|---------|----------|
| **Domain** | Canonical hostname; groups scans for profiles and comparisons | P2 |
| **Scan** | Single URL scan job and report (exists today) | P1 — partial |
| **ScanMetadata** | Pre-check outputs: HTTPS, redirects, reputation | P1 |
| **Detection** | Individual design cue finding (exists today) | P1 — partial |
| **EvidenceSnapshot** | Private full-page / viewport captures with retention | P1 |
| **EvidenceCrop** | Per-finding screenshot evidence linked to detection | P1 |
| **ExtractedClaim** | Normalized sale/stock/timer text for longitudinal diff | P2 |
| **DomainProfile** | Internal domain-level caution profile (not public) | P2 |
| **DomainSubscore** | Subscores: technical safety, transparency, pressure, consistency, checkout | P2 |
| **LongitudinalComparison** | Stored diff between two scans on same domain | P2 |
| **RescanSchedule** | User-requested or auto rescan at 1h / 24h / 7d | P2 |
| **ReviewRequest** | Website owner correction workflow | P0 / P3 |
| **UserReport** | End-user report of incorrect scan | P0 |
| **AdminNote** | Internal review notes and actions | P3 |
| **AuditLog** | Access trail for screenshots and amendments | P3 |

### 3.2 Current vs planned schema mapping

**Implemented today (`prisma/schema.prisma`):**

```
Scan ──< Detection
```

| Field (current) | Maps to PRD |
|-----------------|-------------|
| `Scan.url`, `normalizedUrl`, `finalUrl` | URL submission + redirect resolution |
| `Scan.status` | Scan lifecycle |
| `Scan.riskScore`, `summary` | Report (rename concern labels in UI) |
| `Scan.pageTitle`, `errorMessage` | Scan metadata |
| `Detection.category`, `patternType` | Design cue type |
| `Detection.severity`, `confidence`, `evidence` | Finding detail |

**Planned migrations (by priority):**

1. **P0:** Add `concernLevel` enum on `Scan`; add `suggestedAction`, `confidenceLevel` on `Detection`; add `ReviewRequest`, `UserReport`.
2. **P1:** Add `Domain`, `ScanMetadata`, `EvidenceSnapshot`, `EvidenceCrop`; link `Scan.domainId`.
3. **P2:** Add `ExtractedClaim`, `DomainProfile`, `DomainSubscore`, `LongitudinalComparison`, `RescanSchedule`.
4. **P3:** Add `AdminNote`, `AuditLog`; extend `Scan` with `modelVersion`, `rulesVersion`.

### 3.3 Key relationships

```
Domain (1) ──< (N) Scan ──< (N) Detection
Scan (1) ──< (N) EvidenceSnapshot ──< (N) EvidenceCrop ──> (1) Detection
Domain (1) ──< (1) DomainProfile ──< (N) DomainSubscore
Scan (A) + Scan (B) ──> LongitudinalComparison (same Domain)
ReviewRequest / UserReport ──> Scan (and optionally Domain)
AdminNote / AuditLog ──> Scan, EvidenceSnapshot, ReviewRequest
```

### 3.4 Storage and retention rules

| Asset | Visibility | Retention |
|-------|------------|-----------|
| Full-page screenshot | Private — admin/review only | Short (e.g. 30 days) |
| Evidence crop | Private — shown to scanning user in report | Longer if needed for scoring |
| Extracted text / claims | Private | Aligned with scan record |
| Domain profile | Internal only | Updated on each scan |
| Public rankings / hall of shame | **Never** | N/A |

---

## 4. Product backlog

### P0 — Baseline (legal safety & privacy)

- [ ] Homepage disclaimer (see §2.1)
- [ ] Report disclaimer (see §2.6)
- [ ] Prohibited wording list in generated conclusions
- [ ] Safe wording templates for all user-facing copy
- [ ] Private-by-default repository — no public screenshots, rankings, or hall of shame
- [ ] Takedown / correction process — owner review + user reports + admin amend/delete
- [ ] Privacy redaction on all stored screenshots
- [ ] Scanning restrictions — public pages only, no bypass, rate limits, block private URLs

### P1 — Core URL checker

- [ ] URL submission page with validation
- [ ] Redirect detection and final URL capture
- [ ] HTTPS status check
- [ ] Basic domain metadata check
- [ ] URL reputation check (when source available)
- [ ] Neutral technical signal display

### P1 — Screenshot and evidence capture

- [ ] Playwright page load
- [ ] Full-page and viewport screenshots
- [ ] Screenshot crops around detected elements
- [ ] Timestamped private snapshot storage
- [ ] Store page title, domain, URL, scan ID
- [ ] Extract visible text; store relevant DOM snippets
- [ ] Retention: short full-page, longer crops

### P1 — Dark pattern detection MVP

- [ ] Countdown timers
- [ ] Urgency phrases: “ends today”, “limited time”, “offer expires”, “last chance”, “flash sale”
- [ ] Scarcity phrases: “only X left”, “low stock”, “selling fast”, “limited quantity”
- [ ] Social proof: “people are viewing”, “bought in the last”, “someone just purchased”
- [ ] Confirmshaming: “No thanks, I hate saving”, etc.
- [ ] Preselected checkboxes
- [ ] Repeated popups
- [ ] Sticky checkout pressure banners

### P1 — Report generation

- [ ] Safe summary copy
- [ ] Per-finding: cue type, evidence, confidence, why it matters, suggested action
- [ ] Confidence levels: Low, Medium, High, Needs repeated scan
- [ ] Non-accusatory explanations for each cue category

### P2 — Private repository and trust profile

- [ ] Private scan repository grouped by domain
- [ ] Track repeated claims, sale labels, countdown resets, stock/visitor patterns, late fees
- [ ] Domain-level internal trust profile with subscores (not one harsh score)
- [ ] Safe score labels only — no “scam risk” / “fraud score”

### P2 — Longitudinal checks

- [ ] User-requested rescan
- [ ] Auto-rescan at 1 hour, 24 hours, 7 days
- [ ] Screenshot and claim comparison over time
- [ ] Safe comparative wording (see §2.11)

### P2 — User education layer

- [ ] “What this means” cards per cue category
- [ ] “What you can do next” section (compare prices, check terms, reviews, pause, screenshot, dispute-friendly payment)

### P3 — Admin review dashboard

- [ ] Review stored scans
- [ ] Delete screenshots, correct false positives, mark detection quality
- [ ] Internal notes
- [ ] Website owner review queue
- [ ] Audit log for screenshot access
- [ ] Track model/rule version per scan

### P3 — Safer AI-assisted analysis

- [ ] LLM runs only after rule-based detection
- [ ] Force cautious language and evidence references for every finding
- [ ] Do not infer intent or accuse the business
- [ ] System rule: “Describe observable design cues only. Do not make claims about legality, fraud, dishonesty, or business intent.”

---

## 5. Non-functional requirements

| Area | Requirement |
|------|-------------|
| **Privacy** | Screenshots and scans private by default; redact PII before storage |
| **Security** | SSRF protection; block internal networks; rate limiting |
| **Legal** | No accusatory language; correction path for site owners |
| **Performance** | Scan actions ≤ 60s serverless timeout (Vercel) |
| **Dates** | Display in SGT, format DD/MM/YYYY |
| **Architecture** | Server actions for scan flow; routes only for webhooks/interfaces when needed |

---

## 6. Open questions

1. **Blob storage provider** for private screenshots (S3, Vercel Blob, etc.)?
2. **URL reputation source** — which API/feeds are approved for “known unsafe URL signal”?
3. **Retention periods** — exact days for full-page vs crop vs scan records?
4. **Owner review** — dedicated `/review` page vs email-only initially?

---

## 7. References

- Implementation: `prisma/schema.prisma`, `src/types/scan.ts`
- Design system: `design-system/design-system/scam-website-detector/`
- README setup and deployment notes
