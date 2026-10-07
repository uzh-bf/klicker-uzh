# PR 4920: evaluation metadata and active-block reveal controls

## Current roadmap — 2026-10-07

### Outcome and authority

Complete the existing [evaluation PR](https://github.com/uzh-bf/klicker-uzh/pull/4920)
with reliable evaluation rendering, active presenter controls, and execution-bound
result aggregation. This section supersedes dated next-action and readiness
claims below; the older entries retain the decisions and historical evidence.

The user approved execution of this roadmap with a native goal, explicitly
excluding PR merging. The approved batch covers corrections, verification, one
readiness-driven `v3` integration into the task branch, ordinary commits/pushes
to the existing task branch, and PR-description updates. PR merging, PR approval,
force-push, deployment, additional data deletion, and messages to human reviewers
remain separately gated. The user requested verification of review comments
without replies. The user separately approved a pinned devrouter 0.2.0
installation in a task-only temporary directory. Later named approval covered
one auxiliary journal quarantine and exact synthetic runtime recreation, as
recorded below. Global CLI/MCP configuration, further shared-state repair and
other runtime/data deletion remain outside that approval.

Terminal condition: the verified integrated source is published to this PR,
required exact-head CI passes, final review has actually completed, and the
remaining human-review requirement is reported accurately. Merge readiness is
not established while GitHub retains blocking changes-requested reviews.
Release queue compatibility is recorded separately from source merge readiness.

### Reconciled baseline

| Item               | Current evidence                                                                                                                                                                                                                                                                                                                                                               | Consequence                                                                                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source and target  | Task checkout `trees/activity-info-on-eval` was clean before this roadmap update. Branch `audit-pr4920-merge`, HEAD and `origin/activity-info-on-eval` both `e84668825c048f1d69f3e66e197938455e29bec9`. PR targets `v3`, freshly fetched at `103255c85db481d9ea4f854bd350e69446b43bd5`. Task is 54 commits ahead and 62 behind target; its configured upstream is `origin/v3`. | No source commit is waiting to be pushed; this roadmap update remains local. Use the existing checkout, and push explicitly to `origin/activity-info-on-eval` during delivery. Target drift is not task-upstream loss. |
| Package scope      | Target-relative merge-base diff contains 37 files, 3,538 additions and 705 deletions; excluding project documents and generated SDL gives 3,515 substantive changed lines (2,811 additions and 704 deletions).                                                                                                                                                                 | Keep the existing cohesive approved PR. Its size requires a complete integrated review of metadata/UI, HMAC shaping, and aggregation/cache lifecycle. No new stack or decomposition is authorized by this review.      |
| Required CI        | Six required contexts pass: OLAT API, GraphQL, production i18n, unit tests, Gitleaks, and image build. `check` and `test-playwright-status` fail on this exact PR head.                                                                                                                                                                                                        | Passing contexts do not establish whole-package acceptance.                                                                                                                                                            |
| Formatting failure | Check run `35362612797`, job `105662152922`, fails Prettier on `playwright/tests/O1-live-quiz-core.spec.ts`.                                                                                                                                                                                                                                                                   | Run the repository formatter on this file and inspect its complete diff. The failure is not a typecheck diagnosis.                                                                                                     |
| Browser failure    | Run `35362613133`, shard 8 job `105661553707`: 162 tests pass, one fails, 26 do not run. The activation/restart regression fails at O1 line 3308, missing `evaluation-footer-show-solution` after abort, restart, activation and reopening the signed link; retry also fails.                                                                                                  | Reproduce and inspect rendered state, query results and lifecycle before choosing a test or application correction. No proven root cause yet.                                                                          |
| Forge reviews      | All 31 discussion threads are resolved. Two historical changes-requested reviews remain. The `final-ai-review` pending context is stale: run `35362609854` completed, but review/start/finalize jobs were skipped.                                                                                                                                                             | Thread resolution is not reviewer approval; skipped review jobs are not a successful final review.                                                                                                                     |
| PR description     | Body still describes `fec32afea` and its older target, earlier verification, and an old GitGuardian blocker.                                                                                                                                                                                                                                                                   | Replace stale coverage and evidence claims after the corrected integrated package is verified. Current required Gitleaks passes; historical incident disposition is not established by this check.                     |
| Runtime            | Source-bound `devrouter status --repo <exact-path> --json` reports synthetic `trees/pr4920-devsy-browser` as `failed-transition` and manual `trees/activity-info-on-eval` as `drifted`. Both have missing managed services/processes. Owner inventory reports zero exact routes for each.                                                                                      | Neither is a running manual-test environment. Preserve owner records and retained data; no deletion or recreation occurred during this review. Provider shutdown completion remains unverified.                        |
| Toolchain          | The approved task-only installation provides devrouter 0.2.0 at `/private/tmp/pr4920-devrouter-0.2.0.onpjXp/bin/devrouter`, qualified with existing Node 24.21.0. The integrated task repository requires 0.2.0. Global binaries remain unchanged.                                                                                                                             | Tool acquisition is complete. Select the qualified binary through the scoped `PATH` and `KLICKER_DEVROUTER_BIN`; do not change global configuration.                                                                   |
| Native goal        | The goal was marked blocked after three consecutive tool-acquisition blocker turns. Human approval allowed the scoped installation and recovery investigation to continue; the goal tool still reports blocked.                                                                                                                                                                | Preserve the same objective. Do not create a replacement goal or claim completion. Runtime recovery now has different, concrete authority gates below.                                                                 |

### Execution checkpoint — 2026-10-07

- Applied a normal, conflict-free `origin/v3` integration at
  `103255c85db481d9ea4f854bd350e69446b43bd5` with `--no-commit --no-ff`.
  The merge remains pending in `trees/activity-info-on-eval`; no commit or push
  occurred. Inherited target changes remain distinct from task corrections.
- Corrected the reported O1 Prettier failure with one formatting-only hunk.
  The focused repository Prettier check passes. No functional test or application
  correction has been inferred from the timeout alone.
- Added diagnostic contract assertions inside the existing restart regression.
  It now checks publication, the original block's activation response, a changed
  activation timestamp and the same question's presence before reveal controls.
  GET persisted queries and POST operations are both observed. Existing reveal
  expectations and the 500 ms diagnostic journey remain intact. TypeScript
  syntax parsing and Prettier pass; runtime execution remains outstanding.
  Source inspection confirms `useStartLiveQuiz` publishes an optimistic response,
  so cockpit visibility alone cannot prove the restart mutation completed. The
  new response assertion observes server completion; its effect on the CI
  failure still requires a producing browser run.
- CI trace/screenshot artifacts are no longer retained. The failed job log
  confirms the missing controls after restart, but does not establish the failed
  block transition or rendered-state cause. Reproduction remains required.
- Installed approved `@devrouter/cli@0.2.0` only under
  `/private/tmp/pr4920-devrouter-0.2.0.onpjXp`. Its version check qualifies the
  integrated task repository when run with existing Node 24.21.0. Volta 0.1.3
  and the local 0.1.0 installation remain unchanged.
- The supported exact-owner `stop` fails with: `Managed stop requires unchanged
recorded resources and configuration.` The subsequent `ensure --repair`
  fails lifecycle admission because the owner remains `stopping` with desired
  `stopped-by-user`. Both commands terminated; no live stop watcher is waiting.
  The CLI identifies exact-owner deletion as the next recovery branch. That
  deletion/recreation still requires named authority.
- Devsy 1.19.0 reports synthetic owner `rs-pr4920-devsy-browser` as `NotFound`.
  There are zero exact routes, zero containers with the exact source-path label,
  and no containers or volumes labelled with compose project `default-rs-4cec0`.
  This does not prove absence of unlabelled retained data. The synthetic Git
  checkout and diagnostic changes remain intact; manual runtime/data is excluded.
- The pinned CLI doctor also blocks shared capacity admission on
  `journal-entry-unsupported`. The rejected regular file is
  `f254a6019fcc298158687a3f1ccd0c619646ba1f16e847aac41f4d7398b8c989-key-50ca81249fb3430af42c7c4cf132b5aa49f84587e4459d1dd1f300765883fe2a.json`
  under `/Users/roland/.config/devrouter/reliability/`. Values-free inspection
  identifies a completed auxiliary record for `trees/codex/dpo-verification`;
  its separate canonical version-2 journal exists with matching identity.
  Both local 0.1.0 and pinned 0.2.0 accept only 64-hex journal filenames, so this
  is not established as a new-version regression. Doctor prescribes moving the
  unrecognised entry out while preserving contents. No file was moved or edited:
  shared-state repair needs separate authority and must preserve canonical owner
  journals and unrelated runtimes.
- Fresh fetch advances `origin/v3` to
  `bf114e6f247c99cd6fb36a7c0f3e480fe2040d51`. The one new commit changes
  `playwright/global-setup.ts` to derive seeded participant-group codes
  deterministically. The pending merge still records `103255c85d`; account for
  this test-relevant target drift through normal integration before final proof.

The user approved quarantining the exact auxiliary journal above and deleting
and recreating only the synthetic runtime. Both operations completed. The
journal bytes are preserved under
`/private/tmp/pr4920-devrouter-journal-quarantine.QXsFYf/`; its SHA-256 remains
`2a46d6702c10295df1a17f0f0f3d73366900b56d6dc9eb606510ada149800fe0`.
The separate canonical journal remains unchanged. Doctor then identified a
second version-1 DPO auxiliary journal with an `-id-` suffix; that file is
outside the single-file approval and remains untouched. No shared capacity
policy is configured, and supported startup succeeded despite that doctor gap.

Synthetic Git edits were preserved in stash
`f345c0be4cd1d929d8e6a2ebcd65b1dbf6229d12` before source alignment. Do not
apply it wholesale: it includes historical copied source and MCP diagnostics.
The synthetic checkout now holds task head `e84668825c` plus a conflict-free,
uncommitted normal merge of `bf114e6f24` and the task's current regression edits.
The task's pending merge still names `103255c85d`; the deterministic group-code
change is byte-identical to the latest target. Complete the pending integration,
then record latest-target ancestry through a normal merge before publication.

The recreated synthetic owner `rs-pr4920-devsy-browser` started successfully
with the manage profile and no drift. The new primary container is
`2c00b81b326d64d0d600b7349cb5f7d8509d2f9f1676f58431ea4b4926198531`.
The first combined regression run passed 22 aggregation tests but exposed an
unguarded shared Prisma singleton before evaluation setup. An isolated
evaluation run then exposed application seed rows in the suite's empty-database
assumption. Existing guarded cleanup acted only on this newly disposable
synthetic database. Adding `requireDisposableDatabase(prisma)` before the
aggregation suite's first database operation resolves the shared-client issue.
The combined producing run passes all five evaluation and 22 aggregation tests.
Evaluation helper Redis connections still warn about unavailable localhost
ports; the aggregation suite uses the actual `redis_exec` service and passes.

The host browser launch initially refused stale pnpm dependency metadata.
Following the documented warm-tree recovery, supported stop completed and
freed three exact routes, then the filtered frozen host Playwright dependency
install succeeded. No lockfile delta resulted. The full serial Chromium O1
workflow is running through the supported host launcher. Its selected
`live-quiz,manage` startup proves response API readiness and both Hatchet worker
processes. Browser acceptance, remaining container checks/build, integration
commits, final review, push and exact-head CI remain outstanding.
The native goal still reports blocked from the earlier capability failure;
only the product's user control can resume it. Authorized execution continues
without replacing that goal. The original manual runtime/data remains excluded.

The first fresh O1 reproduction passed 13 scenarios and failed the restart
regression; 26 later serial scenarios did not run. Its producing trace shows
`StartLiveQuiz` completing, followed by `DeactivateLiveQuizBlock`, rather than
the intended activation. The cockpit rendered an old active-block control from
Apollo cache before a fresh query returned scheduled blocks. The corrected
journey observes completed restart and fresh scheduled-block query responses,
waits for the play control, then verifies the original block's activation and
new timestamp. It no longer relies on the 500 ms delay. No application repair
is justified by this reproduced test transition.

Expanded rendered-content assertions initially used a missing `.prose` class.
The second run's screenshot and DOM show explanation content and solution
markers visibly rendered; Markdown defaults to `withProse=false`. The assertion
now selects the observed Markdown root inside the explanation notification.
The third full Chromium O1 producing run passes all 40 scenarios in six minutes.
Both task and synthetic copies contain the same focused correction. This proves
the restart journey, rendered reveal persistence, actual submissions, closed
results and the existing responsive/deletion interactions on the integrated
source; it does not establish Firefox/WebKit or full CI coverage.

Host Playwright CI contracts and launcher checks pass. GraphQL generation,
schema drift and typechecks pass in the container. The combined root check was
not successful: host-specific launcher tests need the host CLI, and analytics
lint could not download `jupyter-client` because container DNS resolution for
`files.pythonhosted.org` failed. The independent root typecheck passes all 35
tasks, and the subsequent root lint passes all seven tasks, superseding the
earlier analytics download gap. Focused Prettier checks pass. The root production
build failed because the concurrently running dev server and production build
generated duplicate `PagesPageConfig` types under `.next/dev/types` and
`.next/types`. The next verification stops the exact synthetic managed app group
before isolating generated development output and rerunning the build. This is
a generated-state diagnosis, not an application repair. Remaining host/container
split checks, captures and final review remain outstanding.

The isolated root production build then passes all 23 tasks (15 cached) after
the exact synthetic app group stopped and the five apps' `.next/dev` directories
were moved to recoverable ignored artifacts. No output or source was deleted.
Syncpack, AGENTS.md, retired-document-path and Prisma-sync checks also pass;
host identity and Playwright launcher tests pass all 44 tests. Synthetic runtime
restart and final real-browser captures are the next authorized checks.

The integration preserves upstream's deterministic temporary leaderboard IDs:
the helper and its tests have no task-relative delta, and the merged service
still calls that helper for temporary participants. This static seam inspection
does not replace integrated review or runtime verification.

### Evidence that can be reused

The implementation includes metadata-only signed DRAFT/SCHEDULED evaluation,
identity-only invalid-HMAC rejection, active-block deduplication, unavailable-state
polling handling, enabled/default-off presenter controls, responsive layout and
leaderboard-deletion confirmation. Later aggregation corrections bind work to
block execution/start identity and protect rollback, reactivation and cache
expiry. These are implemented source changes, not a fresh browser verdict.

The recorded 39-test Chromium O1 pass covers `20087b66a`, before the activation
identity extension. The five evaluation and 22 PostgreSQL/Redis aggregation tests
recorded on `39d33ccd48` cover the later API correction. Prior slice reviews remain
useful for unchanged contracts. The final-review report still requires correction
verification for activation-scoped reveal persistence. Current failing CI and
target/runtime changes prevent reusing those historical runs as final acceptance.

### Test portfolio

| Consequential risk                                                               | Test obligation | Existing protection and acceptance seam                                                                                       | Owner  |
| -------------------------------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------ |
| Reveal choices leak between activations or disappear in the same activation      | extend existing | O1 restart regression: actual rendered solution/explanation across polling, question navigation, reload and confirmed restart | Step 3 |
| Signed evaluation exposes unpublished content or accepts an invalid signature    | none            | Reuse the five evaluation regressions plus current signed/authenticated browser proof                                         | Step 3 |
| Delayed aggregation overwrites another execution or loses results during closure | none            | Reuse the 22 PostgreSQL/Redis regressions for identity, rollback and cache expiry                                             | Step 3 |
| Polling/navigation/layout/deletion regresses despite controls appearing correct  | none            | Existing O1 coverage plus explicit interaction, poll completion and responsive browser proof below                            | Step 3 |
| Legacy queued work fails across producer/worker deployment or rollback           | none            | Existing fail-visible payload contract; release transition qualification remains separately gated                             | Step 5 |

The known correction path is `playwright/tests/O1-live-quiz-core.spec.ts`.
If reproduction establishes an application defect, use the affected existing
evaluation components under `apps/frontend-manage/src/components/evaluation/`
or `packages/graphql/src/services/liveQuizzes.ts`; identify the exact file and
failed behavior before editing. Add no production modules, dependencies, schema
migrations or separate suite. Persist the integrated review under
`project/_local/reviews/2026-10-07-pr4920-integrated-final.md`, naming its actual
review date and immutable range if execution occurs later.

### Delegation map

| Step                              | Owner | Dependencies                                                                 | Acceptance                                                                             |
| --------------------------------- | ----- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1: Restart diagnosis              | main  | CI/source evidence; isolated runtime from step 2 when reproduction is needed | Establish failed transition or application defect with exact block/activation evidence |
| 2: Target integration and runtime | main  | Verified task/target and qualified host toolchain                            | Supported startup proves isolated apps, services and workers                           |
| 3: Correction and proof           | main  | Steps 1–2                                                                    | Existing regression, rendered behavior, responsive captures and applicable checks pass |
| 4: Review and publication         | main  | Step 3                                                                       | Complete integrated review and published exact-head CI pass                            |
| 5: Human/release gates            | main  | Step 4 for readiness report; separate authority for live release work        | Report blocking reviews and documented queue/rollback obligations accurately           |

Main retains this tightly coupled diagnosis, integration and final-proof sequence.
No executor is reserved or implicitly authorized to change shared paths.

### Remaining sequence and acceptance

1. **Diagnose the failing restart journey.**
   Capture the failure's selected question/block, publication status, activation
   timestamp, query response and browser screenshot before changing behavior.
   Recover CI trace/screenshot if retained; otherwise reproduce with the same
   serial setup after step 2 establishes the isolated workspace. The current test
   clicks a control that can open, close or end a block and waits 500 ms without
   proving activation. Establish the intended block's active status, non-null
   activation identity and expected instances before interpreting the missing
   reveal control. Do not substitute a longer sleep, another link or a product
   change for that diagnosis. Preserve the restart invariant:
   reveal choices persist within one activation and reset after restart. Initial
   URL flags stay off while active. Inspect actual rendered solution/explanation,
   not switches alone. Acceptance: evidence distinguishes an incomplete test
   transition from an application defect and identifies the smallest correction.
   If CI artifacts have expired, carry that reproduction into steps 2–3 rather
   than blocking independent target/runtime preparation.

2. **Integrate the current target once and establish an isolated test runtime.**
   Main owns both seams. A normal `origin/v3` merge is warranted because this PR
   is behind and upstream changes its runtime/toolchain inputs. Record the target
   SHA; preserve all task and unrelated primary-checkout changes. Inspect the
   upstream leaderboard redesign where it meets evaluation UI, preserving its
   deterministic temporary leaderboard identities. Align the
   synthetic checkout with the intended tested source and account for its local
   diagnostic edits before changing it. Use exact source-bound owner commands
   and first qualify the host binary against the integrated repository's minimum
   devrouter 0.2.0. Inventory exact ownership and supported recovery before
   startup. Complete supported recovery
   without ownership bypass or data deletion. If recreation is required, request
   exact-target/data-loss authority before that branch. Acceptance: a producing
   startup run proves the selected apps plus the general and response-processor
   workers, and synthetic
   test/database isolation is established. Manual retained data remains excluded
   from destructive O1 setup/cleanup.

3. **Correct the established defect and prove the integrated behavior.**
   Main owns final proof; container checks and host browser runs follow the
   repository's launchers. Apply the focused O1 formatting correction. Repair the
   diagnosed transition or application defect without weakening the invariant.
   Extend that existing regression to prove rendered solution and explanation
   content follows the controls across a completed poll and reload in the same
   activation. Another question remains unrevealed; returning to the original
   question preserves its selection. Confirmed reactivation resets both off.
   Preserve closed-block URL precedence and separate results confirmation.
   Run the existing five evaluation and 22 aggregation
   regressions against marked disposable resources, applicable checks/build, and
   the complete serial O1 workflow, including the restart regression. Verify
   signed and authenticated evaluation, real submissions and closed results,
   duplicate-free block tabs, invalid/unpublished payload
   boundaries, default-off/manual reveal, navigation/reload/restart persistence,
   unavailable routes and deletion confirmation reset. Unchanged successful
   polling advances the refresh timestamp; a completed null evaluation stops
   subsequent polls. At 390px, document overflow is at most 1px, controls remain
   reachable and evaluation content is unobscured. Local automated O1 proof is
   Chromium; do not imply Firefox/WebKit coverage without an actual run.
   Use agent-browser for real desktop/mobile captures, with English/German
   variants for changed labels and layout. Record source, viewport, locale and
   interactions in `project/_local/pr4920-browser-verification/index.md`;
   explicitly report any uncovered
   state. Acceptance: relevant automated checks and browser interactions pass on
   the recorded integrated source. Release the synthetic runtime through its
   owner and verify provider stopped plus zero exact routes. Preserve the manual
   runtime/data; restore it only through an authorized supported path.

4. **Complete review and publish the whole verified package.** Main owns delivery.
   Reuse prior reviews where their contract/evidence remains valid. After local
   proof, inspect staged data/secrets and commit the complete integrated state.
   Run one complete integrated review across correctness, HMAC/data exposure,
   aggregation integrity, compatibility and maintainability, including the
   activation correction. Use the existing final reviewer if its lifecycle is
   available; otherwise record that limitation and use one eligible replacement.
   Record the immutable reviewed range and disposition of earlier findings.
   Any subsequent material correction receives affected verification and review
   before delivery. Make the ordinary non-force push to the existing
   PR branch. Refresh the complete PR description and inline screenshot table.
   Read back uploaded captures at the intended audience. After exact-head CI and
   feedback are settled, obtain the repository's actually executed `/final-review`
   result. Require all eight Playwright CI shards, required checks and image
   builds on the published head; a focused O1 pass cannot replace the full suite.
   Monitor each running operation through one supported watcher; the stale
   review context is not a running operation. Acceptance: published head matches
   verified source, all required CI passes and completed final review covers it.

5. **Report the remaining human gate and separate release obligations.** Main
   reports the exact blocking changes-requested review state; the user decides
   reviewer communication and merge authority. Do not reply to old comments or
   request human reviewers. Before deployment, stop further old-format enqueueing
   and drain scheduled, running and retryable execution-less aggregation jobs
   through a compatible old worker. Coordinate producer/worker activation only
   after that condition holds, and qualify rollback compatibility explicitly.
   Retain the existing one-day cache retention and fail-visible legacy-payload
   contract. Queue inspection/draining, rollout and rollback qualification are
   release work requiring their own authority, not accomplished by merging source.
   HMAC secret rotation/design hardening and broader Redis-outage recovery remain
   separate follow-ups unless a reproduced package defect requires a scoped ruling.

### Current review disposition

Execution mode for this review is `standard` because runtime model identity is
not available. Main owns live Git/CI/runtime evidence and roadmap edits. Astra
planner `01a1177b-30c0-7762-9fa9-e7c6c3a3e65e` owns the read-only source/roadmap
challenge. This materially differs from the September review: the activation
extension is implemented, CI now reproduces a restart failure, and the target
and runtime inputs moved. Astra returned **APPROVED** in round 3 after two
correction rounds. All findings were accepted: restart diagnosis, qualified
toolchain, rendered-content proof, explicit owners and observable acceptance,
commit-before-review ordering, full CI and queue/rollback boundaries. The
[review transcript](../_local/reviews/2026-10-07-pr4920-roadmap-plan-hardening.md)
records the scope and dispositions. Approval covers this remaining-work roadmap,
not the current implementation's merge readiness.
No source correction, target merge, runtime mutation, commit or push occurred
in this state-review pass.

## Historical approved follow-up

The user requested usable solution and explanation controls while a block runs,
and resolution of the remaining merge blockers. Active questions initialize both
controls off on their first render regardless of saved closed-block settings or
URL flags. An explicit reveal survives polling and navigation back to the same
running question, but does not carry to another question or newly running block.
Closed-block URL behavior, unpublished-content protection, and the separate
results-confirmation overlay remain unchanged.

Authority: implement, verify, commit and push this package to the existing
[evaluation PR](https://github.com/uzh-bf/klicker-uzh/pull/4920), including one
integration of current `v3` and ordinary/final review handling. Merge, approval,
force-push and deployment remain excluded. Retain the exact activity-info-on-eval
runtime for user testing through the next checkpoint.

Route: the executor owns evaluation UI and existing Playwright expectations;
the main session owns HMAC validation, its regression, upstream integration and
final evidence. The HMAC boundary stays with the main session because it is
security-sensitive. Manage startup feedback is addressed by upstream's profile
guard; verify rather than duplicate it.

Acceptance: active controls are enabled and initially off, actual rendered
solutions and explanations follow manual toggles across polling and navigation,
and closed-block behavior still works. Invalid HMAC requests perform only an
identity lookup and never load evaluation relations or cache results. Valid signed
DRAFT/SCHEDULED requests retain metadata-only responses. Tests use a restored,
synthetic APP_SECRET. Run focused GraphQL and host Playwright/browser checks,
applicable package checks and full build in the managed container, then slice
simplification and security review, integrated final review and current-head CI.
Stop only at a real capability, authority or semantic conflict boundary.

The older scope below records the original pre-start fix. This follow-up
supersedes its no-UI-change restriction. The later approved activation extension
adds a nullable GraphQL field and a separate operation; no Prisma migration,
dependencies, production data or authorization model is introduced.

Progress: the worktree was fast-forwarded to the pushed head `6484e56bc6`.
The old runtime lacks devrouter's required waitFor configuration, so the single
authorized v3 integration precedes runtime verification. The sole startup-script
conflict retains the working /AddResponse endpoint and upstream GrowthBook host.
The planner's five findings were accepted: explicit reveal-state lifetime,
updated behavioral Playwright coverage, query-order regression, full warmup
guard verification, and the existing review gates.

Planner: APPROVED after accepting the five findings and preserving upstream's
course-visibility filter. The optional Gemini challenge confirmed the need to
define active-to-closed precedence; use existing closed-state behavior. Its URL
rewriting, pre-lookup HMAC validation and narrower metadata proposals are rejected:
URL flags remain meaningful for closed blocks, signing requires the stored
namespace, and activity/course metadata is the explicitly approved feature.
No new rate-limiting layer is part of this bounded correction.

Verification checkpoint (2026-09-06): the authorized integration is committed
as `21f05ef5c`. Root `check:all` and the full build pass in the exact managed
container. The isolated evaluation GraphQL suite passes all five tests, including
invalid-HMAC lookup order and DRAFT/SCHEDULED signed metadata. Redis connection
warnings remain in that mocked-cache suite; this is not response-processing proof.
Browser screenshots confirm enabled, default-off active controls even with both
URL flags true, actual rendered solution/explanation after manual reveal, and
preserved selections after reload. Closed-block manual reveal also works.
The obsolete active-block disabled assertions now check enabled controls,
manual selections, reload persistence and hiding again. The serial Playwright
workflow remains CI-only because its cleanup would erase the retained manual-test
database. Independent reviews and publication are still pending. Keep the exact
activity-info-on-eval runtime running for user testing.

## Goal

Show the LiveQuiz name, publication status, and course name on a valid signed
evaluation embed before the quiz starts, using the existing unavailable-state
notification.

## Non-goals

- Do not expose ElementInstance content, choices, explanations, feedback, or
  result data before publication.
- Do not change evaluation behavior after publication or ending.
- Do not add UI strings, schema fields, persisted operations, seeds, or
  database changes.

## Design

- Domain: `LiveQuiz` activity metadata is safe to display; `ElementInstance`
  snapshots and evaluation results remain unavailable while the activity has a
  non-published `PublicationStatus`.
- Layers: change only `packages/graphql` service behavior and its focused
  service test. The existing `frontend-manage` query and
  `EvaluationUnavailableNotification` already render the returned metadata.
- Auth: the public embed path still requires the existing HMAC over the
  LiveQuiz namespace and id. Invalid or absent credentials continue to return
  `null`; authenticated no-HMAC reads keep their existing READ permission
  check.
- Payload boundary: for a valid HMAC and a DRAFT or SCHEDULED LiveQuiz, return
  activity/course/status metadata with `results: []`. Do not compute or return
  block or element evaluation data.
- Gamification: no impact. Leaderboards, points, and XP are unchanged.
- Async: no impact. Publication scheduling and Hatchet workers are unchanged.
- UI/i18n: no component or translation changes; the existing unavailable state
  is populated by the newly available metadata.
- Fixtures: use the existing seeded draft LiveQuiz in the GraphQL service test
  and the existing local Calendar Live Quiz 2 for browser verification.

## Slices

1. Change the existing draft-HMAC regression to require safe metadata and an
   empty result list.
2. Confirm the test fails against the current status-filtered query.
3. Load the LiveQuiz before status filtering, validate the HMAC, and suppress
   all evaluation results for signed non-published requests.
4. Run the focused GraphQL test/check and repeat the signed browser flow before
   starting the quiz.

## Progress

- 2026-09-18 takeover verification: the synthetic pr4920-devsy-browser runtime
  still refuses managed stop and ensure without a configuration or recreation
  decision, so verification moved to the retained activity-info-on-eval
  runtime. It came up ready under host devrouter 0.0.77 and serves manage and
  pwa over its existing local CA. The activation fix is committed as
  `39d33ccd48` after code generation, 5/5 evaluation and 22/22 aggregation
  vitest suites, both run against a separately provisioned disposable Postgres
  (throwaway container pr4920-pgtest, CI provisioning and guarded-reset paths),
  so the retained manual fixtures in the container database stay untouched.
  Root `check:all` reports 34/35 tasks and fails only on `graphql:check`, which
  compares the committed SDL and therefore needs the commit above. Current-v3
  integration, browser acceptance, publication and exact-head CI remain
  outstanding. Original manual runtime untouched.

- 2026-09-08 ownership recovery: user explicitly approved a narrow retained
  runtime metadata repair preserving containers and data. Validated all eight
  synthetic containers under default-rs-4cec0 and the primary's exact source
  bind mount; recorded default-rs-5a4a0 had no containers. Backed up the exact
  workspace record outside the repository and changed only composeProject.
  Guarded managed stop then succeeded. Independent Devsy status is Stopped
  with zero exact routes. Both normal ensure and ensure --repair now stop at
  "Managed Compose configuration changed for service 'app'". Latest v3 also
  changes PostgreSQL bootstrap to marked disposable databases. Do not alter
  fingerprints to mask that configuration change. Fresh synthetic runtime/data
  recreation requires explicit approval; source, worktrees and original manual
  runtime remain untouched. No tests, commit or push in this recovery step.

- 2026-09-08 latest-v3 continuation: user explicitly requested current target
  integration. Merged origin/v3 at 1a270f33053e12d56df6e4536133753edcaae636
  into the delivery branch as 5be417545d and independently into the synthetic
  verification branch. Both checkouts now pin devrouter 0.0.59, matching the
  installed host CLI. All local changes were restored without conflicts from
  retained safety stashes 1c58cf439d4ebb75bf348f2336fb207256cbcd8b and
  ad6aa89c54068886bb901d08cf260040d2e53cc6, respectively. Diff checks pass;
  delivery is 50 ahead and zero behind origin/v3. Integration hooks were
  disabled because toolchain checks belong in the container and remain pending.
  Updated managed stop still refuses complete retained service-population proof;
  ensure --repair returns "Lifecycle transition is blocked". No ownership
  bypass, deletion, push, PR merge or manual-runtime operation occurred.
  Runtime reconciliation remains the prerequisite for browser verification.

- 2026-09-08 approved recreation checkpoint: exact deletion of the synthetic
  trees/pr4920-devsy-browser runtime succeeded. Independent Devsy lookup then
  reported not found and the exact-source route count was zero; Git was retained.
  Mirrored the activation correction and inspected the executor's browser test.
  Fresh startup passed MCP ownership validation and generated the new nullable
  startedAt SDL field, copied byte-for-byte to the delivery worktree. No lockfile
  drift appeared. Startup began with host devrouter 0.0.57; the host installation
  changed to 0.0.59 during the run without this task modifying it. Startup ended
  with "Lifecycle worker completion is unknown". Current doctor reports a
  degraded process-start transition and foreign managed containers. Exact stop
  refused with "Managed stop cannot prove the complete retained service
  population". Independent Devsy status reports Running and zero exact routes;
  runtime release is blocked, not verified. No ownership bypass, second deletion,
  manual-runtime change, commit or push occurred. Browser and package checks
  remain unrun. Restore supported devrouter ownership reconciliation before
  resuming checks, same-reviewer correction and publication. Fresh target refs
  place audit-pr4920-merge, tracking origin/v3, 49 ahead and 10 behind v3.

- 2026-09-07 restart correction checkpoint: local source now exposes nullable
  StackEvaluation.startedAt and selects it through the new
  GetLiveQuizEvaluationWithActivation operation. Both active reveal storage
  keys include that timestamp. The original query and shared fragment remain
  unchanged for persisted-query compatibility. The existing service regression
  asserts the activation timestamp. Code generation, package checks, browser
  execution and reviewer correction remain pending; no commit or push occurred.
  Canonical ensure of trees/pr4920-devsy-browser failed at the local MCP fixture
  ownership-validation guard following prior test cleanup. No guard bypass or
  data repair was attempted. Exact managed stop succeeded; independent Devsy
  status is Stopped and the exact-source route count is zero. Original manual
  runtime remains untouched. Renewed exact synthetic-runtime deletion and
  recreation approval is needed before managed verification can continue.

- 2026-09-07 activation-identity extension approved: the user approved the
  narrow read-only evaluation API addition, regression tests, browser proof,
  same-reviewer correction pass and ordinary task-branch push. This supersedes
  the earlier no-new-schema restriction only for the block activation timestamp
  and its newly named client query. No database migration or authorization
  change is introduced. Keep the original persisted operation unchanged.
  The final reviewer withdrew its closure-timestamp payload finding after
  confirming that supported transitions cannot change closure time while
  preserving execution and activation time. No extra closure change is needed.
  Main owns API/UI integration and runtime verification; the executor owns the
  existing O1 restart regression. Fresh refs leave the task 49 ahead and nine
  behind origin/v3; reviewed upstream hunks remain disjoint.

- 2026-09-07 integrated review checkpoint: committed head `96ebf221de` has
  unchanged executable source from the passing browser run. The native final
  reviewer found a confirmed restart bug: active reveal storage keys contain
  activity, block and question, but no activation identity. The evaluation API
  does not expose that identity. A reliable fix needs a narrow API-field addition
  outside the approved no-new-schema constraint; user ruling is required.
  The reviewer also proposed a closure timestamp in delayed payloads. Main is
  checking that claim against the approved execution/start ownership contract;
  no supported same-identity closure rewrite has been established. The same
  reviewer `01a07d9f-a93f-7682-8288-597523157d73` is active on that clarification.
  Its report is project/\_local/reviews/2026-09-07-pr4920-integrated-final.md.
  Upstream overlap review found disjoint hunks, not a new integration blocker.
  No push or PR-body update occurred. Existing synthetic runtime remains stopped;
  no runtime was touched in this continuation. Original manual runtime untouched.
  Next: obtain the narrow API ruling, fix restart persistence, rerun affected
  checks and browser regression, then the same reviewer's correction pass and
  authorized publication. Keep the two MCP diagnostics outside delivery.

- 2026-09-07 delivery continuation: the implementation head is
  `20087b66a04320caedb5870339dd95fd11636bdb`. Fresh origin refs place the task
  branch 48 commits ahead and nine behind its upstream and resolved target v3.
  The 22-test aggregation and 39-test browser evidence below covers this source.
  Local MCP stage-label diagnostics are outside this evaluation delivery and
  remain unstaged. Main owns integration and publication; a bounded read-only
  explorer checks upstream overlap, and the integrated final reviewer owns the
  remaining independent package review. No merge or deployment is authorized.

- 2026-09-07 fresh-runtime verification: the user explicitly approved deletion
  and recreation of only trees/pr4920-devsy-browser. Exact owner deletion
  succeeded; Devsy then reported workspace not found and route count zero.
  Git worktree and source changes remained intact. Canonical host Playwright
  launcher recreated the same workspace using devrouter 0.0.57. Fresh MCP
  ownership validation succeeded without guard changes. Startup repaired its
  stale chat cache through the repository's existing bounded repair path.
  All 39 Chromium O1 tests passed in 5.0 minutes, including the formerly failing
  cockpit start/abort/restart, real student submissions, mobile evaluation,
  signed embeds, results, closed solutions, duplication and deletion.
  Verified backend files match committed 20087b66a04320caedb5870339dd95fd11636bdb
  byte-for-byte. No lockfile or public-schema drift appeared. Exact synthetic
  stop completed after the final browser check; Devsy independently reports
  Stopped and exact-source route count is zero. Data preserved. Original manual
  runtime untouched. This supersedes the preceding runtime/browser blocker.
  Integrated review, publication and exact-head CI remain outstanding.

- 2026-09-07 recovery continuation: fetched refs; task is 48 ahead and seven
  behind v3, with PR head still fec32afea and mergeable. Explicit manage-profile
  startup replayed the recorded full profile and failed at MCP ownership
  validation before diagnostic access. Doctor confirms process-start degraded
  state; stop preserves that degraded transition even while all exact services
  and processes are stopped. No supported exec recovery option is exposed.
  Ownership guard and devrouter state were not bypassed or edited. Repeated
  startup cannot resolve the fixture through the managed interface. Exact stop
  completed; provider and route verification performed. A supported devrouter
  diagnostic recovery path is needed before another synthetic fixture repair.
  No source changes, push, merge or deployment in this continuation.

- 2026-09-07 terminal runtime blocker: synthetic stop completed and Devsy
  independently reported Stopped; the owner freed ten routes. Canonical browser
  restart then failed before tests: local MCP seed repair refused ownership
  validation, and managed post-start left degraded process drift. A read-only
  dry-run diagnostic through devrouter exec was rejected with Lifecycle
  transition is blocked. Final synthetic stop completed; Devsy independently
  reports Stopped and the exact-source route inventory is empty. No deletion.
  Browser cleanup and MCP seed ownership need a compatible runtime recovery
  path before another O1 run. Do not bypass the ownership guard. Correction
  `20087b66a04320caedb5870339dd95fd11636bdb` remains local with 22 passing tests;
  no push, final-review completion, merge or deployment. Original manual runtime
  untouched. Two local MCP diagnostic edits remain unstaged and outside delivery.

- 2026-09-07 current checkpoint: closure/end race correction is committed as
  `20087b66a`; 22 aggregation tests, formatting, GraphQL typecheck and staged
  gitleaks pass. No push occurred. Fresh O1 browser verification stopped at
  seven passing tests, one failure and 31 unrun tests. The screenshot shows
  cockpit 404; the manage log reports PageNotFoundError/ENOENT for the dynamic
  cockpit page. This is missing page-module evidence, not a selector failure.
  Managed repair refuses because the runtime is not recorded degraded.
  Exact synthetic-runtime stop requested to clear stale process state without
  deleting data. Next: complete stop, restart exact workspace, rerun O1, release
  synthetic runtime, finish required review and publish. Retained manual runtime
  untouched. Independent slice reviewer found the end race after its correction
  pass; reassess recovery scope before further review loops. Its report and the
  simplifier result are saved under project/\_local/reviews. Both children closed.

- 2026-09-07 restored-runtime checkpoint: managed stop reconciled three stale
  synthetic routes, then manage ensure succeeded without recreation using host
  devrouter 0.0.57. The rollback/historical-cache correction is committed at
  `7627f6465ff5b7e1819be3465af59e4a35e5ca5b`. Its 21 aggregation tests, GraphQL
  check, root 35-task check, seven-task lint, syncpack and 23-task full build
  passed. Existing build warnings remain. Correctness review accepted the
  original fixes but identified a concurrent end-of-quiz closure race; the
  minimal follow-up permits ENDED with unchanged block identity and suppresses
  stale running-state publication. All 22 aggregation tests, formatting and
  GraphQL check pass with that follow-up. The independent thirteen-file
  simplifier found no justified reduction. Reports are in project/\_local/reviews.
  The approved exact synthetic MCP fixture restoration passed its dry-run and
  ownership guards; no real data or global configuration changed. A fresh
  39-test host Chromium O1 run is active on the corrected source. Runtime release,
  remaining review gates, final publication and exact-head CI remain pending.
  Original manual-testing runtime remains untouched. This entry supersedes the
  stale Docker-unavailable and 20-pass/one-failure checkpoint below.

- 2026-09-07 rollback and historical-cache correction checkpoint: resumed the
  existing Luna correctness reviewer and verified both findings. Two new real
  PostgreSQL/Redis regressions initially fail with the previous 14 tests passing.
  Local source now commits activation/closure before a second parent-locked,
  identity-checked cache phase, avoiding Redis writes for rolled-back identities.
  Rollback, second-phase failure and intervening activation tests pass; GraphQL
  typechecking passes for that correction. Historical cache may be absent only
  when its complete block namespace is absent; target and surviving cache stay
  strict. Main corrected the executor's indexing defect and changed the Lua
  absence check to inspect the whole historical namespace atomically. The worker
  is closed. Final combined source is mirrored into trees/pr4920-devsy-browser.
  The last completed suite had 20 passing tests and one indexing failure before
  those final corrections; this is not a green result. Final format/test/check
  invocation could not start: Docker daemon unavailable at the OrbStack socket.
  No final formatting, final regression proof, correction review, commit, push,
  CI or merge occurred. Existing MCP diagnostics and other dirty files preserved.
  Synthetic workspace had resumed successfully under manage profile without
  recreation; shutdown requested after Docker became unreachable. Runtime release
  remains unverified until owner stop and independent provider/route checks work.
  Original retained manual-testing runtime untouched. Next: restore host Docker,
  finish exact-source formatting and regressions, review failure recovery and
  second-phase races, then applicable independent reviews and publication gates.
  Task branch audit-pr4920-merge remains at a9e1cccbf8, tracking origin/v3,
  46 ahead and 4 behind fetched target; PR remote remains fec32afea6.

- 2026-09-07 verification rerun: all 39 Chromium O1 live-quiz tests pass
  in 4.9 minutes on the exact synthetic Devsy workspace. This supersedes the
  earlier 38-pass result and verifies the corrected deletion helper, required
  leaderboard confirmation and reset, active reveal controls, signed embeds,
  response lifecycle, closed-block solutions and 390px overflow checks.
  The current manage typecheck, focused Prettier and navigation Biome checks
  pass. Main and synthetic UI/test files match byte-for-byte. The host launcher
  selects devrouter 0.0.55 and its isolated host browser toolchain; changing
  the outer Volta Node selection resolved a different incompatible devrouter,
  so the previously verified launcher path was retained. Startup emits existing
  build warnings; the separate manage typecheck passes.
  The user approved Luna max for the independent aggregation correctness review.
  Generic-continuity reviewer `01a07c9b-b3cb-7a12-935c-9c484885294a` remains active
  on the committed seven-file aggregation slice. The configured Combo credit
  failure is not treated as recovered. Synthetic shutdown has been requested
  after the successful suite. Devsy now reports Stopped and the independent
  exact-source route inventory contains zero routes. Data is preserved.
  The verified UI/deletion follow-up is committed as
  `a9e1cccbf822a5049256363aa6c69acf52272f1d`; staged secret scan and diff inspection
  pass. Host hooks were disabled because checks ran in the managed container.
  Its applicable reviews, integrated final review, push
  and current-head CI remain pending. No merge or deployment is authorized.

- 2026-09-07 browser and aggregation follow-up: delayed aggregation is committed
  locally as `c7d9053fc06985a8df5d0ba8b38fde780ae55277`. The independent simplifier
  completed with no justified simplification. Correctness review is still
  pending: the configured provider returned an insufficient-credit error, and
  the proposed Luna review-model substitution awaits the user's ruling.
  Nothing was pushed or merged.
  The fresh synthetic O1 browser run passes 38 of 39 tests, including signed
  embeds, live submissions, evaluation contents, active reveal controls,
  reload persistence, 390px horizontal overflow and closed-block solutions.
  The final deletion test now proves leaderboard confirmation is required
  and reset on reopening. Its later duplicate-quiz deletion fails because an
  immediate visibility check runs before the summary dialog mounts. The helper
  now awaits that dialog and uses its structured confirmation selector instead
  of a prose assertion and XPath fallback. This latest correction needs a rerun.
  A separate intervening run stopped at a stale manage cockpit route; the
  documented managed repair restored it before the 38-pass run.
  Manual delegated login succeeds. Desktop evaluation displays nonempty results
  and exactly two block tabs. A fresh 390px screenshot exposed the fixed-height
  navigation wrapper overlapping the question/chart; it now grows on mobile,
  preserving the desktop height. The corrected screenshot shows the question
  and chart unobscured, with viewport and document both 390px wide. The result
  panels remain scrollable above the footer. Evidence is retained at
  `/private/tmp/pr4920-evaluation-desktop-final.png`,
  `/private/tmp/pr4920-evaluation-mobile-final.png` (before), and
  `/private/tmp/pr4920-evaluation-mobile-fixed.png` (after).
  The latest helper and navigation fixes remain uncommitted and require focused
  checks, the full browser rerun and applicable reviews before publication.
  The focused container check and guarded fixture restoration could not start:
  the automatic permission reviewer timed out on the initial command and its
  single permitted retry. This is a host capability blocker, not a test failure.
  No fourth O1 run started. The manual browser session is closed. Synthetic
  runtime shutdown also failed to start: the automatic permission reviewer
  timed out on both the initial owner command and its one permitted retry.
  Read-only Devsy status reports `rs-pr4920-devsy-browser` as `Running`.
  Route inventory is unverified because the host route-update lock identity
  check failed. Shutdown remains required once host approval capability works;
  no raw Docker or Devsy mutation was substituted. The original manual-testing
  runtime is untouched. Resume with the exact synthetic source path, finish
  checks and browser rerun, then stop and independently verify provider state
  and zero routes. Data and worktrees are preserved.

- 2026-09-07 approved alternate synthetic PIN: the logging-only dry run
  passes with an unused PIN selected from a bounded test range. The guarded
  write transaction commits one course, one chatbot, its canonical disclaimer
  and two MCP configurations. Existing records are untouched and the ownership
  guard passes against the inserted relationships before commit. Managed
  startup passes MCP seed repair and starts `klicker-local-mcp`. The producing
  `ensure --repair --json` exits successfully with managed status `ready`, full
  active profile, healthy services, both managed processes running, no drift
  and no recreation. Response API readiness returns HTTP 200, and both Hatchet
  workers are observed live. This is startup proof, not complete evaluation
  browser acceptance. The repair script stays
  ignored and refuses a second insertion if these parent records exist.
  A fresh isolated agent-browser session opens the routed lecturer URL and
  renders the authentication page without a certificate or route error.
  Screenshot: `/private/tmp/pr4920-restored-runtime.png`. This smoke check
  does not exercise login, evaluation controls, or the full serial O1 suite.
  After the smoke check, managed stop frees ten routes. Independent Devsy
  status confirms `rs-pr4920-devsy-browser` is `Stopped`; exact-checkout route
  count is zero. Repaired data is retained, and the original manual-testing
  runtime remains untouched. No commit, push, merge, or deployment occurred.

- 2026-09-07 expanded synthetic restoration: the user approved restoring the
  exact seeded course, chatbot and two MCP configurations. The canonical
  chatbot disclaimer is also absent and was included as its required seed
  dependency. The logging-only preflight passes. The write transaction fails
  on `Course_pinCode_key` (SQLSTATE `23505`) and rolls back every insert,
  including the disclaimer. No existing record was updated or deleted.
  The seed PIN is already assigned to another course. Do not overwrite that
  course or substitute a different PIN without a user ruling. Browser startup
  remains blocked by the incomplete synthetic fixture. The integrated source
  remains at `50f5278f93`; refreshed `origin/v3` has one additional CI-only
  credential-separation commit (`2b8e6716fc`), not integrated again.
  The exact synthetic checkout was stopped through devrouter; independent
  Devsy status reports `Stopped` for `rs-pr4920-devsy-browser` and route
  inventory reports zero exact routes. Data is retained. The original
  activity-info-on-eval runtime is untouched under its keep-running ruling.

- 2026-09-07 approved MCP relationship restoration: the guarded dry run
  refuses to write because the canonical synthetic chatbot and its course
  are both absent; the synthetic owner exists. No database writes occurred.
  Restoring only two MCP configurations cannot satisfy the missing foreign
  keys. Repair now requires restoring the exact seeded course and chatbot
  as well as their MCP configurations, outside the approved relationship-only
  change. The dry-run script stays ignored in the synthetic checkout at
  `project/_local/mcp-repair.mjs`. Do not run a broad reset or reseed.

- 2026-09-07 MCP diagnosis: safe constant stage labels isolate managed startup
  failure to seed ownership validation. A read-only query of the identified
  synthetic KB server confirms its expected local URL, active state, chatbot
  ID forwarding, default header and legacy authentication/parameters, but
  finds zero linked ChatbotMCPConfig records. The guard requires two, for
  tutor and explainer, so startup rejects this incomplete seed. The reason
  those records are absent remains unverified. No database repair occurred.
  Both diagnostic files pass syntax and formatting checks; edits are local.
  Restore the missing synthetic fixture relationships before retrying startup;
  do not weaken the ownership guard or reset the retained manual-test data.
  Exact synthetic workspace `rs-pr4920-devsy-browser` is verified Stopped
  with zero matching routes after diagnosis. Original runtime is untouched.

- 2026-09-07 target integration: the user requested the latest target branch.
  The live evaluation PR still targets `v3`. Fetched tip `65ae8a3523` was merged
  once into `audit-pr4920-merge` as `50f5278f93`, with no conflicts and all local
  evaluation changes preserved. The synthetic verification branch was
  fast-forwarded to the same commit. Host Git hooks were disabled for this
  integration because the equivalent checks must run in the container.
  Managed startup refuses a scoped profile while the old state is degraded.
  Canonical repair now fails at upstream's authenticated local MCP fixture
  startup, before application readiness. Post-integration frozen installation,
  full build (23 tasks), GraphQL/manage type checks and all 14 real aggregation
  regressions pass. Root check:all cannot run unchanged inside the container:
  upstream's Playwright profile contract requires the host Devrouter binary.
  Split execution passes all 35 container tasks, 24 host runner/profile tests,
  and 62 CI contract tests on the host. Existing focused formatting proof is
  unchanged; git diff --check passes. Browser acceptance and independent
  reviews remain pending. No push or PR mutation occurred.
  Managed stop completed for the exact synthetic checkout; Devsy reports
  `Stopped` and the route inventory contains zero source-path matches.
  Original manual-testing runtime and all data remain untouched.

- 2026-09-07 aggregation implementation checkpoint: source changes remain
  uncommitted on `audit-pr4920-merge` at `fec32afea6`. Task payloads now carry
  execution and activation time. Immediate closure and activation hold the
  parent quiz lock through awaited cache writes. Delayed aggregation selects
  the matching executed block without disconnecting a newer active block or
  changing its closure time. Assessment responses remain cumulative within
  the matching execution. Cache expiry follows a successful persistence
  transaction, rereads the original ownership snapshot, and atomically checks
  cache metadata before applying the existing one-day retention.
  Reactivation clears the old closure cache marker, which response workers
  otherwise use to reject submissions. Whole-quiz expiry is skipped while a
  block is active. Legacy jobs without execution identity fail visibly; the
  approved old-worker queue-drain prerequisite remains mandatory before release.
  No live queue inspection, replay, deployment or comment reply occurred.
  The exact synthetic verification checkout is `trees/pr4920-devsy-browser`,
  workspace `rs-pr4920-devsy-browser`. Its 14 real PostgreSQL/Redis tests pass,
  including stale ownership before and between transactions, partial cache,
  failed persistence, cumulative assessment responses, atomic expiry, and
  reactivation. Each test removes only its own synthetic rows and cache keys.
  Shared-package builds and the GraphQL check passed. The full build passed
  all 23 tasks, and root check:all passed all 35 tasks. A separate Biome
  formatting check passed for the six changed TypeScript files; the 14-test
  service suite passed again against rebuilt packages at 13:45 UTC.
  Full browser verification remains blocked:
  published devrouter 0.0.55 repair still reports preparation left running
  children, although container commands work. Do not treat these service tests
  as browser proof or as a completed independent review. Complete the remaining
  gates before commit and publication; merge remains excluded.
  At this checkpoint, managed stop completed for the exact fresh checkout.
  Devsy reports `rs-pr4920-devsy-browser` as `Stopped`, and the independent
  route inventory contains zero routes for its source path. Data and worktrees
  are preserved. The original activity-info-on-eval runtime remains untouched
  under the user's keep-running instruction.

- 2026-09-07 execution approval: the user accepted proceeding after the
  planner round limit with both documented corrections. Implement the
  aggregation contract in the local review report, including serialized
  closure timestamps and cumulative same-execution assessment responses.
  This is human approval with documented planner dissent, not a passed
  planner verdict. Main owns the coupled database/cache lifecycle changes
  and regression proof; the executor owns only payload/type wiring and its
  existing callers. Deployment and live queues remain outside authority.
- 2026-09-07 aggregation compatibility ruling: the user approved requiring
  existing queued aggregation jobs to finish under the old worker before
  deploying the updated producer and worker. This is a release prerequisite,
  not evidence that queues have drained or authority to inspect or change
  live queues. Source implementation and verification remain authorized;
  deployment remains excluded. Unexpected execution-less payloads must fail
  visibly rather than silently skip assessment aggregation. Preserve the
  existing one-day cache expiry and bind new work to the originating block
  execution. The revised aggregation contract reached the three-round planner
  limit without approval (`review_deadlock`). The remaining corrections are
  locking the closure's cache timestamp write and explicitly preserving
  cumulative assessment responses within a single execution. The complete
  findings and accepted corrections are recorded in
  `project/_local/reviews/2026-09-07-pr4920-aggregation-plan-hardening.md`.
  The later execution approval above resolves the review-limit decision.
  The UI-only approval and existing local patches remain valid. The task
  branch remains `audit-pr4920-merge`, tracking `origin/v3`, now 43 commits
  ahead and 8 behind it after fetching; no further integration was made.
- 2026-09-07 verification checkpoint: the missing leaderboard-deletion
  confirmation and cancellation/reopen regression are implemented locally.
  The exact modal and O1 test changes are mirrored into the fresh verification
  checkout. Its Playwright package TypeScript check and Prettier check pass;
  the O1 spec uses `@ts-nocheck`, so the package check does not prove that
  spec's types. `git diff --check` passes.
  Main added the 390px document-overflow and reveal-control regression to O1;
  its formatting passes, but browser execution remains blocked. The responsive
  executor was closed after failing to produce a patch following its narrowing
  checkpoint. Main implemented the bounded navigation/footer wrapping,
  minimum-width containment, and mobile chart/sidebar stacking in eight
  evaluation components. The exact mirrored source passes Biome formatting
  and the manage TypeScript check. All follow-up edits remain uncommitted and
  unpushed pending browser acceptance and the existing review gates.
  These static checks do not replace the blocked full browser run.
  The PR remains open at `fec32afea60b8b0a9741db58f3967adafd69c132`, mergeable
  but blocked with changes requested. The task branch tracks `origin/v3` and
  stands 43 commits ahead and 7 behind it; no further integration was made.
  Managed stop completed for the fresh verification checkout and the exact
  Devsy workspace `rs-pr4920-devsy-browser` reports `Stopped`. Data and both
  worktrees are preserved. The independent route inventory contains zero
  routes for that exact checkout.
- 2026-09-07 follow-up: user approved completing the browser-discovered
  deletion and responsive-layout defects. Source and remote PR head are
  `fec32afea60b8b0a9741db58f3967adafd69c132`. Current CI tests and final AI
  review pass; GitGuardian fails and GitHub still reports changes requested.
  The fresh synthetic Devsy browser evidence is retained locally at
  `/private/tmp/pr4920-devsy-verification.md`; it proves the core evaluation
  lifecycle but records a failed final deletion and 764px document width at
  a 390px viewport. Earlier statements that browser proof remained wholly
  pending are superseded by that evidence.
  The planner approved the UI-only follow-up: restore the existing leaderboard
  confirmation and extend O1 behavior checks; make evaluation navigation,
  panels and footer usable at 390px while preserving desktop behavior.
  Executors own the separate modal/test and evaluation-component paths;
  main owns integration and container/browser verification. No new dependency,
  schema, authorization or product primitive is introduced. Existing deletion
  confirmation and evaluation presentation semantics are reused.
  Follow-up acceptance requires a green serial O1 run, confirmation reset on
  reopening the dialog, no document overflow at 390px, reachable controls and
  preserved desktop layout. Keep the existing commit and review gates.
  At that checkpoint, aggregation remained unimplemented: execution-less queued assessment jobs
  cannot reliably distinguish an aborted/restarted execution. Dropping those
  jobs would skip their final aggregation and needs an explicit compatibility
  ruling. The later queue-drain ruling above supersedes this decision blocker.
  The exact fresh verification workspace is
  `/Volumes/HOME/Git/klicker/klicker-uzh/trees/pr4920-devsy-browser`.
  Both managed startup and one supported repair failed because preparation
  left running children; container commands still work. No upstream integration,
  push, merge, deployment or comment replies are part of this checkpoint.
- 2026-09-06 follow-up: the exact retained activity-info-on-eval runtime
  recovered through the published devrouter 0.0.55 `ensure --repair` command.
  The producing run reported ready, no drift and no recreation. The manage
  route returned HTTP 200 using the existing local CA. Keep it running for
  manual testing. A separate devrouter worktree at
  `/Volumes/HOME/Git/personal/devrouter/trees/preparation-child-reaping`
  contains an uncommitted bounded child-drain fix: the Linux regression suite
  passes with the patch and fails against published 0.0.55 at the new transient
  child test. Final cleanup, review and publication remain pending because the
  automatic permission reviewer timed out twice on the separate-worktree edit.
  The user subsequently confirmed evaluation works and requested that the
  separate devrouter repair move to its own task. That repair does not block
  this evaluation PR; the retained runtime is recovered using published 0.0.55.
  Evaluation publication is authorized, with final review and exact-head CI
  still required before reporting merge readiness. Do not merge the PR.
- 2026-08-26: Reproduced the missing metadata on Calendar Live Quiz 2 and
  captured the pre-fix screenshot.
- 2026-08-26: Traced the null payload to the HMAC-only PUBLISHED/ENDED Prisma
  filter in `getLiveQuizEvaluation`; confirmed the frontend needs no change.
- 2026-08-26: Added the metadata-only HMAC regression and confirmed it fails
  against the previous status-filtered lookup (`null` instead of metadata).
- 2026-08-26: Updated the service to validate the HMAC and return early with
  `results: []` for non-published signed requests.
- 2026-08-26: Focused GraphQL evaluation suite passes (4/4), GraphQL package
  check and build pass, and the signed browser view shows the Draft activity,
  course, and status metadata while retaining the unavailable notice.
