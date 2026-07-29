# Escape Room — Stacked Delivery Plan

- **Status:** Approved; execution in progress
- **Goal:** Replace the oversized PR #5143 with a reviewable stack while preserving its completed implementation.
- **Source of truth:** `codex/escape-room-production` at `4be19aa61`
- **Starting trunk:** `v3` at `f16b9ceb4` (Prisma 7)
- **Stack worktree:** `trees/escape-room-stack`
- **Topology owner:** this worktree; all stack operations use the official `gh stack` extension.
- **Original PR:** Keep #5143 and its branch unchanged as the safety reference until the replacement stack exists and is verified.

## Decisions

- Extract and adapt the final implementation; do not rewrite the feature from scratch.
- Use one linear GitHub stack with four branches and four PRs.
- Put settings in the first runtime-capable Escape Room PR. Do not expose settings in a standalone PR without working runtime behavior.
- Land QR Scan authoring and printing first, but keep QR Scan unavailable in ordinary activities. Participant answering arrives with the individual Escape Room layer.
- Keep Group Activity and Live Quiz in separate layers because their submission, concurrency, and monitoring models differ.
- Regenerate Prisma and GraphQL artifacts on the current trunk instead of copying stale generated output.
- Publish draft PRs through `gh stack submit --auto`, then set the exact conventional titles and complete bodies with `gh pr edit`; humans merge through the GitHub UI.
- Treat `gh stack` exit code 9 as a hard publication blocker. Do not fall back to improvised regular PR chaining when repository stacks are unavailable.
- No branch deletion, force-push of the original branch, stack reorder, unstack, or merge without fresh authorization.

## Extraction method

1. Prefer clean cherry-picks from the source history when a commit belongs wholly to one layer.
2. For mixed commits, transplant the final source behavior by file or hunk into its owning layer.
3. Resolve shared files in dependency order, preserving the final behavior at `4be19aa61`.
4. Re-run generators on Prisma 7 and retain only generated output produced from the extracted source.
5. Compare each completed layer with the corresponding source paths and contracts; record intentional omissions.
6. Rebase the upstack with `gh stack rebase --upstack` whenever a lower layer changes.
7. At the final gate, compare the top-of-stack path inventory with `4be19aa61` and maintain an explicit ledger for every intentionally omitted source path or behavior.

## Stack

### Layer 1 — QR Scan foundation

- **Branch:** `codex/escape-room-qr`
- **PR title:** `feat(elements): add QR scan authoring and print workflow`
- **Base:** `v3`
- **Includes:**
  - `QR_SCAN` data-model and shared type contracts.
  - Opaque CSPRNG code creation, preservation on edit, and regeneration on duplication.
  - Participant-safe serialization that never exposes the answer code.
  - Lecturer editor, owner-authorized code access, print view, request-time decoys, and print styling.
  - Server-side create, edit, and template guards that reject QR Scan placement in every activity while no Escape Room runtime exists.
  - Prisma migration and analytics schema parity.
  - Targeted lifecycle, authorization, uniqueness, and leakage tests.
  - Engineering wiki, relevant repository skills, i18n, and browser evidence.
- **Excludes:**
  - Placement in ordinary activities.
  - Participant scanner, answer submission, and grading.
  - Escape Room configuration and attempts.
- **Source commits:** `f4a387a22`, `f0c75481b`, `b7e914a46`, plus QR-only corrections from later source commits.
- **Acceptance:**
  - Creation, edit, duplication, preview, and printing work for an exact owner.
  - Unauthorized code and print access fail closed.
  - Codes and decoys meet format, uniqueness, and non-disclosure contracts.
  - QR Scan remains unavailable in activity element selection until Layer 2, and direct API/template placement fails closed.

### Layer 2 — Individual Escape Rooms

- **Branch:** `codex/escape-room-individual`
- **PR title:** `feat(escape-room): add individual quiz mode`
- **Base:** `codex/escape-room-qr`
- **Includes:**
  - Escape Room configuration, attempts, sequential gating, timers, lockouts, hints, reset, pruning, statistics ownership, and monitoring.
  - The preserved generalized data model, including dormant Group Activity and Live Quiz relations required by later layers; only individual runtime behavior is exposed in this layer.
  - Practice Quiz and Microlearning authoring and participant runtime.
  - QR Scan placement, scanner/manual fallback, grading, and secure participant payloads for these modes.
  - Complete individual-mode GraphQL and browser regression coverage.
  - Lecturer/student documentation, engineering wiki, repository skills, and screenshots.
