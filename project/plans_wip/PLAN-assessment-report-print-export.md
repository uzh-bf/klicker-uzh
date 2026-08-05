# Assessment report export via browser print

## Status

Supersedes slice 2 of [PLAN-assessment-report-polish.md](PLAN-assessment-report-polish.md)
(client-side rasterised PDF via `html2pdf.js`). Slices 1, 3, and 4 of that plan
stand. Branch `fix/assessment-report-polish`, PR #5306, base `v3`.

Not yet executed. The plan has **not** passed the mandatory read-only plan
review gate; that must run before any of this lands in the PR.

## Goal

Replace the `html2pdf.js` rasterisation pipeline with the browser's own print
engine, driven from the already-generated report HTML blob. The report HTML
stays the single artifact; "Download report" becomes "Save as PDF" and prints
that blob.

This closes all three defects found during the PR #5306 review, removes a
dependency, and upgrades the output from a rasterised image to vector text with
live links.

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
histogram table — the 9px type the dead `.pdf-export` rules reached for is not
needed.

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
case.

## Decisions

Recommendations were put to the user in chat; these are the assumed rulings.
Each is reversible and can be vetoed before slice 2.

| # | Decision | Ruling | Consequence |
| - | -------- | ------ | ----------- |
| 1 | Histogram table in print | Hide it (`@media print { .histogram-table { display: none } }`) | One page holds across every bin count. Costs the accessible data-table alternative inside the PDF; the SVG keeps its `aria-label`, and the table stays in the on-screen HTML report. |
| 2 | Print entry point | Keep two buttons — "View report" opens the blob, "Save as PDF" opens it and prints | Preserves the promise in the copy and the existing `data-cy` hooks. A print button inside the report is not possible: the report's own CSP (`default-src 'none'`) blocks inline script. |
| 3 | Chrome's print footer shows the raw `blob:` URL | Accept | Cannot be suppressed from CSS. Mildly ugly on a document framed as a credential; flagged for a look during verification. |
| 4 | Save-as-PDF filename | Comes from `<title>` — keep the human title | "Assessment performance report - <Course>". `PDF_FILENAME_PREFIX` and `pdfFilename` become dead and are removed. |

## Implementation slices

### Slice 1 — Remove the PDF pipeline

`apps/frontend-pwa/src/components/insights/assessmentResults/exportReport.ts`:

- Delete `createAssessmentReportPdf` (202-238).
- Delete `createAssessmentReportArtifact` (445-464) and the
  `AssessmentReportArtifact` interface (40-45).
- Delete the dead `.pdf-export*` block (354-378).
- Delete `PDF_FILENAME_PREFIX` and the `pdfFilename` field; `filename` is
  already unused by the caller.
- Fix the 4-space indentation on the three `<section class="pdf-avoid">` lines
  (401, 409, 414).
- `createAssessmentReport` returns `{ url, html }` synchronously.

`SuspendedAssessmentResults.tsx`: call `createAssessmentReport` without `await`,
revoke only `.url` in the cleanup effect (91-98).

`apps/frontend-pwa/package.json`: drop `html2pdf.js` and
`@types/html2pdf.js`. Reinstall in the container, commit `pnpm-lock.yaml`.

Verify: typecheck passes; export yields the ready state with both buttons.

### Slice 2 — Real print CSS

Replace the one-line `@media print` rule (exportReport.ts:352) with:

- `@page { size: A4 portrait; margin: 12mm }`
- `main { max-width: none; margin: 0; padding: 0; font-size: 13px; line-height: 1.3 }`
- header/heading/table compaction as measured (header gap 12px, `.brand img`
  130px, `h1` 16px, `h2` 13px, `dt`/`dd` padding 4px 7px, `th`/`td` 3px 7px,
  `.issued` and `.privacy` 9px)
- `.chart svg { min-width: 0; width: 100%; max-width: 420px; height: auto; margin: 0 auto }`
  — width-capped, not height-capped, per the letterbox trap above
- `.verification { grid-template-columns: 72px 1fr }`, `.verification img`
  72 × 72
