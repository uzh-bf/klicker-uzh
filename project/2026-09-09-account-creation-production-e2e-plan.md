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
Source dependency now integrated through authorized fast-forward to `575d32444659ec2b10d42139126931f4ab8479a5`. The account draft PR is proposed against `rs/translation-context-fix`, as agreed with its owner; no native stack mutation is authorized. Default-branch drift and this dependency are separate.
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

The agreed artifact interface uses the actual application Dockerfile and standalone runner image. Supply synthetic NEXT_PUBLIC_API_URL, NEXT_PUBLIC_API_URL_SSR, NEXT_PUBLIC_PWA_URL and COOKIE_DOMAIN at build time, then the existing PORT/HOSTNAME/APP_SECRET runtime contract. The runner entry is `node apps/frontend-pwa/server.js`. Provenance includes source SHA, Dockerfile/bundler, build-input names and artifact identity. The source owner's harness is not yet frozen; coordinate before integration.

Separate production outputs and startup from ordinary Turbopack artifact caches. Include standalone dependencies, public/static assets, source SHA, bundler, relevant synthetic environment, architecture, build ID, and artifact digest. Prevent host-launch reconciliation from silently replacing the production server. Build-time public origins must match the test runtime.

Use the existing getPrisma disposable-database guard and isolated cleanup lifecycle. Never precreate the ordinary registration subject or mock its mutation. Seed a minimal test-owned ParticipantAccountActivation email template; require recipient-scoped mail capture and the real activation link. Configure local SMTP and explicitly omit TEAMS_WEBHOOK_URL and external mail credentials. Capture bounded, sanitized failures without retaining token values in published evidence.

Use existing jose for test-only HS256 signing with configured issuer, internal sub/email/scope, and expiry. The current verifier has five seconds of clock tolerance; callers do not enforce issuer, so wrong-issuer rejection is not an assertion. Verify participant identity and participantAccount.ssoId linkage. Invalid/expired launches must not adopt an unrelated participant identity; this is not a global session-revocation requirement. Cookie-free continuation may retain participantToken in URLs.

Exercise the actual course/[courseId]/createAccount route. It currently drops query parameters. Retain the failing cookie-free query assertion and obtain the source-owner correction; do not bypass the route or fix application source in this package. Do not infer course enrollment from this redirect.

### Coverage and CI contract

Add three consequential specs: A-account-production.spec.ts for documents/shared-component rendering, A-account-registration.spec.ts for registration/activation/login, and A-account-lti.spec.ts for signed handoffs. Each belongs exactly once in profiles.json. Their canonical profiles are manage,pwa; email,pwa; and pwa respectively. Run these specs only in the dedicated production lane, including the valid query handoff. Relevance groups may overlap; execution must not duplicate or omit specs.

Extend the runtime contract and CI services for MailHog, including trusted full-profile fallback. Preserve trusted cache/control boundaries. Test candidate-only unknown-spec behavior separately from the eventual trusted manifest. Fail on missing, skipped, not-run, failed, wrong-SHA, or incomplete production coverage. Trigger coverage for account/LTI/shared component/build/dependency changes and unconditionally for candidate promotion. The trusted staging promoter must require exact-candidate successful obligations and artifact identity, and reevaluate when coverage finishes after image builds. Do not execute candidate code inside its privileged controller. No live promotion is authorized.

No product primitive or data model changes are intended. An ADR is not required for this reversible test package; new authentication behavior or infrastructure ownership reopens that disposition.

### Research and review

The source handoff records Fable 5.1 high advisory consultation. Native planner Banach approved the original handoff plus the five concrete corrections above in round two. Required final and slice reviews remain unrun.

Current Next.js documentation was retrieved through Context7. It confirms standalone assets require explicit public/static copying, monorepo tracing must include required dependencies, and public environment values are fixed at build time. This is configuration guidance, not runtime evidence.

## Progress

Status: delivery_pending; runtime available and source dependency integrated; implementation next.

Remote refs were refreshed for this execution phase. The task began at origin/v3 with zero ahead/behind and now includes the authorized source dependency through `575d32444659ec2b10d42139126931f4ab8479a5`. Application source remains owned by the translation-context task. Its course route now forwards one JWT query string and rejects repeated query arrays.

The user explicitly approved the task-local subnet remedy after Docker exhausted its predefined address pools. Compose validation and managed startup passed on 172.30.240.0/24. Workspace `rs-account-creation-production-e`, compose project `default-rs-0170d`, has healthy Postgres/Hatchet, three Redis services, local MailHog, and API/Auth/PWA/Manage. Dependency reconciliation passed with no drift. This proves development-runtime availability only. The four-line subnet override is machine-local and must not be committed; retain data and remove only the override after stopping the exact runtime. No network, volume, or worktree deletion is authorized.

All 35 package type checks passed. The root check failed because its installed-Devrouter contract test ran inside the container, where the host executable is intentionally absent. Run that contract and host-launcher checks on the host; complete the interrupted remaining checks inside the container. No application failure is inferred from this environment mismatch.

Registration mapping is complete in `_local/reviews/2026-09-09-account-registration-mapping.md`. It confirms selectors, the activation-template fixture, exact participant-count proof, and fresh-context login. No scoped mail-capture helper exists. Preserve current behavior: password login does not require activation, and activation can repeat while the JWT remains valid.

The user clarified Playwright only. Native executor owns bounded production runtime integration; main owns integration verification and account CI. Add explicit production mode to the host launcher and managed startup, build actual Webpack standalone artifacts with routed build-time origins, preserve artifact identity, and use local SMTP. Ordinary development stays the default. Source-owner Docker-pruned regression proof remains separately labeled. This task retains sole database fixture and runtime ownership; any source-owner browser acceptance must use a serialized agreed window.

Production artifact verification, account and LTI journeys, CI enforcement, reviews, push, and the coherent draft PR remain. Continue the approved sequence without another approval request. Stop the exact runtime and verify stopped status at a genuine pause or completion unless the user explicitly retains it.