- **Excludes:** Group Activity and Live Quiz Escape Room behavior.
- **Acceptance:**
  - Both individual modes enforce server-owned attempts and current-stage access.
  - Timers remain server-anchored and hints survive reload without double charging.
  - Monitoring includes not-started participants and authorized reset.
  - QR Scan codes never appear in participant data or persisted participant-visible decisions.

### Layer 3 — Group Activity Escape Rooms

- **Branch:** `codex/escape-room-group`
- **PR title:** `feat(group-activity): add escape room mode`
- **Base:** `codex/escape-room-individual`
- **Includes:**
  - Shared group attempts and participant flow.
  - Exact-set validation and atomic multi-answer grading.
  - Concurrent start, hint, submission, lockout, completion, and reset behavior.
  - Group monitoring and two-participant runtime evidence.
  - Group-specific docs, wiki, skill, test, and screenshot updates.
- **Acceptance:**
  - Invalid, partial, duplicate, and foreign submissions leave state unchanged.
  - Concurrent submissions produce one consistent transition.
  - Every group member sees the same attempt and monitoring state.

### Layer 4 — Live Quiz Escape Rooms

- **Branch:** `codex/escape-room-live`
- **PR title:** `feat(live-quiz): add escape room mode`
- **Base:** `codex/escape-room-group`
- **Includes:**
  - Per-block authoring, template round-trip, and participant runtime.
  - Response API and worker validation, atomic claims, retry idempotency, and authoritative active-block checks.
  - Hint, QR Scan, timer, lockout, progression, cockpit monitoring, and reset behavior.
  - Live Quiz docs, wiki, skill, test, and screenshot updates.
- **Acceptance:**
  - No question content is disclosed before start or beyond the current stage.
  - Duplicate delivery and concurrent responses grade at most once.
  - Responses fail once the block is no longer active.
  - Cockpit progress and reset remain correctly permission-scoped.

## Verification loop

Run in the exact stack worktree DevPod established by `devrouter ensure .`.

For every layer:

1. Run targeted unit/integration tests for the extracted contracts.
2. Regenerate and verify Prisma/GraphQL artifacts where applicable.
3. Run affected package checks and `git diff --check`.
4. Exercise UI changes with `npx agent-browser@0.32.2` against the routed worktree; capture current-head screenshots in relevant locales and viewports.
5. Update affected engineering wiki pages and relevant repository skills in the same layer.
6. Stage deliberately and perform the public-repository data-hygiene review before committing.
7. Obtain independent correctness and simplification review; resolve verified findings.
8. Rebase and re-verify the upstack after lower-layer corrections.

Before draft publication of the complete stack:

- `pnpm run check:all`
- `pnpm run build`
- Targeted GraphQL, util, response-api, worker, and Playwright checks owned by each layer
- Prisma schema/migration parity
- Empty-schema Prisma 7 `migrate deploy` replay, clean schema diff, analytics schema sync, and explicit validation of the non-transactional concurrent QR index migration
- Current generated GraphQL artifacts
- Top-of-stack source path inventory and intentional-omissions ledger against `4be19aa61`
- Branch-scoped security review
- Mandatory maintainability review
- Klicker branch crosscheck
- Clean worktree and `git diff --check`

## Goal prompt

Continue autonomously until all four approved stack layers have been extracted from `4be19aa61`, adapted to current `v3`, independently verified, committed, reviewed, and published as draft GitHub stacked PRs through `gh stack submit --auto`, or until a genuine external blocker prevents progress.

Preserve the original PR #5143 and source branch unchanged. Use one worktree and one linear `gh stack` topology. Do not reimplement established feature behavior when it can be transplanted from the source. Put each correction in the lowest owning layer and rebase the upstack. Do not weaken or delete tests to obtain green checks. Keep behavior documentation, wiki facts, repository skills, generated artifacts, and browser evidence with the layer that owns them. Do not merge, queue, unstack, reorder, delete, or force-push without explicit authorization.

After submission, set the planned titles and complete PR bodies with `gh pr edit`, then read back every PR's base, head, draft state, URL, and GitHub stack order. If `gh stack` reports that repository stacks are unavailable, stop rather than creating an improvised stack.

When blocked by environment or authentication, complete every independent local task, record the exact failing command and error, and stop only at the boundary that needs user action.

## Progress

