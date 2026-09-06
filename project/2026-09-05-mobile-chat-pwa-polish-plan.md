# Mobile Chat and PWA polish execution plan

## Outcome and authority

Make the current Chat and student PWA easier to operate on phones, with clearer
answer state, comfortable controls, keyboard access and recoverable feedback.
Preserve the current design, domain behavior and existing navigation. The user
requested execution of the full audit roadmap with a goal and visual end-to-end
review on 2026-09-05. This authorizes the routine reversible local work below,
including synthetic runtime startup, focused checks, reviews and local commits.
No additional ceremony approval is needed.

The terminal condition is an implemented, independently reviewed local package,
with browser evidence and the owned runtime stopped. Push, publication, merge,
upstream integration, deployment and production data access are excluded.
Physical iPhone/Android and spoken assistive-technology acceptance remain
explicit external checks; browser emulation cannot prove those behaviors.

No redesign, new dependency, schema/API change, authentication change, provider
change or paid model requests. Chat generation is intercepted using synthetic
stream fixtures before every generation action, including edit and retry.

## Baseline and ownership

- Repository: `/Users/rschlae/Git/klicker/klicker-uzh`.
- Worktree: `trees/rs/mobile-chat-pwa-ux-audit`.
- Branch: `rs/mobile-chat-pwa-ux-audit`, tracking `origin/v3`.
- Source baseline: `0c08e083a60bdac6f5130d15f88159d83f9cdfd8`.
- After remote refresh the branch is zero ahead and two behind `origin/v3`.

The two newer commits affect runtime preparation and CI cache handling. Their
relevant changes were inspected without integration. Preserve the branch base.
The primary checkout and other owners' runtimes remain untouched.

The main session owns product decisions, translations, tests, synthetic fixtures,
runtime, integration, evidence and commits because these are shared surfaces.
One native executor owns shared quiz/markdown changes, followed by PWA changes.
A second native executor owns Chat changes after its baseline capture. Workers
do not commit, run competing fixture resets or manage the runtime.

## Commit slices and acceptance

### Shared quiz and markdown controls

Expose boolean selected state and uniquely named question/statement groups.
Single-choice remains exclusive; multiple-choice toggles independently; an
unanswered KPRIM statement has neither true nor false pressed. A visible
selection marker must not imply correctness. Preserve scoring and callbacks.
Stack authored grid answers on narrow screens. Enlarge and name frequent quiz
controls. Preserve author image descriptions and decorative empty alternatives.

Inspect rendered nesting before choosing markup. Image expansion and links
must remain independently keyboard-operable without selecting the answer.
Resolve localized image expansion labels with existing capabilities and a
bounded propagation path before editing. Locale changes must invalidate any
memoized label even when markdown content is unchanged. Do not add a dependency.

Acceptance: synthetic SC, MC and KPRIM in live quiz, practice and lecturer
student preview; keyboard selection, submitted read-only state, independent
image open/close with focus return, long text/formulas/images and mobile reflow.
Run simplifier and a shared-interaction slice review after the local commit.

### PWA navigation, progress and feedback

Show the current mobile menu section. Add one main landmark and working skip
link, semantic home and reload controls. Preserve question position when scores
are equal, and give practice reset a name and usable target without changing
its existing reset contract. Inspect feedback vote semantics before adding
missing names/state. Label feedback input, use mobile-readable text, expose
submission busy state and preserve success/failure meaning. Respect reduced
motion for confetti without losing the success signal.

Keep the mounted feedback form and draft when existing data is refetched or a
background request fails. Initial failure gets a retry path. Mutation failure
retains text and clears busy state; only success resets text. Remove only the
artificial 700ms feedback delay. Preserve confusion's 4-second debounce and
60-second cooldown. Never optimistically mark a quiz response accepted.

Acceptance: course entry, live section navigation, bookmarks and return,
equal-score practice steps/reset, initial error/retry, background refetch draft,
mutation failure/success, slow quiz response and reduced-motion success.
Run simplifier and an async-state slice review after the local commit.

### Chat interaction polish

Align code copy and history actions with existing coarse-pointer target sizing.
Announce copy success and recoverable failure. Make inactive-row actions usable
without hover, preserving delete confirmation and preventing accidental thread
switching. Honor reduced motion when jumping to sources. Align declined-consent
viewport sizing, permit content growth and use an appropriate page heading.
Restore edit-field focus visibility. Reproduce settings duplicate IDs before
making any targeted association correction; do not change unreproduced issues.

