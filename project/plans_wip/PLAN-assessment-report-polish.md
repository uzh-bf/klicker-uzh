# Assessment report download and presentation polish

## Goal

Improve the student assessment report export without changing the existing
browser report experience:

- keep the standalone HTML report for the **View report** action
- make **Download report** produce a self-contained, single-page A4 PDF
- include the existing Klicker-logo QR code treatment in the report
- reduce the report title to the same hierarchy used by the report sections

## Non-goals

- No Prisma, GraphQL, authentication, credential, or snapshot changes.
- No changes to the on-screen assessment results calculations.
- No redesign of the verification portal.
- No server-side PDF service; the browser creates the PDF from the already
  issued server snapshot.

## Design answers

- **Domain vocabulary:** the existing `AssessmentReportSnapshotV1` for an
  assessment course, issued for a `Participant`.
- **Layer footprint:** `apps/frontend-pwa`, `packages/i18n`, the PWA package
  dependencies/lockfile, Playwright assessment-report coverage, and the
  frontend-conventions wiki page plus its change log.
- **Auth:** unchanged; issuance continues through the existing participant
  GraphQL mutation.
- **Gamification/async:** none.
- **UI surface:** Student PWA report export and standalone report document.
  Existing English and German strings will be updated together.
- **Test evidence:** update the existing Playwright credential lifecycle
  coverage for PDF downloads, keep the HTML view assertions, run PWA checks and
  the focused Playwright spec where the local test stack is available, then
  capture browser screenshots for the report and verification flows.
- **Seeds/fixtures:** reuse the existing deterministic assessment-report
  Playwright fixture.

## Implementation slices

1. Add the existing `react-qrcode-logo` dependency to the PWA and generate the
   QR data URL with `/KlickerLogo.png`, waiting for the logo-render callback
   before creating either artifact.
2. ~~Keep the HTML artifact for browser viewing, but create a PDF download from
   its rendered content with A4 dimensions, compact print-only layout, and
   page-break guards. Ensure the chart remains present and the PDF has one
   page.~~ **Superseded** by
   [PLAN-assessment-report-print-export.md](PLAN-assessment-report-print-export.md):
   the `html2pdf.js` route cannot work in the live app, and the PDF is produced
   from the browser's print engine instead.
3. Update report labels, export copy, and heading markup/styles so the title is
   an appropriate document heading and section headings remain the primary
   report hierarchy.
4. Extend the Playwright fixture assertions and frontend documentation, then
   run formatting, typechecking, build, and browser verification.

## Progress

- **2026-08-04:** Confirmed the unrelated `origin/dev` drift will not be
  incorporated; `origin/v3` is the requested base. Created the isolated
  `fix/assessment-report-polish` worktree from `origin/v3`.
- **2026-08-04:** Inspected the existing HTML export, the current plain QR
  generation, and the manage app's existing logo QR implementation.
- **2026-08-04:** Implemented logo QR generation, browser-view HTML retention,
  client-side single-page A4 PDF creation, compact PDF-only layout rules,
  heading/copy updates, and Playwright assertions for PDF type/page count.
  Synthetic browser checks pass for normal and maximum histogram sizes.
- **2026-08-04:** The isolated DevPod could not finish its repository bootstrap
  because the unrelated `packages/hatchet` Rollup build failed. App-level
  browser verification remains pending for CI or a repaired local stack.
- **2026-08-04:** `pnpm run check:all`, focused PWA and Playwright checks,
  frozen lockfile installation, formatting, static browser/PDF validation, and
  commit hooks passed. The full repository build remains blocked by the
  unrelated `packages/word-cloud` Rollup parser failure. Opened PR #5306
  targeting `v3`; real-stack assessment-report Playwright verification remains
  a CI follow-up because the isolated DevPod fails during bootstrap.
- **2026-08-05:** PR #5306 reviewed against a real devcontainer stack. The
  export is broken end to end: `html2canvas` throws
  `unsupported color function "lab"` on the live app's Tailwind v4 stylesheets,
  and the failure path revokes the HTML object URL, so the working HTML view is
  lost too. The `.pdf-export` class hooks never land on an element, so the
  compact A4 rules are dead and the PDF is 3 pages. The QR promise can hang
  forever. The `packages/word-cloud` and `packages/hatchet` Rollup failures
  were not upstream breaks but stale `*.tsbuildinfo` from a host-side build;
  after deleting those, the container build passes 22/22 and the real stack
  comes up. Screenshots committed under
  `project/plans_wip/assets/assessment-report-polish/`; review posted to the
  PR. Slice 2 superseded by
  [PLAN-assessment-report-print-export.md](PLAN-assessment-report-print-export.md).