- [x] Confirm approved extraction-based four-layer topology.
- [x] Verify clean source worktree at `4be19aa61`.
- [x] Fast-forward local `v3` to `f16b9ceb4`.
- [x] Create `trees/escape-room-stack`.
- [x] Initialize `gh stack` with `codex/escape-room-qr` rooted at `v3`.
- [x] Commit and independently review this plan; revision findings incorporated.
- [x] Extract and verify Layer 1.
- [x] Add, extract, and verify Layer 2.
- [x] Add, extract, and verify Layer 3.
- [x] Add, extract, and verify Layer 4.
- [ ] Run final stack-wide review and verification gates.
- [ ] Publish draft PRs and read back stack/PR state.

## Publication state

- `gh auth status` confirms the active `rschlaefli` account is authenticated
  with repository and workflow scopes. No external publication blocker is
  currently known.

## Layer 1 corrective follow-up — 2026-08-01

The independent Sol high review of `7812fa71..4f2a6186` confirmed three release-relevant gaps. All corrective work stays on the existing bottom branch `codex/escape-room-qr` and therefore remains part of PR #5224; no new stack branch is needed.

1. **Catalog duplication lifecycle:** `copyElementToAccount` must generate a new opaque code whenever the copied element is `QR_SCAN`. Extend the existing element-sharing integration coverage to assert source/copy ownership, code format, code inequality, and owner-authorized print data.
2. **Ordinary activity selection boundary:** move the four wizard `acceptedTypes` lists into one shared manage-side source. Filter the question-pool query before count/offset pagination through an optional GraphQL `elementTypes` predicate, keep the question-pool view and select-all state defensively filtered, and apply the same predicate in `PasteSelectionButton` and `AddStackButton`. This must cover Practice Quiz, Microlearning, Group Activity, and Live Quiz without changing the server-side fail-closed guards.
3. **Current-tip browser evidence:** rerun the QR print flow at the corrective tip, including fractional and boundary decoy inputs and a foreign-owner print URL. Record the exact commit SHA, environment, and screenshots in `project/2026-07-29-escape-room-qr-verification/README.md`.
4. **Optional standards cleanup:** add the documented `0..20` Pothos validation to `qrScanPrintData.decoyCount` while retaining the service guard. The resolver-shape, duplicated-guard, and repeated-dispatch observations remain deferred because they are not functional blockers for this layer.

### Corrective verification gates

- GraphQL sharing, QR contract, and placement tests pass in the isolated DevPod.
- Manage and Playwright package checks pass; the new selection regression covers all four ordinary wizard entry points.
- `npx agent-browser@0.32.2` reproduces owner, unauthorized, and decoy-count states at the reviewed tip with current screenshots.
- If the schema validation is included, GraphQL codegen is regenerated and tracked artifacts are clean.
- `pnpm run check:all`, `pnpm run build`, `git diff --check`, and a clean worktree pass before rebasing `codex/escape-room-individual`, `codex/escape-room-group`, and `codex/escape-room-live` with `gh stack rebase --upstack`.

### Corrective execution status — 2026-08-01

- **Implemented in `9fed582de`:** catalog imports now rotate QR scan codes; the manage question pool, selection cleanup, select-all, paste, drag/drop, and bulk-add paths share the four activity-specific accepted-type contracts; `decoyCount` now carries the documented Pothos `0..20` validation; and a Playwright regression covers all four ordinary wizard entry points.
- **Static gates passed:** frontend-manage, GraphQL, and Playwright type checks; GraphQL codegen; the focused QR placement suite (6/6); frontend-manage production build; repository `check:all` (25 checks, 7 lint tasks); `git diff --check`; and the commit hooks. The host used Node 26.5.1 with Volta pnpm 9.7.0, so the repository's Node 24 engine warnings remain noted.
- **Database-backed checks remain blocked:** the focused QR contract suite cannot reach the local Prisma database, and the catalog-sharing test cannot load Hatchet without `HATCHET_CLIENT_TOKEN`; no test result is being treated as a pass.
- **Browser gate remains blocked:** the current-tip `agent-browser` run could not start because `devrouter ensure` could not determine the workspace process identity and the Docker socket is unavailable (`EPERM`). The verification README now labels the existing screenshots as historical evidence and records the exact blocker.
- **Stack topology is unchanged and dependents are not rebased yet:** after the database and browser gates are available, run `gh stack rebase --upstack`, re-run the dependent checks, and only then consider publication. No PR was marked ready or merged by this corrective execution.

## Second-pass corrective plan — 2026-08-01

The review found that client-only filtering after the existing `numEntries`/`offset` query is not a complete boundary: unsupported rows can consume page slots and remain part of the displayed total. The follow-up is intentionally limited to the existing bottom PR.