Acceptance: consent decline/reaccept, welcome, streamed chunks, stop/retry,
history rename/cancel/delete confirmation, citations, attachments, edit, copy
success/denial, settings DOM, and empty/loading/error states. Every generation
route uses intercepted synthetic output. Run simplifier after the local commit.

## Verification and integration

Capture baseline states before each worker edits the corresponding surface.
Use English and German at 390×844 and 1440×900, plus 320px reflow. Mobile browser
contexts must enable touch and coarse pointer, not only resize the viewport.
Check keyboard order/focus, 200% text enlargement, reduced motion and page
overflow. Inspect screenshots visually; assertion success alone is insufficient.

Reuse repository tooling and existing synthetic helpers. Build dependencies
before checking packages. Container toolchain commands run through the exact
worktree's devrouter runtime; host Playwright uses `pnpm playwright:host -- ...`.
Use `npx agent-browser` for visual before/after interaction checks. Do not run
competing seeded suites against the same database. Tests protect behavior and
structured semantics, not prose, translation strings or incidental seed data.

Freeze writers for integrated verification. Run applicable focused package
tests and required repository checks, inspect every changed hunk and staged
data for scope/secrets, then commit. Equivalent container checks cover the host
hook split explicitly. Fix and reverify consequential review findings. Final
review covers the committed integrated package after runtime shutdown. No
remote stack is created; publication topology is outside this local contract.

Evidence stays in ignored `project/_local/` with a concise receipt here. Record
actual commands, results, screenshots and remaining gaps without claiming
physical-device or conformance proof.

## Plan review

Native planner Locke reviewed the complete contract. First pass requested
independent nested image interaction, feedback draft preservation, shared
lecturer-preview coverage, runtime/base handling, and a precise device-proof
boundary. All were accepted above. Second pass: **DONE — VERDICT APPROVED**.
It additionally required memo invalidation for localized markdown labels.

## Progress

All three implementation slices are committed locally. Shared-interaction review
returned DONE; its accepted KPRIM simplification passed focused checks. PWA
review returned DONE after correcting a confetti coverage gap. Chat's
simplifier accepted one consolidation of identical settings conditions; this
preserves DOM order, implicit labels and the existing browser-tested behavior.
No push, publication, integration, merge, deployment or paid Chat generation
occurred. No schema, dependency, authorization or product-model changes were
introduced. Reports are retained under `project/_local/reviews/`.

The integrated completion and runtime-release receipt is recorded locally at
`project/_local/mobile-polish/final-receipt.md`. The separate final-review report
is `project/_local/reviews/2026-09-06-mobile-polish-final-reviewer.md`.

### Implemented behavior

Shared answer controls expose named groups and boolean pressed state, stack on
phones, and preserve independent links and image expansion. Image alternatives,
localized expansion labels and focus return are preserved. PWA navigation has
landmarks, a skip link, named controls and current-section state. Progress labels
remain distinguishable at equal scores. Bookmarks expose pressed state and use
44px targets. Feedback retains drafts on failed submission and background
refetch, offers retry, and uses readable input text and busy state. Reduced motion
suppresses confetti while accepted responses remain announced.

Chat exposes touch history actions, copy success/failure status, reduced-motion
citation movement, consent reacceptance and edit focus. The settings model
selector duplicated its ID on four elements; implicit labels now associate the
controls without duplicate IDs. Browser and type checks verify that correction.

### Browser evidence

All three specs run through the host Playwright launcher against this worktree's
isolated seeded database, with Chromium and one worker. Chat generation uses
synthetic intercepted streams. Receipts are cumulative across focused runs,
not a claim of one completely green 34-case run.

- `combined-run-1`: 23 passed, 5 failed. Failures exposed cold navigation and
  incorrect preview/locale fixture assumptions. Earlier cases named German
  but opening English PWA routes are not German-language evidence.
- `combined-run-2`: 18 passed, 2 failed. EN/DE copy/history and all 14 PWA cases
  passed on explicit locale routes. MC/KPRIM preview passed. Settings assertions
  ran while the selector hid background controls; corrected the test timing.
  Single-choice preview exposed a narrow lecturer-editor layout constraint.
