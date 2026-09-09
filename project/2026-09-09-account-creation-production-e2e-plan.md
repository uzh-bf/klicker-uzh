# Account creation and production Playwright coverage

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

The local and account-CI adapters build actual API/Auth/PWA/Manage workspace artifacts with production Webpack, then start the emitted standalone servers with copied public/static assets. The source owner separately verified the pruned Docker production regression fixture; that receipt does not replace actual account journeys. Both modes share `util/production-standalone.mjs`, with local routed HTTPS origins or CI loopback origins. Provenance includes source SHA, source digest, bundler, build-input identity and artifact digests.

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

Status: delivery_pending. Implementation is uncommitted; required implementation reviews and the draft PR remain outstanding. Main owns all changed files and the exact runtime. All implementation and exploration children have completed or been closed; no reviewer is active.

### Current verification

The final full run passes all nine tests in 13.7 seconds with zero failures, skips or flaky results. `_local/account-production-result.json` and independently discovered `_local/account-production-inventory.json` pass the production report validator; `_local/account-local-receipt.json` records all three specs and nine executed tests. Repeat launch reused verified production artifacts. Final Playwright types and touched spec/helper formatting pass.

- The complete real production browser run in `_local/account-production-e2e-retry4.log` passed seven of nine checks: four EN/DE desktop/mobile registration documents, real Manage translated controls, ordinary registration/activation/fresh login, and invalid/expired LTI rejection with unrelated-session preservation. The next focused run in `_local/account-lti-diagnostic.log` passed the new-account LTI flow after correcting in-flight route teardown. Existing-account cookie-free redirects remained failing because Playwright route interception did not strip subsequent redirect cookies.
- The replacement Chromium request interception covers redirect hops and observes on-wire cookie headers. Its type check passes in `_local/account-types-cdp.log`; all three LTI checks pass in `_local/account-lti-cdp.log`. Production builds now explicitly disable Matomo defaults for synthetic tests. No evidence of an application-source defect or actual external analytics transmission is claimed.
- Ninety focused host tests pass in `_local/account-focused-tests.log`. Complete configured host checks `check:playwright-ci` and `check:playwright-host` also pass. All 35 package type checks and remaining baseline lint, syncpack, agent instructions, Git identity, removed-document and Prisma checks passed earlier; reuse unaffected checks and rerun changed Playwright types and formatting.
- Managed artifact reuse succeeds after browser traffic. Digests exclude Next.js request-written image and rendered page caches while retaining executable output; a focused regression test rejects replaced server code. An earlier idle Rollup process recovered after one exact managed stop and clean restart; its root cause remains unconfirmed.
- The source owner separately supplied pruned Docker regression receipts at `575d32444659ec2b10d42139126931f4ab8479a5`: corrected PWA/Manage EN/DE documents return HTTP 200 with translations, while the reverted dependency graph returns HTTP 500. Those fixture receipts do not replace this package's actual application account journeys.

### Runtime and local-only configuration

Exact source: `/Users/rschlae/Git/klicker/klicker-uzh/trees/rs/account-creation-production-e2e`. Devsy workspace: `rs-account-creation-production-e`; compose project: `default-rs-0170d`. The active local runtime has isolated Postgres/Hatchet, three Redis services, MailHog, and API/Auth/PWA/Manage. Stop through Devrouter and verify provider stopped plus zero exact routes after final runtime verification or a genuine pause.

The user explicitly approved a task-local subnet remedy after Docker exhausted its predefined pools. Four compose lines selecting `172.30.240.0/24` are machine-local and must not be staged. Commit only the separate MailHog loopback port mapping. Retain runtime data; no network, volume, branch or worktree deletion is authorized.

### Delivery and limits

Target `origin/v3` is confirmed by the merged source dependency PR. At the last refresh this task was five commits ahead and one behind that target because the source repair was squash-merged. Integrate the squash result once near delivery to remove misleading source history, preserving unrelated changes and using no force push.

The dedicated production workflow and promotion prerequisite are implemented but have not run in GitHub. The previously trusted `v3` selector does not yet recognize newly introduced production-only specs, so the introducing PR can encounter the ordinary-lane bootstrap failure. Do not skip tests or claim that local proof establishes CI enforcement; keep the PR draft and state this limitation until the trusted selector and manifest land together. This package does not authorize that merge or any promotion.

Before delivery: complete all nine real browser checks and validate the actual JSON inventory/result; finish applicable formatting and changed-source checks; inspect staged data and comments; commit the implementation; obtain the required simplifier, slice risk review and integrated final review; push the ordinary task branch and create one coherent draft PR. No application dependencies, migrations, visible product UI, production records or external email are changed. Screenshot publication does not apply because this package changes test/runtime infrastructure only.