1. **Make pagination authoritative:** add an optional `elementTypes: [ElementType!]` argument to `userElements`, add the matching generated operation variable, and apply the predicate inside the Prisma relation filter. Keep the existing singular `type` filter as an intersection so ordinary library filters continue to work. Pass the accepted wizard contract only while an activity wizard is open.
2. **Exercise both state and insertion paths:** seed one accepted SC and one QR Scan with QR first on a one-row page. For each of the four ordinary wizard entry points, select-all before opening the wizard to exercise stale-selection cleanup, then select-all inside the filtered pool and exercise paste or bulk-add insertion. Assert the accepted element is available and QR is absent from both the pool and wizard rows.
3. **Regenerate and validate dependents:** regenerate the GraphQL artifacts, run package checks and the root gates, then rebase the unchanged individual/group/live branches with `gh stack rebase --upstack --no-trunk`. Do not publish or merge until the browser gate is available.

### Second-pass execution status — 2026-08-01

- **Implemented in `1d3461812`:** server-side `elementTypes` filtering now runs before Prisma count/offset pagination; the manage query supplies the activity contract; and the Playwright regression covers a QR-first one-row page, stale selection cleanup, select-all, paste, and bulk-add across all four ordinary wizard entry points.
- **Static checks passed:** GraphQL codegen and check, frontend-manage check after rebuilding the generated GraphQL package, Playwright check, root `check:all` (25 checks and 7 lint tasks), `git diff --check`, and the commit hooks. Generated GraphQL schema/client/server artifacts are tracked and formatted.
- **Runtime gates remain unchanged:** the database-backed GraphQL tests still cannot connect to the local Prisma/Hatchet runtime, and the current-tip browser gate is still blocked by the host's devrouter process-identity failure and unavailable Docker socket. No runtime result is being upgraded to a pass.
- **Stack rebase completed locally:** `gh stack rebase --upstack --no-trunk` rebased `codex/escape-room-individual`, `codex/escape-room-group`, and `codex/escape-room-live` onto the corrected bottom branch. Keep PRs draft and do not push/merge from this corrective execution.
- **Upstack compile correction:** `30f7baf22` adds the missing `ElementType` import required by the group wizard's QR boundary. The group commit hook completed 25 repository checks successfully before the rebase.
- **Top-tip static verification:** after rebuilding the ignored `@klicker-uzh/types` and GraphQL outputs, the live tip passed Hatchet, GraphQL, shared-components, and frontend-manage checks. The Playwright package check also remains green from the bottom verification.
- **Repository-wide top-tip gate limitation:** a fresh `check:all` attempt first hit Corepack's pnpm 11.5.0 signature/registry failure. The Volta Node 24 + pnpm 9.7 retry exposed stale workspace links after the offline install refresh (`vitest` and `@klicker-uzh/grading`); both affected package checks pass after restoring local ignored links, but the root gate was not reclassified as a final top-tip pass because the offline refresh stopped at the existing lockfile override mismatch and missing offline metadata for `rollup-plugin-serve`.

## Layer 1 evidence

- **Primary implementation commits:** `4ce964b08`, `01b7693a4`, `a270c49b5`, `37eacfb31`; the final review correction is committed with this progress update.
- **Verification:** affected package checks, 13 focused GraphQL contract and placement tests, full `check:all`, full production build, Prisma 7 empty-schema replay and clean diff, analytics schema parity, and desktop/mobile browser evidence all passed.
- **Independent review:** the security/correctness review found one minor no-op QR sample-solution control. QR Scan was removed from that UI capability group and the owner edit flow was rechecked semantically and visually. The simplification review found no code changes that reduced complexity without weakening the contracts.
- **Known unrelated validation debt:** the engineering-wiki validator still reports the pre-existing missing `type` field in `docs/solutions/best-practice/repeat-production-seeds-use-prior-state.md`; Layer 1 documentation itself passes repository formatting and type checks.

## Layer 2 evidence

- **Implementation commits:** `0ab3141bf`, `c2bd07757`, `ae33b4e4d`,
  `ecef38846`, `844de0875`, `43ab3c0ee`, and review correction
  `4d408b883`.
- **Verification:** 60 focused GraphQL Escape Room tests, three QR utility
  tests, one PWA response-state test, repository-wide `check:all`, the full
  22-workspace production build, and all 16 routed Individual Escape Room
  Playwright scenarios passed.
- **Migration proof:** a disposable empty PostgreSQL database accepted all 179
  migrations through Prisma 7 `migrate deploy`; the deployed database had no
  schema diff, contained `retentionProcessedAt` and no legacy
  `statsAggregatedAt`, and exposed `Element_qrScanCode_key` as both unique and
  valid. The analytics Prisma mirror remained in sync.
