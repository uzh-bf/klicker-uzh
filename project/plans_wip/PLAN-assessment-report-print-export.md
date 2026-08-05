# Assessment report export via browser print

## Status

Supersedes slice 2 of [PLAN-assessment-report-polish.md](PLAN-assessment-report-polish.md)
(client-side rasterised PDF via `html2pdf.js`). Slices 1, 3, and 4 of that plan
stand. Branch `fix/assessment-report-polish`, [PR #5306](https://github.com/uzh-bf/klicker-uzh/pull/5306), base `v3`.

Implementation is complete in the working tree and the plan remains the
execution contract. The mandatory read-only planning review returned
`DONE_WITH_CONCERNS`; its findings are incorporated and closed below through
main-session verification. Repository-native checks are passing, while the
linked browser route and Playwright browser binary remain environment blockers;
the final independent outcome review and publication are still pending.

## Goal

Replace the `html2pdf.js` rasterisation pipeline with the browser's own print
engine, driven from the already-generated report HTML blob. The report HTML
stays the single artifact; "Download report" becomes "Save as PDF" and prints
that blob.

This closes all three defects found during the [PR #5306](https://github.com/uzh-bf/klicker-uzh/pull/5306) review, removes a
dependency, and upgrades the output from a rasterised image to vector text with
live links.

## Research

- Local source inspection verified the current artifact state, popup handlers,
  translation keys, QR library callback surface, and Playwright 1.58.2 PDF
  options.
- Real-stack browser measurements in the handoff are the evidence for the
  print dimensions. The three-bin fixture fits on one A4 page at 13px; the
  ten-bin case remains an acceptance check, not an assumption.
- No external research is required for this browser-local change.

## Non-goals

- No Prisma, GraphQL, credential, snapshot, or issuance changes.
- No server-side PDF service.
- No redesign of the report layout beyond what single-page A4 print requires.
- No change to the on-screen assessment results.

## Why the current approach cannot work

All three reproduced against a real devcontainer stack for this branch, logged
in as the seeded `assessment-report-student@example.org` participant.

### 1. `html2canvas` throws on the app's own CSS

```
Error: Attempting to parse an unsupported color function "lab"
```

`html2pdf.js@0.10.1` bundles html2canvas 1.4.x, which predates CSS Color 4.
`.from(htmlString)` does `createElement('div', {innerHTML: src})` and appends to
the **live document**, so html2canvas clones the whole page and walks every
stylesheet — including the Tailwind v4 and `@uzh-bf/design-system` rules that
emit `lab()`/`oklch()`.

Evidence it is the host page, not the report: the identical call with the same
HTML succeeds on `about:blank` (685 KB PDF) and fails on the course page. This
is why the PR author's synthetic validation passed and the real flow does not.

`createAssessmentReportArtifact` rethrows and revokes the HTML object URL
([exportReport.ts:460-463](../../apps/frontend-pwa/src/components/insights/assessmentResults/exportReport.ts)),
so the PDF failure also takes down the HTML view that worked before. End state
for the student: "The report was issued, but the report files could not be
created."

### 2. The single-page A4 styling never applies

The HTML parser drops `<html>`/`<body>` inside an `innerHTML` assignment, so the
two class hooks added in `createAssessmentReportPdf` never land on an element:

```
container children: META, META, META, META, TITLE, STYLE, MAIN
hasPdfExportEl: false        // .pdf-export
hasPdfExportDocEl: false     // .pdf-export-document
```

Every `.pdf-export …` rule (exportReport.ts:354-378) is dead. Consequences:
html2canvas clones at 793 × 2355 px, the isolated repro PDF has 3 pages, the
spec's `toHaveLength(1)` would fail, the de/en "single-page A4" copy is wrong,
and the report's CSP `<meta>` lands outside `<head>` and is ignored.

Separately, the dead CSS would not have worked even if it had applied:
`.pdf-export .chart svg { height: 74px }` on a `viewBox="0 0 640 300"` SVG
letterboxes it to ~158 px wide and centres it — `preserveAspectRatio` defaults
to `xMidYMid meet`. Compaction has to cap **width**, not height.

### 3. The QR promise can never settle

`createLogoQrCodeDataUrl` resolves only from `logoOnLoad`, which
`react-qrcode-logo` fires from `image.onload`. There is no `onerror` path and no
timeout, so a logo that fails to decode leaves the promise pending forever with
`isExporting` stuck on the spinner. The reject branch in
`handleQrCodeLogoLoad` also leaves `qrCodeRequestResult.current` set and the
hidden `<QRCode>` mounted.

## Measured basis

A candidate print stylesheet was applied to the real report HTML from this
branch and rendered through Chromium's print pipeline (A4, 12 mm margins,
686 px usable width, 1006 px usable height):

| Body size in print | `main` height | A4 pages |
| ------------------ | ------------- | -------- |
| 11px               | 878px         | 1        |
| 12px               | 897px         | 1        |
| 13px (≈9.75pt)     | 917px         | 1        |

One page is reachable at a readable 13px while keeping both the chart and the
histogram table in the 3-bin fixture. The 10-bin case needs additional
print-only compaction around the table; the table itself stays present and
legible.

Baseline for comparison, same HTML, current `@media print` block only: 1802 px
of content, 1.72 A4 pages of raw height, **3** actual pages once the four
`break-inside: avoid` sections are placed.

Output quality, current pipeline vs print:

| | html2pdf | print |
| --- | --- | --- |
| Size | 685 KB | 169 KB |
| Text | rasterised JPEG | embedded fonts, selectable |
| Links | flattened | live |

**Caveat that shapes decision 1 below:** the seeded fixture has 3 histogram
bins. Production merges down from 10. Seven extra rows is roughly 140 px against
89 px of headroom at 13px body size, so the one-page result above is a best
case. The table stays in print; the 10-bin case must recover that space through
print-only compaction elsewhere.

## Decisions

Recommendations were put to the user in chat; the recorded rulings below are
the execution contract for slice 2.

| # | Decision | Ruling | Consequence |
| - | -------- | ------ | ----------- |
| 1 | Histogram table in print | Keep it and recover space through print-only compaction | Preserves the accessible data table in the PDF. The one-page contract requires tighter print-only spacing, typography, chart, and verification-block sizing and must be measured against the 10-bin case. |
| 2 | Print entry point | Keep two buttons — "View report" opens the blob, "Save as PDF" opens it and prints | Preserves the promise in the copy and the existing `data-cy` hooks. A print button inside the report is not possible: the report's own CSP (`default-src 'none'`) blocks inline script. |
| 3 | Chrome's print footer shows the raw `blob:` URL | Accept | Cannot be suppressed from CSS. Mildly ugly on a document framed as a credential; flagged for a look during verification. |
| 4 | Save-as-PDF filename | Comes from `<title>` — keep the human title and require the course name | The title and resulting filename remain "Assessment performance report - <Course>". The course name is mandatory so reports from different courses do not collide; `PDF_FILENAME_PREFIX` and `pdfFilename` become dead and are removed. The manual Chrome check must inspect the suggested filename. |

## Planning-stage review

- **Reviewer:** configured read-only planning reviewer, inspecting the live
  branch and the complete draft.
- **Result:** `DONE_WITH_CONCERNS`. The print direction and four rulings were
  accepted in principle, but the original slice order and verification
  contract had concrete gaps.
- **Verified findings accepted:** make artifact removal and print wiring one
  typecheckable slice; specify the bounded popup state machine; use valid
  Playwright PDF options; add a named ten-bin fixture helper and cleanup; test
  QR timeout with a successful malformed image response; check the course name
  in Chrome's suggested filename; rewrite the stale generation-error key; and
  remove volatile branch-count metadata.
- **Fallback review:** after the first revision, the configured reviewer was
  terminated by an interrupted turn. A budget-constrained `gpt-5.4-mini`
  read-only review found two remaining clarifications: make ten-bin teardown
  idempotent and make the artifact-interface collapse explicit.
- **Closure:** those two edits below add no behavior or scope; the main session
  verified them against the live Prisma relations and current artifact callers.
  They are closed by main-session verification rather than another reviewer
  invocation.

## Implementation slices

### Slice 1 — Keep one HTML artifact and wire the print action end to end

`apps/frontend-pwa/src/components/insights/assessmentResults/exportReport.ts`:

- Delete `createAssessmentReportPdf`, `createAssessmentReportArtifact`, the
  dead `.pdf-export*` block, `PDF_FILENAME_PREFIX`, and both old artifact
  interfaces. Define one `AssessmentReportArtifact` shape as exactly
  `{ url: string; html: string }`; no `filename`, `pdfFilename`, or `pdfUrl`
  field remains in the module.
- Make `createAssessmentReport` synchronous and return that exact artifact
  shape.
- Keep the document `<title>` as the human title plus the escaped course name:
  `Assessment performance report - <Course>`.
- Fix the indentation on the three report sections while touching the markup.

`SuspendedAssessmentResults.tsx` in the same slice:

- Keep the report ready state and `View report` action, but revoke only `.url`
  during cleanup.
- Replace `handleDownloadReport` with `handlePrintReport` so deleting the PDF
  fields cannot leave an intermediate type error.
- The print handler opens the blob in a new window, handles a null popup with
  the print-failure translation, and only calls `focus()`/`print()` after both
  `location.href === reportArtifact.url` and `document.readyState ===
  'complete'`.
- Use a load listener plus a short guarded readiness check, bounded by a fixed
  timeout. Clean the listener, check, and timeout on success, popup close, or
  failure; close the print window on timeout/navigation failure and show the
  translated error. Do not treat the initial `about:blank` complete state as
  ready.
- Keep `reportWindow.opener = null` for the view action; it does not invalidate
  the parent's reference to the print window.

`packages/i18n/messages/en.ts` and `de.ts` in this slice must contain every key
used by the new flow:

- explain printing through the browser instead of downloading a separate PDF;
- label the second action "Save as PDF" / "Als PDF speichern";
- rewrite `exportReportViewError` so it no longer suggests a PDF download;
- rename or rewrite `exportReportDownloadError` as a report-generation error;
- add a print-failure error key and use it for popup/navigation/print failures;
- log the caught generation error in `handleExport` before showing the translated
  generation error.

`apps/frontend-pwa/package.json`: drop `html2pdf.js` and
`@types/html2pdf.js`; reinstall in the container and commit the synchronized
`pnpm-lock.yaml`.

Verify inside the container: `pnpm --filter @klicker-uzh/frontend-pwa check`,
then the real browser ready state shows both buttons and the print action no
longer references a PDF artifact field.

### Slice 2 — Real print CSS

Replace the one-line `@media print` rule (exportReport.ts:352) with:

- `@page { size: A4 portrait; margin: 12mm }`
- `main { max-width: none; margin: 0; padding: 0; font-size: 12px; line-height: 1.3 }`; reduce the body to 11px only if the ten-bin measurement still spills
- header/heading/table compaction as measured (header gap 12px, `.brand img`
  130px, `h1` 16px, `h2` 13px, `dt`/`dd` padding 4px 7px, `th`/`td` 3px 7px,
  `.issued` and `.privacy` 9px)
- `.chart svg { min-width: 0; width: 100%; max-width: 420px; height: auto; margin: 0 auto }`
  — width-capped, not height-capped, per the letterbox trap above
- `.verification { grid-template-columns: 72px 1fr }`, `.verification img`
  72 × 72
- keep `.histogram-table` visible, with compact cell padding and font sizing
  applied only in print (for example 8px text and 2px vertical cell padding),
  without hiding rows or removing the accessible table (decision 1)
- retain `.chart, .verification, .pdf-avoid { break-inside: avoid }`

Verify the real generated report at one A4 page with the three-bin fixture and
the ten-bin fixture introduced in Slice 4. Both the SVG and all table rows must
remain visible and legible; no height-only SVG scaling that letterboxes the
chart is acceptable.

### Slice 3 — Make QR rendering fail closed

`createLogoQrCodeDataUrl`: wrap resolve and reject in a 10 s timeout
that clears `qrCodeRequestResult.current`, unmounts the hidden `<QRCode>` via
`setQrCodeRequest(null)`, and rejects with
`ASSESSMENT_REPORT_QR_RENDER_TIMEOUT`. Apply the same cleanup on the existing
reject branch in `handleQrCodeLogoLoad`, and on component unmount or request
replacement, so no timer, pending resolver, or hidden QR component survives.

Verify with a deterministic browser route that returns HTTP 200 but malformed
image bytes for `/KlickerLogo.png`. The fetch must succeed, the QR logo decode
must never call `logoOnLoad`, the timeout must reject, the hidden component must
unmount, and the export spinner must clear with the generation error. A plain
blocked/404 request is insufficient because it fails before the QR promise.

### Slice 4 — Prove print output and the ten-bin layout contract

`playwright/tests/Z-credential-verification.spec.ts`: `waitForEvent('download')`
(in the current export helper) no longer fires. Install a context-level
`window.print` stub before opening the report so the popup inherits it, then
assert the print action was called. Render the same popup with valid Chromium
options: `reportPage.pdf({ format: 'A4', printBackground: true,
preferCSSPageSize: true })`. Keep `%PDF-` and tighten `/Type /Page` to exactly
one. Do not use the invalid `margin: 12mm` syntax; the report's `@page` rule is
the margin source.

Keep the title/content assertions, including the exact course name in the
document title and report HTML. Assert the histogram table is present and its
row count matches the rendered bins.

`qrCodeSize` and the content assertions are unaffected — the QR lives in the
HTML.

Add a named helper in `playwright/util/credentialVerification.ts` plus its
synthetic participant IDs in `playwright/util/constants.ts` to create a
30-participant score distribution with three responses in each of the ten base
score bins. The helper must clean up its extra participants, invitations,
participations, and responses through an idempotent cleanup called by
`resetAssessmentReportFixture`: delete extra responses first, then invitations,
participations, and participants by their explicit synthetic IDs so the unique
course invitation rows cannot survive. The ten-bin test must call the helper,
assert ten SVG bars and ten table rows, and invoke the reset cleanup in a
`finally` block as well as relying on the next test's reset.

### Slice 5 — Update the engineering record and collect browser evidence

Update `docs/log/2026-08-04-assessment-report-export.md` and the frontend
conventions wiki page, per the repo rule that behaviour changes update the wiki
in the same PR.

Run the mandatory `agent-browser` flow on the real course page and capture
before/after screenshots in
`project/plans_wip/assets/assessment-report-polish/`. Manually click "Save as
PDF" in Chrome, confirm the dialog opens, confirm its suggested filename
contains the course name, save the result, and check page count, selectable
text, live verification link, and the accepted raw `blob:` footer. Check iOS
Safari print behaviour before claiming mobile support; if no iOS device is
available, record that verification as an explicit release blocker rather than
silently treating Chromium evidence as mobile evidence.

## Verification

1. Build and typecheck **inside the container**. Never on the host: a host-side
   build leaves stale `*.tsbuildinfo` that makes `@rollup/plugin-typescript`
   skip emit, which is the real cause of the `packages/hatchet` and
   `packages/word-cloud` Rollup failures recorded as unrelated upstream
   blockers in the superseded plan. Recovery:
   `find . -path ./node_modules -prune -o -name "*.tsbuildinfo" -print -delete`.
2. `devrouter ensure .` for the real stack.
3. `agent-browser` on the course page — mandatory per repo CLAUDE.md for
   frontend changes; before/after screenshots into
   `project/plans_wip/assets/assessment-report-polish/`.
4. Playwright `Z-credential-verification.spec.ts`.
5. Manual Chrome: click "Save as PDF", confirm the dialog opens, confirm the
   suggested filename contains the course name, save the result, check page
   count, selectable text, live verification link, and the accepted raw
   `blob:` footer.
6. Manual iOS Safari: check the same print flow before claiming mobile support;
   if unavailable, report it as unverified and do not mark that support gate
   complete.

## Risks and open items

- The one-page contract at 10 bins is projected, not measured until Slice 4.
  If it fails after print-only compaction, reduce non-table whitespace and
  chart/QR sizing further before considering softer copy or accepting 1-2 pages.
- iOS Safari is a required manual release check because the student audience is
  heavily mobile; current Chromium evidence cannot substitute for it.
- The print dialog cannot be fully automated; one manual step stays in the
  verification loop permanently.
- The [PR #5306](https://github.com/uzh-bf/klicker-uzh/pull/5306) commit history is left as-is unless a squash is requested.
- The branch was rebased onto the current `origin/v3` before implementation.
  The feature remote's ahead/behind count is stale and must not be used as
  evidence of current divergence.

## Progress

- **2026-08-05:** Plan drafted after the [PR #5306](https://github.com/uzh-bf/klicker-uzh/pull/5306) review reproduced all three
  defects on a real stack. Print-based approach measured against the actual
  report HTML (one A4 page at 13px body, 169 KB, vector text). Decisions 1-4
  were still open at draft time.
- **2026-08-05:** User ruled to keep the histogram table in print. The plan now
  preserves it and makes print-only compaction the one-page strategy.
- **2026-08-05:** User ruled to keep both report actions: viewing the HTML
  report and saving it through the browser's print flow.
- **2026-08-05:** User ruled to accept Chrome's raw `blob:` URL in the print
  footer; the print CSS will not attempt to suppress it.
- **2026-08-05:** User ruled that the human title and course name must remain
  in the generated document title and Save-as-PDF filename.
- **2026-08-05:** Planning review returned `DONE_WITH_CONCERNS`. The revised
  slices now keep the first slice typecheckable, define the popup timeout and
  QR timeout checks, use valid Playwright PDF options, name ten-bin fixture
  setup/cleanup, require the course-name filename check, and make iOS evidence
  explicit. The plan was not yet commit-ready until the two follow-up
  clarifications below were verified.
- **2026-08-05:** The budget-constrained follow-up review found two remaining
  plan ambiguities. Main-session verification closed them without changing
  behavior: the artifact boundary is now explicitly `{ url, html }`, and the
  ten-bin cleanup order is explicit and idempotent.
- **2026-08-05:** Implemented the browser-print flow, exact single HTML
  artifact, A4 print stylesheet with the histogram table retained, bounded QR
  rendering, and the ten-bin fixture plus cleanup. Removed `html2pdf.js` and
  synchronized the lockfile. Updated the engineering wiki and export log.
- **2026-08-05:** Container checks passed for the PWA and Playwright packages;
  the direct container fixture exercise created and removed all 30 synthetic
  participants and responses. The focused Playwright run is blocked because
  the expected Chromium headless-shell binary is unavailable; attempted
  downloads did not complete and the partial full-Chromium extraction fails
  with an ICU data error.
- **2026-08-05:** `pnpm run check:all` reached the changed packages but its
  analytics lint task failed while `uv` tried to build `pandas==2.2.2`; the
  container has no `cc`, `gcc`, or `clang`. The changed PWA and Playwright
  checks, formatting, frontend lint, syncpack, Prisma-sync, and AGENTS checks
  passed; no unrelated toolchain installation was made.
- **2026-08-05:** The mandatory `agent-browser` attempt reached the linked PWA
  but its course URL returned Next.js 404. `devrouter ensure . --json` then
  failed on the workspace lifecycle lock, so before/after report screenshots
  and the manual Chrome/iOS checks remain unverified.