- `combined-run-3`: 11 passed, 1 failed. Settings, MC/KPRIM preview, EN/DE practice
  reset/bookmark, live MC/KPRIM and public voting passed. Visual inspection of
  enlarged feedback text found a clipped label despite passing page bounds.
  Added a label minimum-width override and label-specific bounds assertions.
- `combined-run-4`: EN/DE public voting and 200% text passed; both screenshots
  were inspected and the labels wrap without clipping. Desktop single-choice
  preview exposed the editor's capture-phase Escape handler dismissing the
  editor when closing a nested image. A bounded dialog-ownership guard and
  focus-return assertion pass in the focused `combined-run-5` (1 passed).
  Escape closes only the image, returns focus and preserves answer selection.

Artifacts are ignored under `project/_local/mobile-polish/`. The pre-existing
lecturer authoring page overflows at 390px. Its wider redesign is outside this
Chat/student PWA scope. Single-choice nested-content preview is verified at
1440px; student reflow is covered separately at 320px and 390px.

Manual agent-browser verification used the real local backend for background
feedback failure and recovery: the same input DOM node and draft survived an
aborted refetch, the retry appeared, and actual retry cleared the error while
retaining both. Receipt: `background-refetch-receipt.json`, with error/recovered
German screenshots. Loaded PWA home/course and Chat settings were inspected.
Manual 390px captures are viewport evidence; touch/coarse-pointer evidence comes
from Playwright contexts configured with `isMobile` and `hasTouch`.

The final preview screenshot exposed an invalid test image URL. The fixture now
uses an existing local image and asserts successful loading. `combined-run-6`
passed all four cases: nested-image selection/focus and the existing editor
Escape, dirty-draft recovery and nested-collection regressions. Its screenshot
was inspected. Across the focused receipts, all 34 new cases have passing
evidence, plus these three existing regressions.

### Checks and runtime

Markdown built successfully with design-system resolution warnings. Shared,
Markdown, Chat, PWA and Playwright typechecks passed during implementation.
The final `pnpm run check:all` passed in the exact container (35/35 build/type
tasks, all seven lint tasks, staged formatting and repository contract checks).
Receipt: `project/_local/mobile-polish/check-all-4.log`. New specs are registered
in existing CI runtime and relevance manifests. An initial analytics failure
came from a Python 3.14 virtual environment; running its unchanged lint command
with the configured Python 3.12 restored it without dependency/config changes.
Host staged gitleaks and identity checks pass. Container checks substitute for
the host pre-commit toolchain; local commits use that verified hook split.
Local slice commits and required slice reviews are complete. The standalone
final review evaluates the full committed package after runtime release.

Exact workspace: `rs-mobile-chat-pwa-ux-audit`; current proven container:
`589f7ab02c8c10879d64dd8457fd739f5cd1e50a32603da955055d22280d89d9`.
Full-profile readiness passed. Serialize lifecycle operations and seeded suites.
Earlier runtime recovery restored an OOM-stopped process and a missing container
through canonical source-path reconciliation. No infrastructure configuration or
replacement connectivity changed. The manual browser session is closed.

### Final acceptance boundary

All 34 new scenarios have passing browser evidence across focused runs, plus
three existing editor regressions. The final EN/DE delayed-response cases now
enable gamification and prove absence, presence, and absence of the library's
actual confetti layer as reduced-motion preference changes. Both pass; see
`reduced-motion-control-2.log`. This closes the PWA review's sole finding.
The initial reduced-motion test did not exercise confetti and is not evidence
for its suppression.

The expanded cases initially reached a local Next.js 404 before application
code ran, despite the dynamic session page existing. Canonical stop/restart of
this exact runtime restored the route and both cases passed without application
changes. This is a local runtime recovery, not a product defect claim.

The final accepted local outcome requires the exact runtime stopped, zero
routes, and a separate integrated final-review verdict. Those receipts live at
the local paths above. Physical iPhone/Android, installed-PWA keyboard behavior,
rotation, safe areas, and spoken assistive technology remain external acceptance
checks. The pre-existing narrow lecturer authoring-page overflow is deferred.
No WCAG conformance or measured performance improvement is claimed.
