# Account creation and production Playwright coverage — PR #5857

## Approval summary

Protect participant registration and synthetic LTI account handoffs with browser tests against actual production Webpack artifacts. Existing Turbopack test builds cannot prove the production translation-context boundary. Require working account creation, captured local activation mail, activation, ordinary login, authenticated reload, and verified LTI identity transitions. CI must enforce execution before candidate promotion.

The user approved this outcome and transferred execution through the account-creation production Playwright handoff on 2026-09-09. Approval includes isolated local verification, reviews, commits, ordinary task-branch pushes, and one coherent draft PR. It excludes merges, deployments, production writes, external email, tunnel setup, network cleanup, and broad configuration changes. The translation-context source fix remains owned by its separate task.

Completion requires an empirically broken production build failing the new regression smoke, the corrected build passing under equivalent configuration, passing real account journeys, and CI enforcement. Cross-site cookie-policy matrices, a full mock LMS, and Assessment runtime proof are deferred. There is no new approval request.

## Execution details

Authority: execute the approved tests and CI package through a coherent draft PR.
Terminal: verified production regression coverage, applicable reviews, ordinary push, and draft PR.
Boundary owner: self.
Pause: unavailable isolated runtime, unresolved application-source contract, or a new authority/data/cost boundary.

Branch: `rs/account-creation-production-e2e`; target and initial upstream: `origin/v3`.
Source dependency now integrated through authorized fast-forward to `575d32444659ec2b10d42139126931f4ab8479a5`. The source repair merged in PR [#5854, translation-context repair](https://github.com/uzh-bf/klicker-uzh/pull/5854). The account draft PR now targets `v3`; integrate that squash result once to remove misleading dependency history before delivery.
Baseline: `cbcede79718e8e60ff04d3f8376ab6a3f4bb64ed`.
Worktree: `/Users/rschlae/Git/klicker/klicker-uzh/trees/rs/account-creation-production-e2e`.
The primary checkout has unrelated changes and is not an implementation workspace.

### Delegation map and sequence

| Work | Owner | Acceptance |
| --- | --- | --- |
| Production feasibility | Main; critical-path runtime coupling | Real PWA/Manage Webpack standalone startup, correct build-time origins and assets, disposable synthetic services, local SMTP, artifact identity. |
| Production smoke | Main; coupled to artifact and source-fix evidence | EN/DE full-document HTTP 200, interactive username field, desktop/mobile controls, reload, no unexpected browser/server exceptions; reachable translated shared component with real synthetic data. Equivalent broken/corrected builds demonstrate the target failure and recovery. |
| Ordinary registration | Native executor after feasibility | Real form mutation from absent subject, exact account count, recipient-scoped captured activation link, activation, password login in fresh context, authenticated reload, repeated registration without duplicates. |
| Synthetic LTI | Native executor after registration | Real signer/verifier, new and existing identity, cookie and cookie-free query handoff, expired/bad-signature rejection, unrelated-session isolation, editProfile redirect and reload, scoped participant/account linkage. |
| CI enforcement and delivery | Main; integration and external effects | Complete inventory, production-only execution, relevant-change selection, exact-candidate promotion prerequisite, applicable reviews and repository checks, ordinary push and draft PR. |

The package uses the full workflow. Preserve one writer per path. Commit the plan before substantive implementation; review substantive committed slices with simplification and applicable risk review, then review the integrated verified package. Runtime-dependent checks run in the container; Playwright runs through a host launcher that preserves production artifact identity. No development server or NODE_ENV=test substitute can satisfy production proof.

### Production artifact and fixture contract

The source-fix task exclusively owns `.github/workflows/test-intl-production.yml`, `.github/scripts/intl-production-smoke.mjs`, `.github/fixtures/intl-production/**`, and `util/test-intl-resolution.mjs`. Its checks are `intl-production-smoke (frontend-pwa)` and `intl-production-smoke (frontend-manage)`. Reuse its real PWA standalone output and translation regression receipts; do not duplicate that harness or use a fixture-only image for account journeys. This task owns account-specific browser coverage, host launcher integration, and its separate CI enforcement.

The local and account-CI adapters build actual API/Auth/PWA/Manage workspace artifacts with production Webpack, then start the emitted standalone servers with copied public/static assets. The source owner separately verified the pruned Docker production regression fixture; that receipt does not replace actual account journeys. Both modes share `util/playwright-production.ts`, with local routed HTTPS origins or CI loopback origins. Provenance includes source SHA, source digest, bundler, build-input identity and artifact digests.

Separate production outputs and startup from ordinary Turbopack artifact caches. Include standalone dependencies, public/static assets, source SHA, bundler, relevant synthetic environment, architecture, build ID, and artifact digest. Prevent host-launch reconciliation from silently replacing the production server. Build-time public origins must match the test runtime.

Use the existing getPrisma disposable-database guard and isolated cleanup lifecycle. Never precreate the ordinary registration subject or mock its mutation. Seed a minimal test-owned ParticipantAccountActivation email template; require recipient-scoped mail capture and the real activation link. Configure local SMTP and explicitly omit TEAMS_WEBHOOK_URL and external mail credentials. Capture bounded, sanitized failures without retaining token values in published evidence.

Use existing jose for test-only HS256 signing with configured issuer, internal sub/email/scope, and expiry. The current verifier has five seconds of clock tolerance; callers do not enforce issuer, so wrong-issuer rejection is not an assertion. Verify participant identity and participantAccount.ssoId linkage. Invalid/expired launches must not adopt an unrelated participant identity; this is not a global session-revocation requirement. Cookie-free continuation may retain participantToken in URLs.

Exercise the actual course/[courseId]/createAccount route. The integrated source-owner correction preserves the JWT query parameter. Retain the cookie-free query assertion; do not bypass the route or fix application source in this package. Do not infer course enrollment from this redirect.

### Coverage and CI contract

Add three consequential specs: A-account-production.spec.ts for documents/shared-component rendering, A-account-registration.spec.ts for registration/activation/login, and A-account-lti.spec.ts for signed handoffs. Each belongs exactly once in profiles.json. Their canonical profiles are manage,pwa; email,pwa; and pwa respectively. Run these specs only in the dedicated production lane, including the valid query handoff. Relevance groups may overlap; execution must not duplicate or omit specs.

Extend the runtime contract and CI services for MailHog, including trusted full-profile fallback. Preserve trusted cache/control boundaries. Test candidate-only unknown-spec behavior separately from the eventual trusted manifest. Fail on missing, skipped, not-run, failed, wrong-SHA, or incomplete production coverage. Trigger coverage for account/LTI/shared component/build/dependency changes and unconditionally for candidate promotion. The trusted staging promoter must require exact-candidate successful obligations and artifact identity, and reevaluate when coverage finishes after image builds. Do not execute candidate code inside its privileged controller. No live promotion is authorized.

No product primitive or data model changes are intended. An ADR is not required for this reversible test package; new authentication behavior or infrastructure ownership reopens that disposition.

### Research and review

The source handoff records Fable 5.1 high advisory consultation. Native planner Banach approved the original handoff plus the five concrete corrections above in round two. Required final and slice reviews remain unrun.

Current Next.js documentation was retrieved through Context7. It confirms standalone assets require explicit public/static copying, monorepo tracing must include required dependencies, and public environment values are fixed at build time. This is configuration guidance, not runtime evidence.

## Progress

Status: draft_delivered. [PR #5857, production account Playwright coverage](https://github.com/uzh-bf/klicker-uzh/pull/5857) is open against `v3`. Implementation is committed at `2b30ea61a7`; slice risk review completed after one correction, and integrated final review passed on `5d293ba9f5`. Main owns all changed files and the exact runtime. All implementation and exploration children have completed or been closed; all slice reviewers are closed. The simplifier completed with one optional cleanup-state reduction, explicitly deferred after main-session inspection.

### Current verification

The final full run passes all nine tests in 13.7 seconds with zero failures, skips or flaky results. `_local/account-production-result.json` and independently discovered `_local/account-production-inventory.json` pass the production report validator; `_local/account-local-receipt.json` records all three specs and nine executed tests. Repeat launch reused verified production artifacts. Final Playwright types and touched spec/helper formatting pass.

- The complete real production browser run in `_local/account-production-e2e-retry4.log` passed seven of nine checks: four EN/DE desktop/mobile registration documents, real Manage translated controls, ordinary registration/activation/fresh login, and invalid/expired LTI rejection with unrelated-session preservation. The next focused run in `_local/account-lti-diagnostic.log` passed the new-account LTI flow after correcting in-flight route teardown. Existing-account cookie-free redirects remained failing because Playwright route interception did not strip subsequent redirect cookies.
- The replacement Chromium request interception covers redirect hops and observes on-wire cookie headers. Its type check passes in `_local/account-types-cdp.log`; all three LTI checks pass in `_local/account-lti-cdp.log`. Production builds now explicitly disable Matomo defaults for synthetic tests. No evidence of an application-source defect or actual external analytics transmission is claimed.
- Ninety focused host tests pass in `_local/account-focused-tests.log`. Complete configured host checks `check:playwright-ci` and `check:playwright-host` also pass. All 35 package type checks and remaining baseline lint, syncpack, agent instructions, Git identity, removed-document and Prisma checks passed earlier; reuse unaffected checks and rerun changed Playwright types and formatting.
- Managed artifact reuse succeeds after browser traffic. Digests exclude Next.js request-written image and rendered page caches while retaining executable output; a focused regression test rejects replaced server code. An earlier idle Rollup process recovered after one exact managed stop and clean restart; its root cause remains unconfirmed.
- The source owner separately supplied pruned Docker regression receipts at `575d32444659ec2b10d42139126931f4ab8479a5`: corrected PWA/Manage EN/DE documents return HTTP 200 with translations, while the reverted dependency graph returns HTTP 500. Those fixture receipts do not replace this package's actual application account journeys.

### Runtime and local-only configuration

Exact source: `/Users/rschlae/Git/klicker/klicker-uzh/trees/rs/account-creation-production-e2e`. Devsy workspace: `rs-account-creation-production-e`; compose project: `default-rs-0170d`. The retained stopped runtime contains isolated Postgres/Hatchet, three Redis services, MailHog, and API/Auth/PWA/Manage. Final runtime release is verified: Devrouter stop succeeded, the source-matched Devsy workspace reports `Stopped`, and exact route count is zero. Local provider/status/route receipts are under `_local/account-provider-*.json` and `_local/account-routes.json`.

The user explicitly approved a task-local subnet remedy after Docker exhausted its predefined pools. Four compose lines selecting `172.30.240.0/24` were kept out of the commit and removed after the runtime stopped. The committed compose change contains only the MailHog loopback port mapping. Retain runtime data; no network, volume, branch or worktree deletion is authorized.

### Delivery and limits

Target `origin/v3` is confirmed by the merged source dependency PR. Refreshed target SHA `236ecd4fef9c9fddb6f4e6dd252e7e2f2226ddc4` was integrated once in `92adeba259` to remove misleading squash history. Only the source-owner plan document differed; that add/add conflict uses the merged target version. No application or test content changed, so passing runtime evidence remains applicable.

The dedicated production workflow and promotion prerequisite are implemented but have not run in GitHub. The previously trusted `v3` selector does not yet recognize newly introduced production-only specs, so the introducing PR can encounter the ordinary-lane bootstrap failure. Do not skip tests or claim that local proof establishes CI enforcement; keep the PR draft and state this limitation until the trusted selector and manifest land together. This package does not authorize that merge or any promotion.

Authorized source delivery is complete: the ordinary task branch is pushed and the coherent PR remains draft. GitHub checks were queued at initial readback. Merge, successful CI enforcement, and any rollout remain outstanding; no merge or deployment is authorized. No application dependencies, migrations, visible product UI, production records or external email are changed. Screenshot publication does not apply because this package changes test/runtime infrastructure only.

Slice risk correction `66e9b2b074` pins the complete candidate account workflow to trusted controller bytes before accepting run/job/artifact evidence. Conditional build, test, and upload negative cases pass with all 23 promoter tests. The same reviewer returned DONE on its one correction pass. The introducing ordinary-lane bootstrap concern remains an explicit draft/merge blocker. The artifact-cache lesson is committed in `ec631d9bd6`.

Integrated final review continuity: Claude Opus 5 stopped on session-limit API 429; AGY Gemini 3.8 Flash terminated before review; a fresh independent GLM 5.3 Flash max reviewer completed all 35 changed paths with schema-validated `pass` and no findings. Scoped evidence is in `_local/reviews/account-final-glm.json`. The final documentation-only update preserves reviewed implementation and verification.

## Approved TypeScript consolidation

The user approved consolidating the supporting scripts and converting them to TypeScript in this draft PR. Six coherent modules own production runtime, planning, sharding, cache identity, telemetry, and workflow validation. Preserve application behavior, data boundaries and CI enforcement. Add no dependencies or runtime compiler; merging and deployment remain outside scope.

Production uses one four-service lifecycle. Local `start` supervises the applications while the canonical host launcher owns browser execution. CI `test` owns that same lifecycle, readiness, inventory, tests and cleanup. Preserve child failures, spawn errors, early and during-test exits, SIGINT/SIGTERM and bounded cleanup without orphaned processes.

Use native Node 24.16.0 erasable TypeScript with explicit `.ts` imports, strict checking and no emitted JavaScript. Modules are import-safe: no startup, environment validation, CLI side effects or top-level await on import. Planning, sharding, cache, telemetry and report paths remain dependency-free. Existing YAML parsing remains isolated in workflow validation after installation. Use real runtime, plan and report types without suppression or runtime aliases.

Update all consumers together: workflows, composite actions, trusted Node setup before planning, process matching, source fingerprints, cache inputs, mandatory promotion report command matching and tests, whole-workflow byte equality, validator policy and package commands. Retire the replaced files without compatibility wrappers.

Ownership: the explorer maps planning and telemetry contracts; one executor owns production consolidation and lifecycle tests; a second executor owns planning and sharding with their tests; the main session owns cache, telemetry and workflow validation, callers, strict tool configuration, integration and final proof. Preserve disjoint write sets. Planner review of this amended contract is APPROVED after acceptance of its runtime, pre-install and consumer-coverage corrections.

Acceptance requires existing consequential tests under exact Node 24, strict TypeScript and formatting checks, isolated dependency-free CLI subprocesses from trusted control with a separate candidate, and real synthetic child lifecycle failure/signal/cleanup checks. Verify all nine actual local production browser tests and artifact reuse, then stop the exact runtime and verify zero routes. Count modules, entrypoints and tests before and after. Review committed changes and update the same draft PR. Do not bypass the existing trusted-selector bootstrap limitation.

Status: consolidation_in_progress. Approval covers reversible implementation, applicable checks and reviews, scoped commits, ordinary task-branch push and draft updates. The terminal condition is a verified consolidated draft with explicit CI limitations; no second approval is needed for these steps.

### Consolidation checkpoint

Implementation is committed through `1c1516e37e`. Twelve implementation entrypoints are now six native TypeScript modules; eleven test files are grouped into six. No dependency or compiler runtime was added. Explicit types and bounded descendant cleanup increase implementation lines from 2561 to 3248; this is a reduction in files and duplicated responsibilities, not total code volume.

Exact Node 24.16.0 strict checking passes. Configured CI checks pass 69 tests, host checks pass 47 tests, and promoter checks pass 23 tests. The 14 production tests include spawn failure, early exit, failure during tests, signal exit codes, escalation, and descendants surviving a launcher exit. Isolated pre-install CLI checks pass. Scoped Opengrep scans return zero findings. Formatting passes. Unaffected package baseline checks are reused; host hook equivalents were run separately. Simplification review's shared cancellation promise was accepted and verified. Risk review found no reportable issues in `f9355c05f9..1c1516e37e`; its report is `project/_local/reviews/consolidation-slice-review.md`.

Status: delivery_pending. Fresh browser proof is blocked by the retained local dependency network. The production build and application startup succeeded, but Hatchet exited after its Postgres connection timed out. Its network attachment is empty; Postgres is attached only to devnet. The previously approved temporary `172.30.240.0/24` override avoided exhausted Docker pools, but one clean managed stop/restart did not restore the dependency attachments. No fresh browser tests ran. Earlier nine-test proof predates this consolidation and does not establish its runtime acceptance. Do not bypass managed ownership with raw Docker repair or claim completion. Final integrated review, ordinary push and draft update remain pending runtime proof. Main owns continuation; all workers and slice reviewers are closed.

The installed Devrouter repair path was inspected: it restarts retained containers and does not restore missing network attachments, so no repair replay was attempted. Exact managed stop completed after the provider queue cleared. Fresh Devsy readback confirms Stopped and exact-source route count is zero. The temporary subnet override is removed, runtime data retained. No Docker network repair, volume deletion or other workspace change was attempted.

### Network recovery and fresh consolidation proof

The preceding runtime blocker is resolved. Devrouter 0.0.64 startup and its managed repair both retained the missing private-network attachments. The user explicitly approved reconnecting all seven stopped task containers to the existing ownership-verified `default-rs-0170d_default` network. That repair preserved container identities, network identity, volumes and source configuration. No deletion or recreation occurred.

At implementation revision `086cc5541935d82f9bac7d2b4298e0858b77c678`, the canonical production host launcher passes all nine Chromium tests in 14.1 seconds with zero skipped, unexpected or flaky results and no retries. A separate `--list` run discovers the same nine tests across all three required specs. `verifyProductionReport` accepts the independently produced inventory and result. The second launcher run verifies retained production artifacts after browser traffic. Evidence is in `project/_local/consolidation-repaired-browser.log`, `consolidation-repaired-browser-result.json`, `consolidation-repaired-inventory.json`, `consolidation-repaired-receipt.json` and `consolidation-repaired-reuse.log`.

Exact managed shutdown succeeded. The source-matched Devsy workspace reports `Stopped`, and exact-source routes are zero. Runtime data and repaired attachments remain retained. No temporary Compose override is present. Earlier strict checking, 139 focused tests and the scoped slice review remain applicable because implementation content is unchanged.

### Final review, correction and delivery state

The integrated final review completed over the full 53-path range and returned one medium finding: the production selection marker `.devcontainer/.runtime/account-production.json` survived production launcher runs and could flip a later ordinary `devrouter ensure` into production mode or fail its profile assertion. The correction adds a `try`/`finally` cleanup in `util/run-playwright-host.mjs` covering successful completion, `--print-env`, and thrown startup or test failures, preserving the original failure when cleanup itself fails on an already-failing run; three focused regression tests cover the success, failure and print-env paths. Committed as `e5ea36ccf0`. All 49 host tests pass. A same-reviewer correction pass over `6f883d8e54..e5ea36ccf0` returned `pass` with no findings (`project/_local/reviews/consolidation-final-correction.json`).

The failed fresh runtime start after the fix left no selection marker, confirming the cleanup on the real failure path. That rerun itself was blocked before any test executed: Docker could not create `default-rs-0170d_default` again because all predefined address pools are fully subnetted, the same machine-level condition the earlier approved temporary `172.30.240.0/24` override had bypassed. Host-side commands then became unavailable for this session through the tool usage limit, so a fresh browser rerun at the fix head could not be scheduled. Applicable evidence stands: nine-test production browser proof at `086cc55419` before the launcher-only cleanup, 49 host tests at the fix, and the passed correction review; the correction changes no application or test-production behavior.

Status: delivery_bounded. Implementation, correction, checks and reviews are complete; the consolidated draft is updated with an explicit limitation that the fresh browser rerun at the fix head was blocked by exhausted Docker pools and session host-command limits, while nine-test browser proof at the pre-fix implementation head `086cc55419` plus the reviewed launcher correction stand as the package's browser evidence. The trusted-selector bootstrap limitation still blocks merge readiness and no successful dedicated GitHub workflow run is claimed.