- **Browser evidence:** the current branch records desktop and mobile evidence
  for persisted Practice Quiz settings, the participant introduction, hint and
  timer state, the German QR manual fallback, and lecturer progress before any
  attempt. The final routed rerun covered Practice Quiz and Microlearning
  creation, editing, publication, gating, hint charging, lockout, reset,
  completion, and QR fallback.
- **Independent review:** the first review found a hint/submission lifecycle
  race and deferred Live Quiz fields in public inputs. The correction shares
  the lifecycle claim across hint, response, and reset paths; removes deferred
  fields from both public inputs; adds regression contracts; and renames the
  retention marker. The reviewer confirmed both blockers resolved with no new
  correctness or security finding. The simplification review found no required
  structural reduction; its safe naming and unreachable-guard suggestions are
  included in the correction.
- **Extraction boundary:** generalized dormant Group Activity and Live Quiz
  database relations remain for later layers, but the effective Layer 2 API,
  authoring UI, participant runtime, GraphQL operations, tests, and browser
  suite expose only Practice Quiz and Microlearning Escape Rooms. The
  per-layer verification README records the deferred source paths and
  behaviors.

## Layer 3 evidence

- **Implementation commits:** `b07726167`, `ffc79e4d2`, `40d1e99e8`,
  `4d4e682f6`, `33275873a`, and review correction `ac8a49d15`.
- **Verification:** 85 focused GraphQL Escape Room tests, affected GraphQL,
  PWA, and Playwright checks, repository-wide `check:all`, the full
  22-workspace production build, and all 18 routed Escape Room Playwright
  scenarios passed.
- **Browser evidence:** the current branch records an English desktop
  group-roster dashboard with both active and `NOT_STARTED` groups and a
  German mobile participant view of the shared lockout state. The ordered
  journey covers two members sharing start, lockout, completion, monitor
  status, and reset while read-only content stays outside the exact submitted
  answer set.
- **Independent review:** correctness review found that deriving a participant
  group with `findFirst` was ambiguous for valid same-course multi-group
  membership. Group start and hint calls now carry the routed `groupId`, and
  the server verifies the activity course and authenticated membership before
  using it as the lifecycle actor. The regression suite proves distinct routed
  attempts and rejection of missing group identity. Simplification review
  replaced swallowed configuration-delete errors, removed mutable `any`
  authoring data, and consolidated lifecycle-claim release.
- **Extraction boundary:** the effective Layer 3 diff exposes Group Activity
  authoring, shared attempts, atomic grading, participant runtime, monitoring,
  and reset without Live Quiz block settings, participant/cockpit runtime,
  response API/worker behavior, or Live-specific GraphQL inputs. The per-layer
  verification README records the screenshots, commands, review corrections,
  and the unchanged wiki-validator baseline warning.

## Layer 4 evidence

- **Implementation commits:** `019f8190a`, `c1444d129`, `0b54ebcce`,
  response-path and browser correction `083d04e30`, and documentation
  `8193f213a`.
- **Verification:** 89 focused GraphQL tests, 20 Response API enforcement
  tests, seven response-processor deduplication tests, one PWA response
  serialization/parsing test, and affected GraphQL, Response API, worker,
  Manage, PWA, and Playwright checks passed. Generated GraphQL artifacts are
  current.
- **Browser evidence:** all 20 ordered Escape Room Chromium scenarios passed.
  Live-specific coverage verifies block-setting edit round-trip, explicit
  participant start, incorrect-answer lockout, reload, completion, German
  cockpit progress, lecturer reset, and return to the protected start state
  through the real Response API and worker.
- **Environment correction:** browser verification exposed that all
  devcontainer variants configured the Response API origin without the
  required `/AddResponse` path. Primary, linked, and direct-local URLs now
  route Live Quiz submissions to the actual POST endpoint; devrouter
  fingerprint reconciliation restarted the exact stack process with the
  corrected value.
- **Documentation:** the lecturer and student tutorials now cover all four
  Escape Room modes. The engineering wiki and data-model, GraphQL, frontend,
  and verification skills describe the Live-specific contracts. The
  production Docusaurus build passed.
- **Extraction boundary:** the Live layer reuses the source implementation at
  `4be19aa61` while preserving lower-layer corrections: explicit routed Group
  identity, group roster monitoring, QR placement regression tests, and
  fail-closed template validation. The per-layer verification README records
  exact commands, screenshots, and the unchanged OKF validator baseline.