- `.histogram-table { display: none }` (decision 1)
- retain `.chart, .verification, .pdf-avoid { break-inside: avoid }`

Verify: one A4 page at both the 3-bin fixture and a 10-bin worst case.

### Slice 3 — Print action

`handleDownloadReport` (134-143) becomes `handlePrintReport`: open the blob in a
new window and call `print()` on it, keeping the existing popup-blocked error
branch.

Known pitfall to code around: immediately after `window.open`, the handle points
at `about:blank`, whose `readyState` is already `complete`. A naive `load`
listener or readyState check fires against the wrong document. Guard on the
window's URL having actually changed to the blob before calling `print()`.

`reportWindow.opener = null` in `handleViewReport` (128) nulls the child's
back-reference only; the parent's handle stays usable, so it can remain.

Verify: manual click in a real browser — the print dialog is the one thing
headless cannot confirm.

### Slice 4 — QR promise robustness

`createLogoQrCodeDataUrl` (100-108): wrap resolve and reject in a 10 s timeout
that clears `qrCodeRequestResult.current`, unmounts the hidden `<QRCode>` via
`setQrCodeRequest(null)`, and rejects with
`ASSESSMENT_REPORT_QR_RENDER_TIMEOUT`. Apply the same cleanup on the existing
reject branch in `handleQrCodeLogoLoad` (113-115), which currently leaks both.

Verify: unit-level or manual — block `/KlickerLogo.png` and confirm the spinner
clears with an error rather than hanging.

### Slice 5 — Copy and the swallowed error

`SuspendedAssessmentResults.tsx:250`: `} catch {` becomes
`} catch (error) { console.error(error); … }`, matching the `useEffect` above
it. This bare catch is why the `lab()` failure shipped unnoticed.

`packages/i18n/messages/en.ts` and `de.ts`:

- `exportReportExplanation` and `exportReportReady` — describe saving as PDF
  through the browser's print dialog instead of downloading a file.
- `downloadReportButton` — "Download report" → "Save as PDF" /
  "Bericht herunterladen" → "Als PDF speichern".
- `exportReportViewError` — currently tells the user to download the PDF
  instead, which will no longer exist as a separate path.
- Add a print-failure key.

### Slice 6 — Spec and docs

`playwright/tests/Z-credential-verification.spec.ts`: `waitForEvent('download')`
(63-66) no longer fires. Replace with `reportPage.pdf({ format: 'A4',
printBackground: true, margin: 12mm })` on the popup — the same print pipeline
the user gets — then keep `%PDF-` and tighten `/Type /Page` to exactly 1. The
project runs Chromium only (`playwright/playwright.config.ts:57`), so
`page.pdf()` is available.

The print click is testable: stub `window.print` on the popup via
`addInitScript` and assert it was called.

`qrCodeSize` and the content assertions are unaffected — the QR lives in the
HTML.

Add a 10-bin worst-case fixture assertion for the one-page contract.

Update `docs/log/2026-08-04-assessment-report-export.md` and the frontend
conventions wiki page, per the repo rule that behaviour changes update the wiki
in the same PR.

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
5. Manual: click "Save as PDF" in a real browser, confirm the dialog opens, save
   the result, check page count, selectable text, live verification link, and
   what the footer shows.

## Risks and open items

- The one-page contract at 10 bins is projected, not measured. If it fails,
  fall back to softening the copy to "A4 PDF" and accepting 1-2 pages.
- iOS Safari print behaviour inside the PWA needs a device check; the student
  audience is heavily mobile.
- The print dialog cannot be fully automated; one manual step stays in the
  verification loop permanently.
- PR #5306's commit history is left as-is unless a squash is requested.
- Branch is 3 ahead / 10 behind `origin/v3` as of 2026-08-05; rebase before
  implementing.

## Progress

- **2026-08-05:** Plan drafted after the PR #5306 review reproduced all three
  defects on a real stack. Print-based approach measured against the actual
  report HTML (one A4 page at 13px body, 169 KB, vector text). Decisions 1-4
  assumed per recommendation, pending user veto. Plan review gate not yet run.
