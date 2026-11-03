# Control mobile release implementation plan

Status: local iOS milestone and pilot source remedies implemented; physical-device and distribution qualification remain open.
Planning partner: configured GPT-6
Astra planner. Source baseline: `c66a08f947483abd186533ea399a2ae51d4d82dc`.
Related research: [Control mobile store roadmap](2026-10-23-control-mobile-store-roadmap.md).

## Approved NextAuth consolidation (2026-10-25)

The user superseded the original opaque Redis native session contract with
[the approved consolidation batch](2026-10-25-control-nextauth-consolidation-plan.md)
and [ADR 0057](../docs/adr/0057-share-nextauth-policy-with-native-control.md).
Current implementation removes persistent native Redis records and revocation,
uses fixed 30-day restricted JWTs with local logout, and retains transient
one-use handoff state. Earlier 12-hour/revocation details below describe the
previous milestone. Existing publication/topology and release gates still apply.


## Approval summary

Deliver the lecturer Control app through the iOS and Android stores using
bundled web assets, institutional login and reliable live-quiz controls. Reuse
the existing design, translations, backend permissions and GraphQL operations.
Keep the student apps and hosted Control routes compatible. App Router migration,
live updates, native screen rewrites and new telemetry are outside the first release.

The first approved executable batch validated the uncertain parts before
production authentication work. The subsequently approved iOS milestone below now
authorizes the production implementation locally. It compares a small Next static build with a
Vite entry only if Next requires broad adaptation, proves runtime session routing,
and produces a concrete mobile credential contract. Native shell experiments
use available tools; missing Xcode, Android tooling or devices are reported as
specific verification gaps. They do not prevent independent bundle and contract work.

The principal risks are login across the app's local origin, accidental command
replay after connection loss and backend changes breaking installed clients.
The authentication proposal uses existing system-browser login and a proof-bound,
one-use handoff into an explicitly bounded credential. Its lifetime, storage and
logout/revocation behavior must be settled before issuing it.

The user's original approval of batch A authorized only its experiments and contract
work. The later approval recorded below separately authorizes the iOS milestone. Its terminal result is a selected build approach, evidence with
platform limitations, and a reviewed authentication decision packet with exact
implementation paths. New stack publication, merging, deployment, signing-account changes and store
distribution remain separately named decisions. The later packages below define the release direction.

## Approved iOS sign-in milestone

On 2026-10-23 the user approved the concrete next outcome: sign in with the
existing lecturer identity, see courses, and control a local test session. This
is an executable batch using ADR 0055, not another experiment. Main integrates
the existing B1 contract and the minimum B2 navigation/command-safety work needed
for that journey. Execution mode remains standard because the exact parent model
identifier is unavailable.

Authority covers source changes, required pinned dependencies, local commits,
configured reviews, builds and synthetic local verification. Reuse the existing
task checkout on branch `enhance/control-native-login`, based on
`b88d67dd30f62867e9d3ae4c0889365660c3b23a`; preserve unrelated manifest changes.
The existing six-layer stack remains untouched. Its publication topology stays
withheld pending a concrete supported proposal or predecessor landing; do not
append a seventh layer, relink, merge, force-push or publish an ordinary chained
PR. No production deployment, signing changes, external distribution, production
account/data access, push feature or offline content cache is authorized.

Target iOS first. Android protocol compatibility may be retained, but generating
and qualifying Android is a later package. The terminal local outcome is a real
bundled iOS app that signs in through the existing auth service using a seeded
delegated lecturer account, loads its courses, opens a test quiz, and executes
a confirmed test command. Logout, expiry, scope restrictions, callback proof,
replay/cancellation, safe routing and uncertain command recovery are required
behavior. Institutional login and physical-device qualification remain explicit
acceptance gaps until the user supplies that environment; local delegated login
is not evidence of edu-ID acceptance.

The existing privacy defaults and test portfolio apply: five-minute attempts,
sixty-second codes, twelve-hour revocable sessions; no credentials in URLs/logs;
credentials and expiry only in device secure storage, no native analytics or
persistent user-data cache. Existing web and assessment authentication must keep
working. No schema migration or new Redis instance is needed.

Ownership: main owns auth/backend protocol, provenance, secure transport, runtime
and integration. One read-only explorer maps the static frontend route seam.
Astra challenges this executable package before source implementation. Settled
frontend/native pieces may be delegated with disjoint path ownership after that
challenge. Risk review and integrated final review cover the exact committed
package. Shared pure protocol code in `packages/util/src/controlNativeSession.ts`
is allowed only for the concrete auth and backend callers; avoid a new service.

## Execution details

### Current evidence and product contracts

The existing [controller follow-up PR](https://github.com/uzh-bf/klicker-uzh/pull/6686)
is draft and synchronized with `enhance/control-audience-feedback` at this
baseline. Its native base is `9ec603a8d150e405745487df74de91de4880d0e9` from
[the iOS shell PR](https://github.com/uzh-bf/klicker-uzh/pull/6539). The original
six-layer stack remains unchanged. Its earlier [execution plan](2026-10-23-control-stack-review-fixes.md)
records completed work and is not extended for this new package.

| Verified source                                                                                                                                                                    | Binding consequence                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Control configuration](../apps/frontend-control/next.config.mjs), [shared configuration](../packages/next-config/index.js)                                                        | Next 16.3.4 Pages Router uses server output, locale routing, redirects, an optional API rewrite and PWA generation. A mobile build must replace these deliberately without changing other apps.                                                   |
| [Session](../apps/frontend-control/src/pages/session/[id].tsx), [course](../apps/frontend-control/src/pages/course/[id].tsx), [\_app](../apps/frontend-control/src/pages/_app.tsx) | Existing client queries and translations are reusable. Blocking dynamic routes cannot simply be copied into a static export. New IDs must work after the build.                                                                                   |
| [Native configuration](../native/control/capacitor.config.ts), [package](../native/control/package.json)                                                                           | Capacitor 8.5.2 currently has an iOS hosted-URL prototype, separate lockfile and placeholder web assets. Android support must be generated and validated.                                                                                         |
| [Auth redirects](../apps/auth/src/lib/redirectTarget.ts), [session issuer](../apps/auth/src/lib/jwt.ts), [JWT utility](../packages/util/src/jwt.ts)                                | Existing redirects permit HTTP(S) on configured hosts. The unsalted issuance path does not explicitly add expiry; do not assume a browser credential is suitable for durable native storage.                                                      |
| [API transport](../apps/backend-docker/src/app.ts), [logout](../packages/graphql/src/services/accounts.ts), [Apollo](../apps/frontend-control/src/lib/apollo.ts)                   | Lecturer cookie selection depends on origin. Existing bearer transport must remain compatible with assessment. Cookie clearing is not bearer revocation. Production operation hashes and mutation retry behavior need explicit release contracts. |

No private course/session data enters a build. Backend authorization remains
authoritative. Preserve lecturer and delegated scopes, including read-only
access; participant or activation credentials must not become lecturer sessions.
Mocked API success proves only that boundary, never real IdP or device behavior.

| Product primitive               | Disposition      | Invariant and owner                                                                                                                      |
| ------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Lecturer authentication session | Extend, proposed | Auth owns the mobile handoff and credential lifecycle; existing identity and scope semantics remain authoritative.                       |
| Course and live-quiz access     | Reuse            | Existing API permissions apply to every selected ID and command. Local routing grants no access.                                         |
| Live-quiz execution             | Compose          | Existing commands combine with connection/lifecycle state. Resolve uncertain results from the server before another destructive command. |
| Q&A and audience feedback       | Reuse            | Preserve moderation, settings, visibility and recent-feedback semantics across web and native clients.                                   |

### Decisions and alternatives

Capacitor with bundled UI is the leading architecture. The research already
compares Expo/React Native, Tauri and native rewrites; reopen that choice only
when the experiment identifies a requirement Capacitor cannot reasonably meet.

| Decision          | Recommendation and completion condition                                                                                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend build    | Try Next static output first. Adopt it only if it preserves hosted routes and reuses screens/providers without broad duplication. Compare one isolated Vite entry if those conditions fail. Record build and adaptation evidence before selecting production files. |
| Authentication    | Keep institutional login in the system authentication browser. Use a dedicated HTTPS broker completion and exact registered app callback with a one-use code bound to the initiating app's proof. Preserve existing web redirect and OAuth audience boundaries.     |
| Native credential | Define explicit expiry, issuer/purpose/audience verification, scope derivation, storage, logout and revocation before issuance. Reuse bearer transport where its verified contract permits. No implicit refresh service or device registry.                         |
| Installed clients | Freeze an explicit supported-build/time window before public release. Retain accepted operation hashes and API semantics across that window; do not enable arbitrary operations to accommodate old clients.                                                         |
| Updates           | Store-delivered bundled UI and native releases for v1. Ordinary live data remains server-driven. Optional OTA comes later with a separate dependency, cost, privacy, signing and rollback decision.                                                                 |

Keep portable client screens on stable GraphQL/HTTP contracts. A later App Router
migration may use static build-time Server Components or hosted server wrappers;
installed clients must not depend on private RSC or Server Action protocols.

### Ownership, authority and working context

Execution mode: standard; exact main-model identity is unresolved. Main owns
integration, architecture/privacy decisions and the terminal condition. Astra
constructs and challenges the plan. A bounded executor may implement a settled
experiment; it cannot choose authentication policy or mutate the stack.

Delegation Map for the first executable batch:

| Slice                              | Execution owner                                                                | Dependency and acceptance                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| A1: static bundle experiment       | Native `executor`; main supplies the experiment contract and verifies evidence | Current source and synthetic harness; actual session query carries a post-build ID through navigation.        |
| A2: native consumption experiment  | Main                                                                           | Consumes A1's bundle; copied assets and available platform startup, with exact missing capabilities recorded. |
| A3: authentication decision packet | Main; read-only Astra challenge before acceptance                              | Uses A1/A2 origins and auth source; all material choices resolved before production auth work.                |

The approved local milestone covers B1 and minimum B2 navigation and command
recovery for iOS. Android, broader B2, B3 and R4 remain future work.
Main owns device and distribution evidence using user-provided access.

Batch A was approved and completed. Its authority covered source-scoped temporary
experiments, isolated prototype dependencies, available simulator/emulator checks,
synthetic fixtures and the A3 contract. The user has now separately requested
Xcode setup and an iOS Simulator run: accept the installed license, finish required
Xcode components, use/download the needed simulator runtime, build and launch the
isolated app, and keep a simulator available for manual testing. That simulator-only follow-up excluded production authentication. The later
iOS milestone supersedes that source restriction while still excluding developer/signing-account changes,
student listing changes, new cloud/runner services, production data access and
external distribution.

Reuse this task's worktree while drafting. Experiments belong under the ignored
`project/_local/prototypes/control-mobile-bundle/` directory and must exclude
secret-bearing files and the fifteen unrelated package-manifest build overrides.
The simulator follow-up also owns one external harness file,
`project/_local/prototypes/control-mobile-bundle/simulator-api.py`, serving only
test-owned synthetic GraphQL responses on loopback. It makes real bundled
session rendering observable without production login or data. A fixture-only
API override in the existing isolated Next config and a separate copied iOS
simulator config are development evidence, never release configuration.

Their code does not become shipping code by cleanup. Preserve the existing
manual-testing runtime; start no runtime merely to validate this document.

The host currently selects CommandLineTools rather than full Xcode, and `adb`
is absent on PATH. Full SDKs, devices, signing teams and store access are
unverified prerequisites. Do not install or switch them under planning authority.
Application/container checks stay in the container; Git, forge operations,
Playwright and native platform builds run on the host under repository policy.

### First executable batch A: validate the implementation boundary

#### A1 — Prove a real bundled session entry

Question: can the existing UI run from static local assets with a session ID
that did not exist when the assets were built, without a hosted Next server?

Read/reuse the current session screen, providers, font assets, translations and
Apollo operations. Build the smallest experiment outside production page
directories. Start with Next static output. Do not freeze `.mobile.tsx` page
extensions before proving hosted builds exclude those wrappers; the ordinary
`.tsx` suffix can discover them too.

If Next needs broad route duplication or shared-configuration changes, construct
one Vite comparison with the same acceptance case. Use a verified pinned
prototype-only version and lockfile. Prefer fewer production adaptations and
less duplicated ownership, not a superficial bundle-size result. Neither
experiment may change the current app's dependencies or hosted route contract.

Handwritten experiment files under `project/_local/prototypes/control-mobile-bundle/`:
`next/{package.json,pnpm-lock.yaml,tsconfig.json,next.config.mjs}`,
`next/pages/{_app.tsx,_document.tsx,index.tsx,login.tsx}`,
`next/pages/session/index.tsx`, `tests/control-bundle.spec.ts` and
`playwright.config.ts`. The optional comparison owns
`vite/{package.json,pnpm-lock.yaml,tsconfig.json,vite.config.ts,index.html}` and
`vite/src/{main.tsx,App.tsx,styles.css}`. Reuse source modules by import and copy
only public assets from `apps/frontend-control/public/` and existing font files
when required by the bundler. Dependency/build/generated directories are not
handwritten modules. If another handwritten file is essential, first record its
concrete purpose and updated experiment path set in this plan.

Acceptance: build first, introduce a synthetic ID afterwards, then cold-open the
local entry. The external harness must observe the real session query carrying
that exact ID and return a minimal test-owned session that the reused screen
renders. Repeat the query/ID and observable session checks after refresh and
back navigation. A login/connection page by itself cannot pass this case.
Check EN/DE, CSS/fonts/assets and correct test API selection. Inspect requests
to establish that the app does not fetch hosted Next HTML/RSC to work. This
synthetic route proof remains separate from real authentication qualification.
All synthetic response/auth handling belongs to the external test harness,
without production test-only branches.

Output: runnable experiment command, selected approach, adaptation/file inventory,
observations and limitations in `project/_local/reviews/control-mobile-bundle-evidence.md`.
If both approaches are inconclusive, return the actual blocker and comparison;
do not start a third frontend or native rewrite.

#### A2 — Check native bundle consumption where tools are available

Consume A1's output in an isolated copy of the native prototype at
`project/_local/prototypes/control-mobile-bundle/native/`. Copy only tracked
`native/control/{capacitor.config.ts,package.json,pnpm-lock.yaml,README.md,ios/,www/}`
source, excluding local settings, credentials, node_modules, build output and
signing material. The copied config/package files own handwritten experiment
changes; its lockfile records dependencies. The CLI generates `native/android/`
and native dependency/project updates; asset copying generates embedded web
output. Record the exact generated inventory separately after the command.

Keep Capacitor
platform versions aligned at 8.5.2 for this experiment. Generate minimal Android
support through its CLI and record the generated inventory; exclude build output,
local SDK paths and signing material. The original `native/control` remains intact.

Verify embedded asset identity and development-versus-release configuration.
Store configuration must contain the actual bundle, with no `server.url`
fallback to a hosted application, no service-worker ownership and no local
development API/auth endpoints. Local Capacitor asset origins are legitimate
and must not be mistaken for forbidden remote endpoints.

When a simulator/emulator is available, prove local startup and the A1 runtime-ID
route there. Otherwise record the exact missing tool and continue A3. Browser
or copied-asset checks do not complete R0 native qualification. Do not spend on
a runner, configure signing, install tools or connect a real IdP to get a green
experiment result.

Output: append platform, build mode, source, asset digest, producing command and
observed local origin to the same evidence artifact. A2 makes no store claim.

#### A3 — Freeze an implementation-ready authentication contract

Use A1/A2's build/origin evidence plus current NextAuth and API behavior.
For an untested platform, label the origin as documented/provisional and carry
its verification forward. Assign exact production endpoint, client bridge,
native registration and test paths before proposing authentication implementation.

The packet must specify callback ownership, server-side login audience, state
and proof binding, atomic one-use consumption, code lifetime, cancellation,
replay rejection and failure recovery. The app callback carries no session or
refresh credential. An exchange returns credentials only to the verified app,
uses no-store responses and keeps credentials out of logs and other responses.

Specify how a verified lecturer's role/scope becomes a bounded mobile credential;
explicitly reject participant and activation sessions. Choose a concrete lifetime,
secure-storage implementation and dependency/license, expiry UX, account switch,
logout and server-revocation semantics. Compare a minimal bounded session without
refresh against any demonstrated need for longer persistent access. Existing
cookie clearing cannot be presented as native token revocation.

Specify HTTP origin/CORS/CSRF behavior without globally relaxing the web path.
Current Control uses polling and queries/mutations; a generic Apollo WebSocket
link does not justify adding native subscription authentication. If actual
required operations use subscriptions, name those operations and their contract.

Apply privacy defaults: retain only authentication transaction material needed
for its bounded lifetime; clear credentials and user caches on logout/account
switch. Keep tokens, codes and raw auth URLs out of native navigation logs,
application logs, analytics and screenshots, including DEBUG builds. Preserve
existing privacy choices; native telemetry is off until separately assessed.
The packet identifies data purpose, access, expiry/deletion and remaining
owner decisions without inventing a new legal basis or retention obligation.

Output: extend this plan with the selected contract and exact paths, supported
by an auth ADR draft at `docs/adr/<reserved-number>-control-native-session-contract.md`.
Resolve the numeric filename against current/open branch reservations before
creating it. A separate Astra challenge must clear the complete contract; if
token lifetime, storage, callbacks or revocation remain unresolved, list the
recommendation and consequence as one decision packet. No credential issuance
or production auth endpoint implementation follows an unresolved packet.

Batch A terminal: A1 evidence and chosen frontend boundary, A2 platform results
or precise qualification gaps, and A3's reviewed contract or concrete unresolved
decision. Report `R0 native qualification pending` for missing native proof.
Stop at this boundary for approval of the production implementation package.
No generic checkpoint is needed between routine A1-A3 corrections.

### Selected A3 contract and future implementation paths

[Proposed ADR 0056](../docs/adr/0056-control-native-session-contract.md) is the
single source for the login/session protocol. Number 0055 was free across the
current tree, fetched remote branches and local worktree reservations on
2026-10-23. The independent Astra challenge approved the corrected packet in round2; it
remains a proposal for the next production package. No production behavior or auth test was implemented in batch A.

The concrete v1 choice is a proof-bound browser handoff followed by an opaque
12-hour absolute session, with no refresh and immediate online revocation in
execution Redis. Native scope is capped at `SESSION_EXEC`; delegated read-only
access remains read-only. Browser completion requires an explicit account
confirmation. Local sign-out works offline but cannot claim server revocation.
Store only the native credential/expiry through MIT-licensed
`@aparajita/capacitor-secure-storage@8.0.1`, with device-only storage, sync/backup
disabled and no Web fallback. A small app-local authentication bridge uses iOS
ASWebAuthenticationSession and Android Custom Tabs. Capacitor's generic OAuth
community plugin currently documents Capacitor 7 support, so it is not selected
for the Capacitor 8 contract. Future production dependencies need exact lockfile
and native compilation evidence; no auth plugin was installed in batch A.

| Future B1 owner and exact paths                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Required behavior and acceptance seam                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth: `apps/auth/src/pages/api/native/{start,exchange,cancel,revoke}.ts`, `apps/auth/src/pages/native/complete.tsx`, `apps/auth/src/lib/nativeSessions.ts`, `apps/auth/src/proxy.ts`, `apps/auth/src/pages/index.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                        | Fixed client/callback registry, browser CSRF confirmation, bounded transaction/code/session records, atomic proof/expiry/one-use exchange, exact revocation. Add `ioredis@5.4.1` to `apps/auth/package.json` and root `pnpm-lock.yaml`, matching the existing backend version, only during B1. Use existing execution Redis connection settings; `turbo.json` must track any newly consumed build/runtime variables. No database migration or new Redis infrastructure is proposed. |
| Existing lecturer provenance: `apps/auth/src/pages/api/auth/[...nextauth].ts`, `apps/auth/src/lib/helpers.ts`, `apps/auth/src/types/app.d.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                     | Add server-verified source identity: exact delegated `UserLogin.id` plus the authentication-time keyed password digest, or institutional `Account.id`. Old cookies lacking provenance restart native login. Keep existing audience dispatch/redirect policy. No participant or activation session can complete a native handoff.                                                                                                                                                    |
| Backend: `apps/backend-docker/src/controlNativeAuth.ts`, `apps/backend-docker/src/app.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Digest lookup, explicit native purpose/audience/version/deadline, current account/login/scope checks, origin/endpoint-classified native OPTIONS and actual-response CORS before the existing reflector, no invalid-native fallback, main GraphQL only. Preserve assessment bearer and web cookie behavior. Use existing `redisExec`/Prisma dependencies.                                                                                                                            |
| Frontend: `apps/frontend-control/src/lib/nativeSession.ts`, `apps/frontend-control/src/lib/apollo.ts`, `apps/frontend-control/src/pages/login.tsx`, `apps/frontend-control/src/pages/_app.tsx`                                                                                                                                                                                                                                                                                                                                                                                    | Native-only bridge and secure storage; fixed production endpoints; bearer with cookies omitted, no credential logs; sign-in/expiry/account-switch/logout and cache clearing. Routing/build source paths are finalized from A1 before B1 is proposed.                                                                                                                                                                                                                                |
| iOS: `native/control/ios/App/App/{ControlAuthPlugin.swift,ViewController.swift,AppDelegate.swift,SceneDelegate.swift,Info.plist,Base.lproj/Main.storyboard}`, `native/control/ios/App/App.xcodeproj/project.pbxproj`, `native/control/ios/App/CapApp-SPM/Package.swift`; Android: generated `native/control/android/app/src/main/{AndroidManifest.xml,java/ch/uzh/klicker/control/MainActivity.java,java/ch/uzh/klicker/control/ControlAuthPlugin.java,java/ch/uzh/klicker/control/ControlAuthActivity.java}`; `native/control/{package.json,pnpm-lock.yaml,capacitor.config.ts}` | Register the local plugin and exact callback, external auth browser lifecycle/cancel handling, backup/sync restrictions and release bundle configuration. Remove full navigation URL logging in DEBUG as well as release. Pin native storage and any required AndroidX browser dependency in the generated `native/control/android/app/build.gradle`. Native bridge code carries the repository AGPL license; no new auth service SDK is selected.                                  |

B1 test paths are `apps/auth/test/native-session.integration.test.ts`,
`apps/backend-docker/test/controlNativeAuth.test.ts` and
`playwright/tests/C-control.spec.ts`. Extend existing auth callback-journey,
redirect-target, dispatch, auth-cookie and student-session suites only where
changed behavior warrants it. Native qualification belongs to real platform
runs, not mocks. Test these observable contracts: wrong proof/callback/state,
duplicate fields and concurrent replay; expiry/cancel/process death/lost exchange
response, including cancel/exchange ordering and failed credential persistence; participant/OTP/activation denial; no delegated scope elevation;
identity/login deletion or password change before handoff and after issuance; offline versus online logout;
storage failure/reinstall and account-switch cache separation; native CORS and
invalid-prefix denial while web/assessment authentication still works. Tests
are future B1 obligations, not batch-A executable coverage.

### Later implementation packages and release milestones

These packages describe the complete route to release. They are direction-only
until batch A supplies the concrete implementation boundary. They are not
permission to implement unspecified endpoint, storage or generator files.

| Package                                                            | Coherent outcome and intended source ownership                                                                                                                                                                                                                      | Evidence and delivery boundary                                                                                                                                                                                                      |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1 — Bundled app and native lecturer login (R0/R1)                 | Adopt A1's selected layout; share screens between actual callers. Wire `apps/frontend-control` and `native/control` to real local assets and generated Android support. Implement A3's auth service, native bridge and API transport contract.                      | Static/browser regression plus native compilation, then real physical-device edu-ID success/cancel/expiry/logout/account-switch and authorized synthetic quiz access. Delegated login alone does not qualify institutional login.   |
| B2 — Complete lecture control and recovery (R2)                    | Home/course/unassigned/session navigation, existing Q&A/feedback, layout and locale providers. Bound query retries; remove blind mutation retry. Revalidate server state on resume/reconnect and after uncertain results.                                           | Extend existing Control workflow, then physical lock/background/resume, network switching/loss, keyboard/back/safe-area checks. Real EN/DE desktop/phone captures and interaction evidence through the screenshot-gallery workflow. |
| B3 — Installed-client compatibility and store-ready artifacts (R3) | Existing GraphQL generation/operation-map resolver and native release scripts own accepted operation sets and immutable manifests. Record source revision, asset digest, native build and operation-set identity. Prepare archives and public-safe store materials. | Oldest supported client versus new backend, unknown hashes rejected, fresh install/upgrade, compatible backend rollback, endpoint/asset checks and exact source/build provenance. No distribution implied by artifact completion.   |

Each package keeps tests with its behavior and commits coherent outcomes,
not one PR per file or commit. B1 auth/transport and B2 uncertain-command behavior
require risk review. Each package needs simplification, integrated final review,
applicable checks and independently green CI at its own head. Native packages
outside workspace globs need explicit build/check invocation; root green CI
does not establish native compilation. Add no paid build lane implicitly.

R3 must freeze numeric supported-build/time and retirement rules, operation-set
ownership and exact storage/generator paths before implementation. Deploy
additive backend/auth/operation support before clients, and retain it for
installed versions. A backend rollback must still accept every supported client.
Use the hosted Control app as a documented recovery route; a replacement store
binary is not an instant rollback of installed apps.

R4 is a separate delivery sequence: prepare signing/metadata/privacy/reviewer
access and obtain pilot acceptance on physical devices. Name TestFlight upload
and tester distribution, Play testing upload and distribution, public store
submissions, and public release activation as distinct external actions requiring
authority. Verify the actual login/account-creation flow for review disclosures,
account-deletion applicability and the education-login exception. Beta acceptance
is not public App Store approval. Store signing/account access stays with its owner.

### Test portfolio

| Consequential risk                                                      | Existing protection and proposed obligation                                                                                                                                                                                                          | Primary seam and owner                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime IDs or locales fail in exported assets                          | A1: **add new**, one experiment-owned browser scenario. Later retain only the consequential bundle-routing regression in the production package.                                                                                                     | Real static output served locally; ID introduced after build. Main verifies source and request provenance.                                                                                                                              |
| Handoff replay, scope elevation, bad callbacks or unbounded credentials | A3: **none**, contract review only. B1: **extend existing** auth unit/integration suites at the selected issuer/exchange seam; preserve `dispatch`, `redirect-target`, `auth-cookies`, `salted-jwt`, callback journeys and student-session coverage. | A3 assigns exact future paths/assertions; B1 implements wrong-proof, replay, expiry and role/scope cases. A focused backend integration case covers changed native transport. Batch A implements no executable auth tests or endpoints. |
| Stale/duplicate quiz commands after loss or resume                      | Extend `playwright/tests/C-control.spec.ts`; retain existing lifecycle service regressions where unchanged.                                                                                                                                          | Response lost after server success, then refetch/recovery. Harness-owned fixtures; no production fixture controller.                                                                                                                    |
| Old hashes disappear or rollback rejects an installed client            | Add a production-mode persisted-operation resolver integration case in B3.                                                                                                                                                                           | Minimal synthetic previous/current operation sets; old accepted operations succeed, unknown hashes remain denied.                                                                                                                       |
| Native artifact or lifecycle differs from browser                       | Add a release-artifact invariant check; use physical-device evidence for OS/auth/upgrade behavior. No prose/metadata snapshots.                                                                                                                      | B3 verifies real packaged output; B1/B2/R4 record device, build, OS, scenario and result. No invented acceptance from emulation.                                                                                                        |

Use current repository type, lint, formatter, test and build tools. Validate the
first useful export before broad checks. Reuse unchanged service/browser evidence
where source/toolchain/contracts remain identical. Run host Playwright against
only the necessary app/runtime; use task-owned disposable fixtures and no resets
of the retained manual-test database. New tests protect behavior, not copy,
translation wording, seed contents or documentation text.

### Topology, ADRs and continuation

The current user approval starts local iOS implementation before predecessor
landing. It does not change the publication topology below.

Recommend a sequential three-package native stack after the current six-layer
stack lands. Its target is the actual receiving branch (`v3-ai` today), refreshed
and verified at that point. Do not append a seventh layer, reorder existing PRs
or treat this plan as merge authority. Local experiments can run from inherited
source before landing. Publish no standalone plan-only PR.

Server API confirms stack 6540, but the installed stack CLI currently does not
recognize the branch locally. Future publication must reconcile that discrepancy
through supported tooling before any topology mutation; do not repair it as part
of this planning task. If early publication is needed before the predecessor
lands, present the exact supported topology for approval rather than inventing
chained ordinary PRs.

This draft stays uncommitted in the existing `project/` artifact root. After
production-package approval, carry it to that package's task worktree and commit
it with the first implementing package; later packages update the same epic plan.
No additional artifact root or plan-only PR is created.

Reversible build experiments do not meet the ADR gate. A3's durable credential
lifecycle and R3's installed-client compatibility do. Reserve exact numbered
filenames before their dependent implementations and keep durable rationale in
those ADRs. Native README/auth-model documentation changes accompany the actual
behavior change, not this proposed design.

Pause only a dependent branch when its required capability/authority is missing,
the experiment requires a new architecture outside the compared choices, or auth
and compatibility contracts cannot be resolved. Continue independent approved
work. Safe local corrections and ordinary verification do not reopen approval.

### Research and planning verification

Reuse current same-session primary sources and limitations in the linked
roadmap. Recheck version-sensitive APIs with `rs-find-docs` when constructing the
experiment or selecting a plugin. No device, export build, IdP, signing or store
proof was produced by this planning task.

Astra's construction recommended the bounded first batch, explicit credential
lifecycle, separate follow-up stack and physical-device acceptance. Main checked
the auth issuer/verifier, cookie logout, test seams, native CI coverage and host
tool prerequisites. Main kept mobile page-file selection provisional to protect
hosted routes. The separate frozen-draft Astra challenge approved the revised plan after three
accepted corrections: observe the real runtime-ID query, name the experiment
files, and assign slice owners while separating contract review from auth tests.
The optional opposing-provider challenge was not run because automatic approval
review rejected disclosure of unpublished planning/authentication details. This
limitation does not replace or invalidate the completed Astra review.

## Progress

- Batch A complete. A1's real Next static export and post-build session-ID
  browser scenario passed through EN/DE, refresh and back. A2 generated Android
  and synced the identical real assets into both native projects. A3's corrected
  authentication contract passed independent Astra review in round2.
- Selected frontend boundary: keep Next static export with a separate mobile
  build entry, shared screens/providers and fixed routes carrying runtime IDs.
  No Vite comparison was necessary. Full navigation and real authentication
  remain B1/B2 acceptance work; the experiment is not promoted to production.
- iOS follow-up: **simulator build/startup/runtime-ID rendering passed** on
  iPhone18 Pro / iOS27.0. Xcode license/first launch are complete and the required
  runtime is installed. Actual WKWebView origin is `capacitor://localhost`.
  Native routing needs explicit export-file handling; see the
  historical `control-mobile-ios-simulator-evidence.md` in the retained pilot's
  ignored review directory; it is not copied into this publication checkout.
  Android, physical-device behavior, native login, signing and stores remain
  unqualified. R0's broader platform checks remain open.
- Historical evidence retained in the pilot's ignored review directory:
  `control-mobile-bundle-evidence.md`, `control-mobile-auth-contract-review.md`
  and `control-mobile-native-asset-identity.json`.
  Browser evidence contains one passing behavioral scenario, four observed
  runtime-ID queries, EN/DE phone and EN desktop captures, no external Next
  dependency, browser exception or service worker. Test delta: one isolated
  harness scenario added; no production tests or sources changed.
- Source remains `c66a08f947483abd186533ea399a2ae51d4d82dc`, upstream 0/0.
  Fifteen pre-existing manifest overrides remain untouched. This plan and
  proposed ADR0055 stay uncommitted for the next approved implementing package;
  no plan-only PR or stack change was made.
- Runtime: retain the existing Control app under the user's manual-testing
  request. The experiment server/browser close after verification. No runtime
  data or worktree was deleted.
- Required batch gate: complete. Astra reviewed the complete A3 contract; main
  inspected the isolated files and verified build/browser/native asset evidence.
  Prototype code is excluded from production delivery; no shipping-source
  simplification/final-review claim is made.
- Simulator follow-up complete within its bounded scope: compiled, installed,
  launched and inspected real bundled session rendering. One external synthetic
  harness was delegated, inspected and corrected for the existing CSRF header.
  Retain iPhone18 Pro and its loopback fixture API for user testing. This is a
  development-only, read-only synthetic preview; full navigation, commands and
  production authentication remain B1/B2 work.
- Historical batch-A next action: approve a concrete B1 package using these measured
  boundaries, after the predecessor stack reaches its agreed landing point.
  B1-B3/R4 implementation, publication, merging and distribution are not part
  of the completed batch. Keep the existing six-layer stack unchanged.

### B1 local execution and verification

The Astra execution-plan challenge requested narrow corrections, all accepted:
include existing auth proxy/index continuation; retain exact login provenance;
recognize native credentials before legacy cookie selection; separate local
acceptance from publication and physical/institutional acceptance.

| Slice | Owner | Acceptance and commit boundary |
| --- | --- | --- |
| B1a: broker and backend | Main | Real Redis atomic handoff/cancel races; scope/provenance revocation, native CORS and legacy web/assessment compatibility. Commit coherent server behavior with its tests. |
| B1b: bundled route entry | Bounded executor | Shared root query entry preserves runtime IDs, EN/DE and home/course/unassigned/session navigation. Hosted paths unchanged. |
| B1c: iOS bridge and storage | Bounded executor; main integrates client transport | System authentication browser returns to the actual instantiated bridge controller; device-only secure-storage plugin pinned; native compile passes. |
| B2a and local acceptance | Main | No blind mutation retries; refresh before conflicting commands after uncertain results/resume. Real local delegated sign-in, course list and synthetic quiz control in the bundled simulator. |

Frontend allowed paths extend the named B1 set with
`apps/frontend-control/src/lib/nativeRoute.ts`, existing home/course/unassigned/
session pages, and `next.config.mjs`. The only new route module serves both
hosted and bundled navigation. Use a single root HTML entry with runtime query
parameters so Capacitor needs no extensionless server fallback. Export both
message bundles. Main owns dependency/lockfile edits and auth-client integration.

Shared `packages/util/src/controlNativeSession.ts` holds constants, record/source
types and explicit scope validation only, exported through the existing barrel.
It serves auth and backend; Redis, Prisma, cryptography and issuance stay server-
owned. Map ACCOUNT_OWNER/FULL_ACCESS/SESSION_EXEC to SESSION_EXEC and READ_ONLY
to READ_ONLY; reject other scopes. Add no new service, schema or migration.

New tests are explicitly authorized at
`apps/auth/test/native-session.integration.test.ts` (isolated real Redis),
`apps/backend-docker/test/controlNativeAuth.test.ts` (middleware transport and
current principal), and the existing auth callback and Control Playwright suites
where behavior changes. OS browser/Keychain behavior requires direct simulator
evidence; no new automated native platform suite. Keep UI captures synthetic.

The old Devrouter wrapper could not read the current reliability record. The
installed current CLI subsequently ran the normal container-backed Git checks
from a host context that permits process inspection. The source mount remained
matched to the task checkout; no runtime reset or global configuration change
was needed. The manual-testing runtime remains retained under the user request.
Publication topology, real institutional login, physical devices, backup/log
retention and store distribution remain unqualified.

Astra corrected-plan review: APPROVED. Frontend routing and iOS bridge
executors own disjoint path sets; backend transport executor owns its existing
server middleware and focused test. Main owns broker/provenance and integration.
OpenCodex readiness returned ready before executor dispatch.


## iOS milestone progress

The approved implementation extends existing lecturer authentication and Control
screens with proof-bound native sessions, a real static bundle and runtime query
routing. The hosted app keeps its canonical routes. The student PWA retains its
Capacitor version through one scoped syncpack exception; native generated output
is excluded from frontend linting.

Local verification has completed the system-browser delegated login, explicit
account confirmation, return to the app, course loading and confirmed quiz block
close/start commands against the retained synthetic runtime. Simulator builds
require local ad-hoc signing for Keychain access. Browser confirmation uses a
same-origin referrer policy and allows the fixed callback scheme in form-action;
CSRF and exact Origin checks remain enforced.

The final local bundle restores its Keychain session after full process
termination. Online logout revokes the server session, returns to sign-in and
remains signed out after relaunch. Hosted cookie login and canonical quiz routes
were also exercised. Auth suites pass with 117 cases after removing 75 redundant
invocations of shared pre-dispatch HTTP guards; the 16 backend cases, 42 workspace
type-check tasks, formatting, lint, syncpack and host contracts pass. Static
export and the locally signed iOS Simulator build pass.

The simplifier's only finding was the repeated HTTP-guard matrix; that reduction
preserves distinct guard inputs and action-specific protocol coverage. The slice
risk review approved the corrected frozen implementation. The integrated final
review's exact range, verdict and disposition belong to the ignored review
reports alongside producing-run evidence and screenshot provenance in
`project/_local/reviews/`. Test delta: new native protocol and backend transport
coverage; removed duplicate shared-guard invocations; no content-pinning tests.

The runtime and Simulator remain available for the user's requested manual test.
No native PR is published: publication still requires a supported topology or
predecessor landing. Real edu-ID, physical-device behavior, network-interruption
experiments, request/referrer-log redaction, installed-client compatibility,
Android and store distribution remain later qualification work. The next user
acceptance step is the seeded lecturer login and quiz-control journey in the
bundled iOS app. Simulator success does not imply those later acceptances.

The integrated final review identified command recovery that stayed blocked when
its first refresh failed even after polling recovered. The correction extends
the planned Control browser workflow with a server-success/lost-response case,
failed session reads and recovery without replaying the mutation. It also found
that the native start limiter uses the connection peer address: proxy clients
share its 20-start/five-minute bucket. ADR 0055 records trusted-proxy address
qualification as a gate before any shared deployment. Local testing does not
qualify that ingress contract.


## Approved pilot-preparation continuation

The user approved the next pilot sequence on 2026-10-24: address native login
rate limiting and authentication log exposure, qualify an iPhone and real edu-ID,
then package the native changes and prepare signing and TestFlight delivery.
This continues the existing plan and task branch. Execution mode remains
standard. The current source baseline is the completed local iOS milestone.

The first source package must stop clients behind a proxy from sharing one
socket-peer quota while preventing forged forwarding headers from selecting a
new quota. Trusted proxy CIDRs are explicit deployment configuration; absent
configuration trusts only the connection peer. No private-network blanket,
hop-count guess or raw forwarding-header trust is permitted. Canonicalize
IPv4, IPv6 and mapped IPv4 before the existing keyed digest. Keep the existing
five-minute counter lifetime, attempt/session limits and credential contract.
Only native start resolves the rate-limit address; exchange, cancel and revoke
remain available during trust-configuration failures. The contract under architecture consultation is:

- `CONTROL_NATIVE_TRUSTED_PROXY_CIDRS` is a comma-separated list, wired from
  `auth.nativeTrustedProxyCidrs` in chart values. Empty/unset means direct peer
  mode. Limit configuration to 8 KiB and 64 CIDRs; reject empty entries. Accept
  decimal dotted IPv4 and IPv6 literals with an explicit decimal prefix length,
  without ports, brackets, zone IDs, shorthand IPv4 or leading-zero octets.
  Normalize mapped IPv4; mapped CIDRs require a prefix above 96 and become
  the corresponding IPv4 range. Reject zero-bit ranges after normalization. Use Node's strict `isIP` before the selected
  `ipaddr.js@2.2.0` parser; no hand-written IP arithmetic.
- `X-Forwarded-For` is the only accepted forwarding header. An untrusted socket
  peer ignores it entirely. A trusted peer requires one header occurrence, at
  most 4 KiB and 32 entries. Reject duplicate occurrences, absent/empty data and
  empty entries. Parse addresses from right to left, traversing only configured
  trusted hops. The first untrusted address is the client; claims farther left
  are ignored. Reject an all-trusted chain because it identifies no client.
- Return generic `native_auth_failed`: 503 for invalid server configuration or
  unusable socket peer; 400 for unusable trusted forwarding. Canonicalize before
  the existing keyed digest. Clients sharing a NAT still share an address quota;
  this is per-address abuse protection, not per-device isolation. Operators must
  qualify actual proxy rewriting and exact CIDRs before shared use. Source
  support alone does not qualify deployment values.

The logging package suppresses auth framework request URLs and uses bounded
NextAuth library-error records instead of raw error metadata. Freeze the emitted
field contract before implementation: server-generated correlation IDs; known
method, action, provider, audience, event, outcome and error-category values;
route templates instead of request paths; nonnegative elapsed duration; and
existing host-reduced destinations. Unknown categorical values become a bounded
`other` category. Neither request IDs nor arbitrary paths come from incoming
headers. Library error/warn/debug channels and direct participant/affiliation
errors must omit messages, stacks, causes, IDs and metadata. Preserve useful
bounded success/failure outcomes. Transaction/code/state, cookies (including browser
binding), CSRF bodies, credentials, Authorization and Referer values belong
outside logs. This applies to local app-owned output; controller, collector and
platform/device log verification are separate acceptance boundaries. Ingress
class labels do not identify controller distribution or version. No generic
NGINX annotation is evidence of redaction on an unknown controller.

### Pilot primitive and privacy impact

| Product primitive | Disposition | Contract and evidence |
| --- | --- | --- |
| Lecturer authentication session | Extend existing abuse protection | One existing native session lifecycle; per-client quota behind explicitly trusted proxies. Identity, authority, revocation and expiry stay in ADR 0055. |
| Auth outcome telemetry | Reuse with minimization | Keep bounded diagnostic outcomes; omit request and credential material. No new analytics purpose or persistent IP store. |
| Course and live-quiz access | Reuse | Existing permissions and safe-command behavior remain authoritative. |

Privacy defaults preserve security-purpose processing and the existing retention
periods. Raw addresses exist only while resolving the request and become keyed
digests before counters are written. Logs use bounded metadata. There is no new
purpose, sharing audience, consent mechanism or personal-data schema. Accuracy
is protected by strict IP parsing and trusted-hop checks; fairness by separate
client-address buckets where addresses differ. Integrity uses fail-closed configuration. Accountability rests
on protocol, sentinel-log and configuration evidence. Deployment owners retain
responsibility for gateway/collector retention and the applicable processing basis.
ADR 0055 owns the durable trust and logging decision; its exact update follows
architecture hardening before implementation.

### Delegation Map and commit boundaries

Main owns proxy/privacy decisions, dependency/config integration, ADR 0055 and
final acceptance. Retain the coupled P1 implementation in main because its
trusted-hop semantics and quota seam are the immediate architecture decision.
P2 has a disjoint writer. A trusted read-only explorer has completed the logging
map. Reviewers are read-only and independent of writers. Existing unrelated
manifest edits remain outside every write and review scope.

| Slice | Assigned owner | Dependency, acceptance and source scope |
| --- | --- | --- |
| P1: native client-address quotas | Main | After architecture consultation and plan hardening, update ADR 0055 before code. Extend existing `nativeSessions.ts` and `native-session.integration.test.ts`; one exact `ipaddr.js@2.2.0` dependency, package/lock, `turbo.json`, chart values and auth ConfigMap. Preserve HMAC/TTL and limits. Prove trusted-hop selection, spoof resistance, strict failures, canonical addresses and independent real-Redis quotas. |
| P2: app-owned auth log minimization | Trusted generic native Codex executor, carrying the bounded executor contract | After the same ADR contract, own only `apps/auth/next.config.mjs`, the auth catch-all handler, `apps/auth/src/lib/telemetry.ts` if runtime field validation requires it, the existing `apps/auth/src/lib/helpers.ts` log sinks and `apps/auth/src/lib/util.ts` notification-failure log, and existing `auth-callback-journey.integration.test.ts`. Main integrates. Cover library and direct application failures plus hostile request-controlled fields. All emitted records omit synthetic secret markers and retain bounded useful outcomes. |
| P3: pilot and delivery packet | Main | Update this plan and `native/control/README.md`; no new source or document files. Prepare exact device, gateway, disclosure, signing and publication prerequisites and recovery. Run owner-operated qualification only when every prerequisite below is satisfied. |

Maintained test portfolio: **extend existing** native integration tests for two
proxy clients reaching independent 20-start quotas, spoofed/untrusted headers,
malformed/missing/duplicate/all-trusted chains, mapped/canonical addresses and
unchanged exchange/cancel/revoke availability. **Extend existing** callback
journeys with actual NextAuth and direct application failures carrying synthetic
sentinels, plus hostile request IDs/path/provider values; assert absence of
sensitive material and presence of bounded outcomes. No content/snapshot tests.
If the existing request double needs socket/raw-header support, extend
`apps/auth/test/helpers/auth.ts` minimally under main ownership before P2 starts.

New automated tests: **none** for chart wiring, documentation or device/signing
qualification. One-time evidence: render with synthetic CIDRs and verify the
exact environment contract; capture only newly produced app log output for
synthetic requests and report marker presence without raw records. Existing auth
and affected backend checks remain required. Verify the auth/redirect journey in
a browser; capture before/after evidence for the existing flow. No visible UI
change is planned, so no new PR screenshot gallery applies to these source fixes.

### Real-pilot prerequisites

The pilot starts only after matching auth/backend versions are reachable over
trusted HTTPS, actual proxy forwarding/CIDRs are qualified, and gateway/collector
redaction plus transient handoff/quota retention evidence is accepted. Keep the
B1 physical-device scenarios, using current ADR 0056 expiry/logout semantics: institutional success, cancel, replay,
expiry, logout, delegated scope, lock/background/reopen and network interruption.
The owner performs edu-ID entry. Record pass/fail at each boundary; never infer
physical-device behavior from Simulator results.

The native disclosure must be reviewed and updated before real accounts take
part. Its existing destinations are `apps/docs/docs/datenschutz.mdx` and the
English translation `apps/docs/docs/privacy_policy.mdx`; proposed wording belongs
in the preparation packet until its controller approves publication. Cover
system-browser authentication, device-only Keychain, the fixed 30-day credential
and local logout from ADR 0056, short-lived transaction/quota metadata,
retention/backup limits, offline behavior
and analytics defaults. Device trust installation, deployment or signing-resource
mutations require their exact authority even when other prerequisites pass.

### Pilot authority and completion

This approved continuation covers local source fixes, pinned dependencies,
configured reviews, synthetic tests/builds, local commits, read-only device and
signing readiness checks and preparation of a reviewable delivery packet.
Cluster connectivity/configuration, production reads, deployment, real edu-ID
credential entry, signing-account/certificate changes, uploads, tester invitations
and distribution remain separately named effects. Human IdP authentication stays
with the account owner. Keep the existing local runtime available for manual tests.

Publication still respects the existing six-layer stack. Prepare the selected
follow-up packages locally and verify their boundaries; do not append a seventh
layer, silently build ordinary chained PRs or mutate the existing topology.
Actual publication needs predecessor landing or approval of a concrete supported
topology. A source-complete package is not shared-pilot or store acceptance.

Terminal: locally verified source remedies and a reviewed, concrete device/
signing/publication packet; execute any already-authorized branches whose actual
prerequisites exist. Report exact remaining device, gateway, account or topology
requirements instead of claiming acceptance from simulator or rendered config.

### Pilot progress

Source discovery is complete. Native planner hardening approved the revised
continuation on round two after four verified corrections. Architecture
consultation is running through a trusted native Codex advisor, explicitly
authorized by the user on 2026-10-24 after the Claude session limit. The same
user-selected native route covers the required risk and final reviews.
P1 is committed at `5bb369b750` with 99 native cases and normal Git checks
passing. Native risk review found no source findings; simplification removed an
unused test-helper option. P2 is committed at `e5ae4d5167`. All 157 auth cases, auth type checking and the
production auth build pass. Normal hooks passed 42 type tasks, seven lint tasks,
syncpack, secret scanning and 94 host checks. A fresh synthetic log probe found
no request markers and did retain bounded outcomes. Browser delegated login
and the Control course list were verified against the stable source. P2 simplification found no further reduction. Risk review identified a
misleading invitation-completion event after caught failure; its redundant caller
events were removed. Helper request-ID propagation was declined as an additional
observability seam outside the approved log-minimization contract. Focused risk
verification and integrated final review pass for the final source range. The README and private preparation packet identify device, disclosure, gateway,
signing and publication prerequisites. The user-authorized native advisory and
review route resolves the earlier capability blocker.
The existing runtime and Simulator remain retained for the requested manual test.

Architecture checkpoint: trusted native Codex advisor completed with concerns
about app-owned helper log sinks, accepted into P2. The advisor confirmed the
trust design and start-only failure scope. Keep ipaddr.js2.2.0 because strict
Node validation and prefix grammar exclude the identified parser validation
issues; no demonstrated behavior requires changing the selected version.

The local preparation packet is ready: device/login matrix, disclosure topics,
reachable matching endpoints, gateway/collector and Redis backup/retention
evidence, signing ownership, distribution authority and recovery. No native PR
is published because the predecessor remains open and the existing topology
ruling still applies. Publication, real-device and shared-deployment acceptance
remain open; no simulator result or app log check substitutes for them.

Integrated final review identified zero-prefix trust ranges that could accept
caller-selected addresses across families and an empty invitation query logged
as found. Both corrections stay within the approved source contract: reject
zero-bit ranges after normalization, and emit a bounded empty-result outcome.
Existing test tables/helper journeys cover those cases. Final review passes for
`7019d4bcb5..8a792f18dc`; all 157 auth cases pass, with 102 native cases and 18
callback journeys. The same independent reviewer verified both corrections.
Source preparation is complete locally; no native PR, shared deployment,
physical-device pilot or distribution acceptance is claimed.


## Approved HIG roadmap execution (2026-10-24)

### Approval summary

The user approved execution of the reconciled mobile roadmap with a native goal
and periodic Claude Opus 5.5 feedback. Approval mode: executable batch. This
continuation delivers the existing lecturer workflow with accessible input,
responsive text, system appearance/motion support, honest recovery states,
localized edge screens, readable data and complete native identity assets.
Capacitor, bundled Next query routing and ADR 0055 remain the architecture.

Authority covers source implementation, synthetic local checks, native Simulator
builds, local commits and configured reviews. Preserve existing personal signing
and private device-test configuration; do not stage those unrelated changes.
The roadmap's explicit stack/publication ruling remains binding. No merge,
force-push, stack modification, signing-account change, deployment, real-account
access, TestFlight upload or store distribution is authorized here. Optional
account/help, navigation retention, sidebar, haptics, shortcuts, OTA and offline
content remain candidates, not mandatory implementation.

Terminal: all unblocked R2/R3 source outcomes are implemented and locally
verified; every finding has evidence or a concrete device/environment/product
prerequisite. Required physical/institutional and distribution acceptance stays
open until actually exercised. A pending check is never marked passed. Main owns
integration and continuation; boundary owner: self. Execution mode: standard.
Existing source baseline is `64063dc65caa6106b6a7e47f2739f1ea4a35483d`.

### Primitive impact and preservation

| Product primitive | Disposition | Contract and evidence |
| --- | --- | --- |
| Lecturer session | Reuse | ADR 0055 proof binding, expiry, scope, Keychain and revocation stay authoritative. Improve only cancellation/expiry presentation; never change issuer policy. |
| Live quiz command | Compose | Existing mutations compose with connection/authoritative-refresh state. Offline/unknown state blocks commands with an explanation; never queue or blindly replay a command. |
| Projection configuration | Reuse | Describe local change/server persistence accurately; do not claim projector acknowledgement without such a signal. |
| Q&A and audience feedback | Reuse | Preserve moderation permissions, time window, meter/status semantics and existing labels while making reading/input accessible. |

No new durable product concept, migration or persistent user-data store is
needed. No new ADR is currently required; changes to session or installed-client
support policy return to the actual decision boundary.

### Ownership, slices and acceptance

The current artifact root and existing branch/worktree remain unchanged.
Main owns architecture, native scaling proof, globals, auth presentation,
localization integration, connection recovery, packaging, runtime and final
verification. Bounded trusted executors may own disjoint settled component work.
Main keeps unresolved native/routing seams because of critical-path coupling.

| Slice | Route and intended paths | Acceptance and commit boundary |
| --- | --- | --- |
| H0: prove native scaling | Main; ignored technical probe only, then `native/control/ios/App/App/ViewController.swift`, existing Control globals/app root if needed | Compare normal/maximum text after live change and cold launch in actual WKWebView; choose the smallest verified mechanism, with no speculative plugin dependency. Local probe changes are not shipping code. |
| H1: reliable accessible controls | Trusted executor for `components/common/ResponsiveSheet.tsx`, `styles.ts`, `session/SessionTabs.tsx`, `session/LeinwandCard.tsx`, `session/AudienceFeedback.tsx`, `session/QAPanel.tsx`; main integrates actual call sites | Localized names, comfortable hit regions, visible focus, complete keyboard/panel behavior and focus return. Preserve meaningful dismissals; remove unsupported grabber. Browser interaction captures plus focused check, then one source commit. |
| H2: system text/appearance/motion | Main; Control `globals.css`, `_app.tsx`, existing component pixel typography, native view controller if H0 needs it | Actual native scaling at live/cold sign-in and authenticated screens; light/dark/contrast, reduced motion, reachable actions at compact sizes. No unverified CSS-only conclusion. Separate source commit. |
| H3: honest status and recovery | Main; `pages/session/[id].tsx`, `session/LeinwandCard.tsx` after H1, `pages/login.tsx`, `lib/nativeSession.ts` only cancellation classification, existing i18n locale files; new focused command recovery test allowed in existing test harness | Offline before/during/after refresh and API failure while network reports online; authoritative refresh before commands, no replay. Quiet confirmed cancel, distinct expiry and actionable loading/not-found. Existing auth/recovery tests extended only for consequential behavior. Separate source commit. |
| H4: readable localized screens/data | Trusted executor after shared component integration; `pages/404.tsx`, `pages/course/[id].tsx`, `Layout.tsx`, `PageContainer.tsx`, `AppBar.tsx`, `HomeHeader.tsx`, `ListRow.tsx`, `RunningQuizBanner.tsx`, `LiveQuizList.tsx`, `LiveEvaluationCard.tsx`, `StatsPanel.tsx`; main owns i18n and `apps/auth/src/pages/native/complete.tsx` | Main/loading semantics, EN/DE document/fallback/auth/close names, full useful titles, compact/notched landscape, structured populated chart values and test-owned Q&A. Preserve Next announcer and existing textual data. One coherent source commit. |
| H5: native release completeness | Main; existing asset catalog/launch storyboard, `native/control/README.md`, native config and existing release checks; add only a named native bundle qualification script if a real release invariant lacks protection | Replace template icon with existing licensed Klicker artwork; launch continuity. Inspect required-reason APIs/SDK manifests and declared capabilities before any edit. Validate local Release build/asset identity/endpoints; report signing/upload/older-OS and support-window prerequisites. Separate packaging commit. |
| H6: integration and qualification | Main plus Opus 5.5 final review; existing plan/roadmap and ignored capture evidence | Source/type/lint/build checks, real EN/DE phone/tablet captures, native settings and synthetic lifecycle checks; resolve reviewed issues. Record hardware/institutional/archive/distribution gaps separately. |

H1 is disjoint from main's H0 probe. H2 consumes H0 and H1 integration. H3/H4
serialize overlapping components/locale files. H5 assets can be prepared after
layout decisions; H6 evaluates one integrated immutable source range. No new
stack layer is created. Source refinements may split a slice for reviewability
without changing topology or requesting another generic approval.

### Feature-wide test portfolio and review cadence

| Consequential behavior | Test obligation and seam | Evidence owner |
| --- | --- | --- |
| Silent offline command or replay after uncertainty | Extend an existing behavior harness or add one focused synthetic browser regression; control API request counts and server refresh outcomes, not prose | Main H3 |
| Incorrect native login cancel/expiry classification | Extend existing native/auth test seam only when behavior changes; preserve protocol assertions and secure cleanup | Main H3 |
| Missing names, broken keyboard/dismissal and unreachable scaled actions | Browser/Simulator acceptance; no text/class/snapshot assertion tests | H1/H2/H4 owners, main verifies |
| Loss of chart information | Synthetic populated response data in harness, actual accessibility tree and structured label/value reading; no production fixtures in app code | H4, main verifies |
| Shipping wrong assets/origins or operation incompatibility | Inspect built artifact and existing contract checks; add only missing consequential release invariant. Support-window choice is not inferred from source | Main H5/H6 |

Use `design-with-apple-hig`, `rs-ux-review`, repository UI conventions,
`accessibility-compliance`, `rs-find-docs` for version-sensitive APIs,
`rs-build-screenshot-gallery`, `agent-browser`, and native build/test tooling as
needed. First harden this derived execution contract; the user already approved
its parent roadmap. Obtain Opus feedback at planning, after shared controls and
native preferences integrate, and at the final committed range. Correct
verified concerns without restarting the batch. Dedicated simplification and
risk review follow the full-path slice gates, preserving trusted boundaries.

### Planning checkpoint disposition

Opus 5.5 returned REVISE with eight bounded refinements, accepted for this batch.
Stage personal Xcode files only by hunk and keep team/private endpoint values
out of commits; verification must identify the pre-existing manifest overrides.
Main H2 owns runtime `html.lang` and lands typography before H4 starts. H1
reuses existing locale keys; main adds any missing Control-specific keys before
its verification. H0 tests accessibility maximum, live and cold launch, and the
resulting real Control bundle; the system auth browser is outside that mechanism.
H3 uses request-level uncertainty and network-only successful post-uncertainty
refresh, checks Apollo mutation retry behavior and revalidates on foreground.
Only confirmed cancellation is quiet; late exchange cleanup and revocation
remain mandatory. H4 uses a test-owned GraphQL fixture harness or real synthetic
responses for each chart type, never production fixture branches. H5 inspects
actual Release artifacts and SDK manifests without modifying personal signing.
Date convention is preserved, minimum-OS qualification/support policy stays open,
and a new third-party native dependency would need a named scope decision.

Planner follow-up: H0/H2/H3/H5/H6 belong to main; H1 and H4 belong to trusted
executors with the exact relative paths in their rows rooted at
`apps/frontend-control/src/`. Main retains every i18n/native/auth file. H2
serializes all typography before H4. New probe files are ignored
`project/_local/reviews/control-hig-execution/DynamicTypeProbe.swift` and its
app bundle; no new shipping module is planned. H3 test obligation is
`extend existing` at `playwright/tests/C-control.spec.ts` for request outcomes,
and `add new` at `apps/auth/test/control-native-client.test.ts`, run through the
existing auth Vitest unit project. This test imports the Control client module
with mocked native/storage/fetch boundaries to protect cancellation outcome and
late-exchange cleanup. Existing server tests do not cover client classification.
No new runner or application dependency is introduced. Other rows use `none` for new automated tests and
browser/native acceptance; H5 initially uses `none` and inspects real artifacts.

H5 Release route: rebuild static assets with production defaults, sync the
existing iOS project, then host `xcodebuild -configuration Release -sdk
iphonesimulator -destination 'generic/platform=iOS Simulator'` with ad-hoc
signing, explicit source/build provenance, and the existing project. For an
unsigned device archive use `-configuration Release -sdk iphoneos
CODE_SIGNING_ALLOWED=NO`; do not enable provisioning or alter personal settings.
Inspect the product's embedded Capacitor config, compiled JS endpoint allowlist,
asset catalog, capabilities and privacy manifests. Preserve a separately
identified development bundle for user testing. Personal Xcode values are
excluded by command-line build inputs or an ignored copy of the project when
necessary; do not claim a shipping archive while they contaminate it. Actual
store validation, oldest-OS/hardware and support-window policy remain explicit.

### HIG execution progress

Source work is implemented locally through `bdcf93a645`; the preserved audit
reports are committed at `44d965f912`. The approved planning
record is `1e2d82ff1c`; the integrated HIG source is `6f9731fd2e`, native identity
assets are `3baf00ca33`, and browser-measured target corrections are
`b42e6a922a`. Reviewed Q&A/projection recovery is `fb553ac0a4`. No new PR or stack layer was published. The predecessor topology
restriction still applies.

H0 proved live/cold WKWebView system-body scaling17px to53px. H1/H2/H4 now
provide named44px controls, keyboard tabs/panels, sheet focus return, native-only
Dynamic Type, dark appearance, reduced motion, semantic contrast, full names,
EN/DE document language, localized404/auth and structured chart values. The
actual Release Control sign-in follows maximum system text live/cold and native
Dark Mode. Authenticated maximum text and hardware VoiceOver remain open.

H3 adds explicit offline/recovery status, stable retry/not-found screens,
authoritative refresh after uncertainty, truthful server-persistence wording,
quiet confirmed cancellation and distinct expiry/storage/revocation outcomes.
The actual hosted browser passed immediate/settled offline blocking and recovery.
The native client regressions protect cancellation classification, shared cleanup
and late exchange revocation. No schema, login trust or command retry contract
was expanded.

H5 replaced template identity assets with existing brand artwork and an adaptive
launch background. Production-default export, Release Simulator build and local
unsigned device archive pass. Artifact inspection finds production endpoints,
no server.url, no registered service worker or source maps. Scoped required-reason
API inventory corrected the stale UserDefaults assumption: Control's marker uses
FileManager. No new privacy declaration was justified by that inventory. Actual
signed validation, OS support/version/build and institutional release environment
remain qualification gates.

Verification:106 focused auth tests,42 workspace type/build tasks, lint,
staged formatting, syncpack and normal Git hooks pass. Fifteen hosted EN/DE
captures cover390portrait,667compact landscape,700/740breakpoint,768tablet
and1133desktop, light/dark; none has horizontal overflow or measured controls
below44CSSpx. Arrow-key tabs and Escape focus return pass. The full existing
Control workflow now passes all five tests through the canonical host launcher,
with the retained database preserved and normal Manage quiz creation. It covers
quiz commands, two-page feedback updates, audience settings, offline blocking,
lost close-response recovery without replay, and cleanup. The test now waits for
the session route and controls before checking back navigation. A separate test-owned GraphQL harness passed populated charts, Q&A, keyboard/modal
and EN/DE narrow checks across30captures. Lost answer and projection-save
responses each sent exactly one mutation and recovered by fresh reads without
replay. Four later dark/hover captures pass after the Opus corrections.

Opus5.5 planning and integration advice were applied, including stable error
rendering, native-only system typography, projection wording, expiry detection
and cancellation deduplication. Trusted source simplification found no justified
net reduction. Risk review found two recovery gaps; both were corrected and its
follow-up approved `fb553ac0a4` without new findings. Integrated Opus final review
at `44d965f912` found three issues: inherited leading reset, dark chart contrast
and misleading concurrent-action status. All are accepted and corrected at `2a00e531a0`; focused type/lint and normal
Git checks pass. Four final EN/DE dark captures show6.87–9.91:1 chart/progress
contrast and8.72:1 selected-hover contrast. Hosted leading is16px/24px.
Rapid actions send one mutation and show a neutral pending notice. The single
Opus correction check initially encountered approval and sandbox capability
failures. Explicit authorization and the host retry resolved those blockers.
Opus confirmed all three original fixes and the reflow correction. Its sole
low-severity finding, stale source-boundary references in these documents, is
corrected in this update and closed through main-session verification.

Evidence: `project/_local/reviews/control-hig-execution/manifest.json`,
`index.html`, `offline-final.json`, `focused-checks-5.log`, normal commit logs,
`native-release-final-build.log`, `native-unsigned-archive.log`,
`packaging-qualification.md`, and separate populated-data harness. Captures stay
ignored/local. Runtime/source identity and review results must be recorded before
closing the package.

Remaining external qualification: actual edu-ID and hardware lifecycle/expiry/
account-switch matrix; VoiceOver/Full Keyboard Access, authenticated maximum
text, notched landscape, oldest supportedOS; chosen installed-client support
window, additive persisted-operation retention and candidate/rollback rehearsal;
release identity/build, privacy/disclosure, signed archive validation and later
separately approved distribution. No local smoke/build result passes those gates.

Runtime retained for the user's explicit local/manual testing request. Compatible
task-local Devrouter0.5.4 is used without changing global tools. Initial old-CLI
and profile-readiness failures were recovered through supported stop/ensure;
retained database/data was preserved. The existing native Simulator test instance
is also retained. Fifteen pre-existing manifest overrides and personal Xcode
team/bundle/deployment edits remain outside commits.

Local Release archive refresh: `Control-reviewed.xcarchive` was rebuilt from
`44d965f912` with production defaults, no signing team and no code signing.
The inspected artifact retains the canonical bundle ID, production auth origin,
logging disabled and no remote server URL. It is an unsigned local artifact,
not an upload-validated candidate. The reviewed development bundle was rebuilt
separately and installed/launched in the retained Simulator. Native system-browser
cancellation returned quietly to sign-in. No real account was used.

A focused Opengrep scan ran210rules on40files. Its sole finding is an
unchanged HTTP-to-WebSocket development fallback in `apollo.ts`; the HTTPS path
uses WSS and bundled native transport is separate. No new finding was introduced.

Historical pre-reflow checkpoint: `50bc9561ec`. The current source correction is
`bdcf93a645`; the following artifact predates that reflow correction.
The corrected production artifact `Control-opus-reviewed.xcarchive` builds from
`2a00e531a0`; the corrected development app also builds, installs and launches
in the retained Simulator. Final maximum-text leading was inspected separately.
User testing runtime and Simulator remain running under the original request.

Retained-client qualification compared nine local iOS apps, from the original
prototype through `Control-opus-reviewed.xcarchive`. Every embedded operation
map matches the candidate generated map: all 386 hashes remain available, and
each app's HTML references its map-containing JavaScript chunk. The oldest
native-login app's 22 named operation definitions resolve through that map.
This proves packaged hash retention; it does not prove business execution,
historical backend rollback, or the pending supported-client window.
Detailed artifact digests are in the ignored `installed-client/qualification.json`.
An isolated harness using the installed Yoga plugin and actual production
options passes GET/POST known-hash execution and rejects unknown or unhashed
requests without resolver execution. All retained hashes also resolve through
the unchanged candidate map in the real plugin, stopping before parsing or
application execution. GraphQL errors use HTTP200; transport status alone is
not acceptance. `installed-client/yoga-run-receipt.json` records the run and limits.

The actual development app's sign-in screen also remains reachable in both
notched landscape orientations. Authenticated landscape and maximum-text
flows remain unqualified. Authentication was cancelled at the terms-consent
screen without accepting an agreement; portrait was restored afterward.

Later H2 acceptance found a defect beyond the earlier 24px proxy: at the actual
measured maximum 53px root, the synthetic session's sticky header grew to 1144px
and covered the primary action. The source correction keeps layout spacing
stable, wraps localized control groups, and moves enlarged navigation/commands
into a single scrolling column. Text remains full size. A rem-sized observed
box also detects live text changes when a short header's height stays constant.
The 28→16 and 16→28 short-title cases now restore the intended layout, and the
existing Control workflow protects those transitions plus 53px pointer access.
Fourteen EN/DE proxy states pass with reachable sampled controls and no main
scroll-container overflow. German modal text also wraps within its scroll area.
This is reflow evidence; authenticated native acceptance remains open. The
updated static/native artifacts and final review must be refreshed for this
correction before closing the package.

Packaging qualification also built an isolated copy of all 23 committed native
project files, excluding the personal Xcode settings. Both unsigned device
archive and ad-hoc Release Simulator compilation pass at the tracked iOS 15.0
minimum with the previously inspected production UI assets. Xcode's processed
archive plist requires arm64 already; the source armv7 entry does not justify a
shipping capability fix. Actual oldest-OS execution and signed validation remain
open. This artifact predates the later reflow correction and needs new UI assets.

The reflow correction is committed at `bdcf93a645`. Its full Control workflow
passes all five tests, including observable live text-size anchoring and the
maximum-text pointer checks. Normal hooks pass 42 workspace checks, lint,
formatting, syncpack and 94 host contracts. The same trusted risk reviewer
closed the reproduced short-header observer finding after correction. An
independent simplifier found no justified net reduction; this is separate from
the required Opus correction continuation.

Production export and `Control-final-reflow.xcarchive` now use this source.
The archive contains identical export bytes, canonical identity, production
auth/API origins, no remote server URL, logging disabled, the same 386 accepted
operation hashes, iOS 15.0 minimum and processed arm64 capability. It remains
unsigned. A matching production Release Simulator build also succeeds. The
separate local-endpoint development build is installed and launched in the
retained Simulator; actual native sign-in maximum text passes live/cold and
dark inspection. Settings are restored to large/light and portrait. No real
account or institutional acceptance is inferred.

Current evidence is `final-reflow-inspection.json` and
`large-text-layout-spike/` under the existing ignored review folder. The
original audits and earlier artifact results remain historical evidence.
The acceptance audit keeps authenticated native text/landscape, VoiceOver,
oldest OS, institutional lifecycle, numeric support-window/rollback policy,
signed release and distribution qualification open. The final Opus scope includes
the reflow correction through `5b5cc22706`; the earlier permission request is
resolved by explicit authorization. Predecessor
[PR #6539](https://github.com/uzh-bf/klicker-uzh/pull/6539) remains open at the
fresh forge check. No publication/topology action is taken.

The authorized Opus correction check first returned schema-valid `blocked`:
its configured Bash hook was missing and the evidence paths were relative.
Main supplied exact absolute paths, both committed diffs and all 39 immutable
Git blobs through the working read-only file tool. The sandboxed continuation
then reported `401 OAuth access token has expired`. At the user's request, the
same check ran outside the sandbox and completed successfully without another
sign-in or client-configuration change. The successful host run reports only
`claude-opus-5-5` model usage.

The final report is `opus-final-correction-final.json` in the existing ignored
review folder. Opus repaired its invalid confidence and autofix enum values;
all other report content is unchanged and canonical schema validation passes.
The report covers the full immutable range through `5b5cc22706`, confirms all
three original corrections and the reflow fix, and returns one low-severity
documentation finding. Main verified and corrected all three stale source
references, and confirmed and repaired the roadmap table's missing column
separators. These non-behavioral documentation changes close through main-session
inspection; no further source-review round is needed or claimed.

The source remains `bdcf93a645`; this update changes qualification records only.
Fresh source-filtered route inspection finds seven running routes and Control
returns HTTP 200. The existing Control Login Test Simulator remains booted.
Both are retained under the explicit manual-testing request. All other device,
support-policy, predecessor-stack and distribution prerequisites remain open.

Terminal reached for the approved local HIG batch: all unblocked source outcomes
are implemented and locally verified, the required review is complete with its
finding resolved, and remaining device/environment/product prerequisites are
explicitly recorded. Source, tests and built artifacts retain their prior
identity; this closeout changes qualification records only. No new PR exists for
this batch, and the existing publication restriction remains binding.

## Approved continuation: qualified TestFlight preparation (2026-10-25)

### Approval summary

The user approved finishing browser-local policy acceptance, resolving source
publication into the Control stack and progressing toward a qualified TestFlight
pilot. Preserve the current working iPad pilot and the existing native login
contract. This batch closes source/local qualification work that is executable
now and prepares the exact remaining release decisions. It does not imply that
local verification qualifies TestFlight distribution or App Store acceptance.

The existing six-layer stack remains open. No seventh layer, predecessor merge,
reordering, forced push, readiness change, enrollment purchase, signing-account
change, TestFlight upload/tester invitation or production activation is included
in this general approval. Resolve a concrete supported publication topology and
any account/device actions before taking those dependent steps. The original
three-package follow-up remains the recommendation unless a reviewed alternative
is explicitly approved.

Terminal for this finite batch: login owner finishes the browser-local update;
current source/build evidence and local production bundle qualification are
recorded; actual publication/signing/device prerequisites are identified; an
Opus5.5-reviewed preparation packet gives exact next actions. If all prerequisites
are present, continue the separately authorized branch; otherwise finish all
independent work and ask only for the named missing decision or human test.

### Execution details

Execution mode standard. Exact worktree remains
`/Volumes/HOME/Git/klicker/klicker-uzh/trees/review-control-stack-6539`, branch
`enhance/control-native-login`. Baseline now includes UI/date correction and
browser-local acceptance commit `c6c529af6c`. Preserve the 17 unrelated manifest
and personal Xcode modifications. Host fetch refreshed origin/v3; actual stack
target remains v3-ai. Do not integrate unrelated target drift without a concrete
readiness reason.

Delegation Map and sequence:

| Workstream | Owner | Acceptance |
| --- | --- | --- |
| Browser-local policy update | Existing Klicker Login task, 01a1740c-273f-7111-8c95-b9bcc2f6d538 | Existing EN/DE persistence/gating checks, normal commit hooks, retained local auth process running the production build at its verified commit; no DB changes |
| Publication and release decisions | Main | Host gh stack6540 topology, inherited/source range and coherent package boundaries; no unsupported topology mutation |
| Scoped native gap inventory | Trusted Codex investigator, 01a17475-d796-72b2-b89f-85c39360a5e1, read-only | Committed source/artifact settings and concrete check/owner matrix; no personal signing details |
| Current local native artifact | Main | Build production static assets in retained container, copy only generated assets to ignored isolated project, validate canonical endpoints/assets/source provenance and unsigned Release archive |
| Preparation packet review | Opus5.5 | Exact evidence, no unsupported readiness or authority claim, no unaddressed consequential source issue |

Dependencies: login completion freezes the artifact source. Inventory,
publication findings and artifact evidence feed the main-owned preparation packet
in this same plan; Opus reviews that integrated packet. The packet must name
source SHA, build inputs, artifact digest, proof limitations and each remaining
human/product/signing gate. Newly available prerequisites do not authorize a
topology change, distribution or activation.

Test obligation: none for preparation, publication analysis or artifact packaging.
Reuse the existing login/HIG tests and perform the named artifact inspection. A
consequential source correction requires a bounded scope and revised acceptance
before implementation.

The affected product primitives are reused: lecturer sign-in/acceptance remains
owned by the login task; native handoff and 30day device credential keep their
current policy; installed-client/backend compatibility and signed release remain
separate qualification boundaries. This continuation creates no user feature,
schema, session registry, dependency or new production abstraction.

Reuse passing auth/HIG/browser/native evidence where relevant source and inputs
are unchanged. The consequential new check is the current production-default
bundle/artifact, since local device pilot endpoints differ. No new maintained test
is warranted for documentation/preparation. Retain live manual-test servers and
private routes under the user's testing request. Do not run cap sync against the
working native project or overwrite installed pilot assets. Host Xcode uses the ignored isolated project
`project/_local/reviews/control-testflight-preparation/inputs/native/control/ios/App/App.xcodeproj`.
Populate its sources from the frozen tracked native tree, not personal Xcode
edits. Copy the generated production static export into its App/public and
generate its App/capacitor.config.json explicitly with canonical app ID, no
server.url, logging none and production ControlAuth origin. Include the existing
generated Cordova config.xml and verified SecureStorage plugin class registration.
Record every generated input digest. Preserve the working project's generated
assets/configuration and installed pilot. Archive to
`project/_local/reviews/control-testflight-preparation/Control-production-current.xcarchive`;
all logs/provenance/inspection receipts stay in the same ignored evidence folder.
Pass unsigned signing inputs, canonical bundle and explicit deployment target15
from the tracked baseline; verify actual built minimum without claiming oldest-OS
execution. No changes to personal signing resources or installed app.

Current nonsecret signing capability: development identity present, distribution
identity absent. asc CLI not installed; do not install/configure it without an
explicit setup request. The user confirms access to an organization Apple
Developer Program team. Xcode's current project still lists only Personal Team;
organization visibility, bundle ownership and signing permissions need verification.
No account secret or identifier is needed in repository artifacts.

### Progress

- Live stack6540 has six open layers, top draft PR6686. Local branch is not
  registered as a stack layer and is a descendant of its top. No stack mutation.
- Login task completed `c6c529af6c`; old acceptance ignored, new accept/uncheck
  persist, and retained local auth process serves the updated production build.
- Scoped inventory and current artifact qualification are complete; source and
  effective iOS15 minimum are recorded in adjacent artifact-inspection.json.
- Planner approved the refined continuation. Opus completed the preparation
  review; its three documentation findings are corrected in the follow-up.
  Focused correction verification and normal commit checks finish this checkpoint.

Preparation inventory reconciled: current native sources support iOS15 and the
SDK/toolchain is Xcode27. The completed archive confirms minimum15.0. Current numeric
version/build is1.0(1); uniqueness and final release identity require the intended
App Store Connect record. The available iPad mini is valid for the iPad pilot;
phone-only layout/oldest-OS gaps remain separate, not a demand for a new device.
An earlier active pilot prerequisite still described the superseded revocable
12-hour session; this preparation corrects it to ADR0056 fixed30day/local logout.
No legal document is edited or published by this correction.

### Current preparation packet

The browser-local acceptance package is complete at `c6c529af6c`: the new document
pair key ignores prior acceptance, accept/uncheck persist locally, and the local
private auth process serves the production build. Existing authenticated sessions
are not forced to return to login, as explicitly clarified by the user. Reuse
the login owner's type/lint/format/build/hooks/browser results.

A new isolated unsigned device archive was built from that exact committed
source with production-default static assets, Xcode27/iPhoneOS27 SDK and explicit
iOS15 target. Effective identity is `ch.uzh.klicker.control`, version1.0 build1,
minimum15.0, device capability arm64, scene lifecycle and callback scheme present.
Native logging is none. The archive has no server.url, local endpoints, service
worker registration or source-map references. Both canonical auth/API constants
are present. SecureStorage plugin registration is retained, and Capacitor/Cordova
privacy manifests are embedded. This proves local packaging, not App Store
privacy answers, signed entitlement validation, install/upgrade or upload success.

Artifact:
`project/_local/reviews/control-testflight-preparation/Control-production-current.xcarchive`.
Generated input provenance, archive log and artifact-inspection.json are adjacent.
App tree SHA256: `4c3c69e227015d04865dad40422fa301ea678b0bafe3dadacb7e5bef5d90b115`.
Static asset tree SHA256: `a496d28631290f845d9ae390c8c38d87013732407eaf9ae05358ac006e11ca18`.
Source and local pilot generated assets/configuration were compared by digest
and remain unchanged. This archive was not installed over the user's pilot.

Build observations: the compiler reports one weak/strong capture warning in the
existing auth plugin and a skipped AppIntents extraction for a non-AppIntents
app; neither failed archive creation. No signing identity, device identifier,
private endpoint, credential or production-derived data is recorded here.

#### Publication disposition

Host gh confirms stack6540 targets v3-ai with open6536→6537→6538→6509→6539→6686;
6686 is the existing draft audience-feedback package. Its test/build jobs pass,
but final-ai-stack-review reports ERROR because the layer remains draft and
final-ai-review is PENDING. Lower layers6537,6538,6509 and6539 also have failed
or errored check/Sonar/AI gates. A representative required check fails because
its filter was cancelled; that does not establish a source defect. Green jobs
on the top layer prove neither stack readiness nor the unpushed native follow-up.
Repairing predecessor checks or marking a layer ready is outside this preparation. Local current
source descends from6686 and adds the bundled app/auth/HIG work. The roughly7,800
added non-project/lock/icon lines cannot be truthfully described as an incidental
feedback-only amendment. No predecessor branch, title, topology or readiness was
changed. The current six-layer cap is an explicit prior plan boundary.

Recommendation remains: retain Max's stack and publish the three coherent native
packages into actual v3-ai after the predecessor lands under its normal review
and explicit merge authority. A request for earlier publication needs an exact
reviewed topology decision; appending a seventh layer or hand-building dependent
ordinary PRs is not part of this approval. The current batch cannot land that
predecessor itself. No source push or new PR is claimed.

#### Remaining prerequisites and owners

| Gate | Owner and required proof | Current state |
| --- | --- | --- |
| Distribution identity and App Store Connect | Intended Apple Developer Program team/account owner; confirm bundle ownership, record and unique build, provision signed archive | User confirms organization membership; organization not yet visible in project team selector; local distribution identity absent; asc unavailable |
| Institutional sign-in | Auth environment owner supplies matching native-aware auth/API with edu-ID configured; owner enters credentials in system browser | Retained synthetic auth exposes credentials provider only; delegated and local-OIDC evidence does not qualify real edu-ID |
| Installed-client support/rollback | Product/backend owner retains each distributed TestFlight build for its full 90-day lifetime and verifies supported clients against candidate and rollback backend | Local capture/retention mechanism implemented; first candidate manifest and deployed candidate/rollback behavioral proof remain open |
| Physical accessibility/lifecycle | Owner performs VoiceOver, maximum text/keyboard/landscape, background/resume and network-loss scenarios on the existing iPad | User accepted delegated login, courses and automatic return; the broader matrix remains untested |
| Privacy and distribution inputs | Controller/account owner reviews native disclosures, App Privacy and export-encryption answers, reviewer access and TestFlight audience | Preparation only; legal documents unchanged, no invitations/upload/distribution |

Apple confirms Program membership for TestFlight and App Store Connect; Personal
Team is for device development: https://developer.apple.com/help/account/membership/programs-overview/
and https://developer.apple.com/documentation/xcode/preparing-your-app-for-distribution .
Capacitor8 documents iOS15+ and Xcode26+ support:
https://capacitorjs.com/docs/ios . These primary sources were retrieved for this
preparation; actual account access and oldest-device proof remain separate.

The retained runtime and private auth/API routes stay available for the user's
testing request. No reset/reseed, signing-resource change, production deploy,
store upload, tester message, merge/readiness or topology mutation occurred.
Organization membership and the numeric support policy are now confirmed by the
user. Remaining dependent actions are Xcode organization access, the exact
publication topology and owner-operated institutional/device qualification.
Initial normal documentation checks passed. Opus
verified the preparation claims and requested three documentation clarifications;
the corrected packet is subject only to focused verification and normal hooks.

### TestFlight support policy confirmed (2026-10-25)

Retain backend compatibility for every distributed TestFlight build throughout
its full 90-day TestFlight lifetime. Record the build's actual expiration from
App Store Connect when available; unknown dates never justify retiring it.
Reinviting testers or distributing a newer build does not retire an older build.
No automatic time-based removal is planned. Public App Store support remains a
separate decision. Apple's [TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)
confirms the 90-day testing limit; this policy preserves that entire window.

GraphQL generation and the existing server-map lookup remain the intended owners
of operation retention. A retained hash map preserves document lookup, while
schema, authorization and resolver behavior must remain compatible separately.
Before distributing a build, verify its frozen operation set against both the
candidate and the designated rollback backend. An earlier backend image cannot
gain support for future operations merely because the candidate retains them.
No distributed-build receipt or historical compatibility success is invented for
the current unsigned local archive. Opus5.5 advised on the capture and retention
boundary. The derived implementation below passed planner hardening in round2.

### Derived B3 implementation: retained native operations

This implements the already-approved B3 compatibility mechanism after the user's
90-day policy ruling. Preserve the current backend lookup and authorization;
merge retained documents into its existing generated server map at build time.
The pilot retains the entire generated map: the bundled client includes that
map, and a Control-only subset has no established completeness proof. This can
block a later schema change affecting another retained operation; resolve such
conflicts explicitly rather than dropping queries. No new runtime service,
session layer, dependency or network access is introduced.

Opus5.5 advice accepted: retained documents belong inside the GraphQL package,
which survives the backend's turbo prune. Keep immutable operation pairs per
build, an explicit tracked index, and fail on missing files, hash/document
mismatch, conflicting documents or schema-invalid operations. The verified
current generator uses SHA256 of the stored document text. Keep runtime document
validation. Source, native build identity, asset-tree digest and operation-set
digest bind each manifest to its candidate. Upload/expiry dates remain null
until verified by the upload owner; the validator never uses dates to discard
operations. Adding another tester does not extend Apple's build expiration.

| Slice and owner | Exact paths | Acceptance |
| --- | --- | --- |
| Build/capture mechanism — main | `packages/graphql/scripts/retainNativeOperations.ts`, `packages/graphql/retained-operations/index.json`, `packages/graphql/codegen.ts` | Add `afterAllFileWrite: ['tsx scripts/retainNativeOperations.ts merge']`; any nonzero validation result stops codegen/build before Rollup copies the map. Capture selects only current client hashes, excluding historical-only entries already merged into the server map. Strict shape, digest, date, pair and schema validation; missing or unindexed files fail closed |
| Focused verification — main | `apps/backend-docker/test/retainedOperations.test.ts` | Existing Node/tsx harness, synthetic schema and test-owned manifests, no DB; current and retained hash-only requests succeed with arbitrary operations disabled; unknown/raw requests fail, malformed/conflicting/missing manifests and invalid schema fail; old map rejects new hash as rollback counterexample |
| Contract and outcome — main | `native/control/README.md`, existing `docs/graphql-api-layer.md`, this plan | Capture/retention commands, full-map cost, 90-day minimum, artifact binding, deployment order and rollback floor, evidence and remaining signing/publication gates; link the procedure from existing API compatibility guidance |

Sequence: planner hardens this derived scope; implement and verify pure tests,
actual GraphQL generation/build and copied dist map, plus prune inclusion using
an ignored output directory. A synthetic retained-only operation must survive
the post-generation hook, Rollup copy and pruned package; an empty index alone
does not establish wiring. Use an isolated synthetic output/input tree for that
probe, preserving the running pilot's generated maps. Commit only these paths
with normal checks. Run
one simplification and one risk review on that committed range, correct material
findings, then Opus5.5 reviews the integrated package. Reuse existing UI/auth
checks: no UI, routing, session, cookie or operation document changes are planned.
An empty manifest index is intentional before the first selected TestFlight
candidate; do not manufacture a distributed-build record for the local archive.

Manifest contract: `retained-operations/index.json` holds `{releases: []}` with
entries `{file, uploadedAt, expiresAt}`. Dates are null before upload and otherwise
ISO UTC timestamps; both null and populated entries remain loaded. Each immutable
`control-<version>-<build>.json` contains `schemaVersion: 1`, full `sourceRevision`,
`bundleId`, `version`, `build`, `assetTreeSha256`, `operationSetSha256`, `client`
and `server`. The operation digest is SHA256 of JSON containing the client and
server maps represented as arrays of key/value pairs sorted by key. The asset
digest is SHA256 of JSON containing sorted `[relative POSIX path, file SHA256]`
pairs for the complete `App.app/public` tree. Capture refuses existing release
identity or files. Mutable dates stay only in the index; a later date update
does not regenerate the paired maps. Test that null dates retain operations,
metadata updates preserve document digest and recapture cannot overwrite it.

Test portfolio: **add new** capture/manifest invariant tests and restrictive Yoga
hash-only contract tests in the existing backend Node harness. Explicitly disable
arbitrary operations in the test instance; do not infer production restrictions
from `prepareApp` in test mode. **None** for new UI/auth tests or prose assertions.

Before upload, freeze the selected candidate's exact maps and asset digest,
verify exact equality with the archive's complete bundled client map and matching
hash/document pairs, rather than checking only presence of captured hashes, and
deploy the matching backend under separate authority. That compatible image is
eligible as a rollback floor only if it supports **all** currently supported
distributed builds; each release must requalify or advance that floor. Test schema,
authorization and resolver behavior against both the candidate and that floor;
hash retention alone proves none of those behavioral contracts. Older images
remain ineligible rollback targets unless independently qualified. Actual image
construction/runtime validation and device/edu-ID qualification stay separate
from the pure/build checks in this slice. No upload, signing-resource mutation,
production deployment or new stack layer is authorized by this implementation.

Terminal: reviewed, committed local retention mechanism with synthetic/build
proof and the current pilot preserved. Publication remains blocked on the
previously named topology/predecessor boundary. Physical and signing gates remain
owner-operated; the user has an organization team and still needs to expose it
in Xcode's project team selector.

### B3 execution evidence

Plan hardening approved round2; Opus5.5 architecture advice was verified and
applied. The contract is committed at `784e01ff14` and the implementation at
`27e22d2175`. The complete changed implementation is the codegen hook, one build
script, empty tracked index, one backend test file and the native README. No
application runtime, endpoint, session, UI, operation document or dependency was
changed. The 17 pre-existing manifest/personal Xcode modifications are preserved.

All15 focused Node tests pass with synthetic files/schema and real restrictive
Yoga: capture/no-overwrite, metadata/digest/pair/schema/file validation, current
and retained hash-only requests, unknown/raw request rejection and old-map
rollback rejection. GraphQL/backend type checks, actual generation, Rollup and
normal commit checks pass. Scoped Opengrep reports no findings. Browser/UI tests
and screenshots are not applicable to this build-only change; prior login/HIG
evidence is reused.

The actual backend Turbo prune includes the helper and retained directory while
excluding native/control. An isolated pruned GraphQL package build proves a
synthetic retained-only hash reaches dist/server.json without entering the
current client map. A deliberately invalid operation digest makes codegen fail
before Rollup. The running pilot's generated map digests remain unchanged. This
is packaging evidence, not a full Docker image, deployed backend or historical
client/schema/resolver compatibility claim. No real release manifest was added.

Evidence is under `project/_local/reviews/control-testflight-preparation/`:
`retention-tests-simplified.log`, typecheck/generate/Rollup/commit logs,
`retention-packaging-probe.json` and its re-runnable script. Simplification found
one redundant directory sort; it was removed and all15 tests still pass with
final digest ordering preserved. The existing API guide links to the native
procedure so later operation changes discover the compatibility contract.
Opus5.5 risk review found no blocking defect. Its three non-blocking corrections
are applied: truthful current-map hash test naming, paired upload/expiry update
instructions and a filename in unexpected-file errors. Its archive-binding
concern remains the explicit recorded pre-upload gate. Integrated Opus5.5 high
final review passed with zero findings over the complete seven-path range
`fd52504edf..dde6919eed`. Its schema-only report correction validated against the
unchanged canonical review schema; no source correction was required. The
existing GraphQL CI workflow builds dependencies then runs the backend's Node
test harness, so these tests are already wired into that workflow. This package
has no hosted CI result while unpublished. All internal checks for this local
slice are complete. Organization visibility in Xcode, candidate
identity/capture, institutional and hardware qualification, deployment/rollback
proof and later distribution remain separately owned gates.

No new PR or push was made across the existing six-layer publication boundary.
The test runtime remains available for the user's explicit manual testing request;
the final exact-source inventory confirms seven routes. Personal Xcode settings,
private test routes, the installed iPad pilot and the 17 pre-existing modified
paths remain intact. No signing resource, app record, deployment or distribution
was changed. The next owner action is Xcode Settings → Accounts → organization
team visibility; the account question is pending without credentials or IDs in
repository artifacts. This B3 source/local qualification batch is complete.

### Local testing restriction and startup recovery correction (2026-10-26)

The organization account is added, but all centrally managed Apple certificates,
provisioning and publication resources are prohibited. Current work is local
testing only; this supersedes the earlier organization-signing next action.
Do not change signing teams/resources, enable automatic provisioning or use
provisioning-update/device-registration flags. Simulator builds use ad-hoc
signing; a physical update may use only the unchanged approved local development
setup, failing rather than modifying signing resources when unavailable.

Owner confirmed normal cold reopen retains login, then reproduced an offline
cold reopen showing sign-in and a spinner under the notch. Source identifies
`Layout` routing every profile request error to login and rendering its startup
loader without a full-height safe-area container. Stored credential restoration
does not itself need connectivity. Preserve all token/expiry/logout and confirmed
unauthorized handling; unavailable network is a recoverable view state.

Derived H3 scope: main owns `apps/frontend-control/src/components/Layout.tsx`
and one connection-error message in each EN/DE i18n file. Render centered startup
loading/error content within all safe-area insets, retain the session/route on
request failure, and offer retry plus automatic reconnect reads. Revalidate all
active queries, including the overview queries that failed alongside the profile;
reads do not replay quiz mutations. Keep previously loaded data during a later
request failure. Move the existing no-result/no-error login navigation into an
effect; confirmed auth errors remain owned by the existing Apollo/session path.

Test portfolio: **extend existing** `playwright/tests/C-control.spec.ts` for a
simultaneous profile/overview failure after authenticated reload, manual retry
and reconnect recovery of all active reads without login or mutations, and a
later failure retaining loaded data. Reuse `apps/auth/test/control-native-client.test.ts`
for local credential restore/expiry and `apps/backend-docker/test/controlNativeAuth.test.ts`
for confirmed unauthorized outcomes; browser verification must also confirm the
existing unauthorized redirect still ends the visible session. Add only missing
consequential regression coverage; no prose assertions or production test hooks.
Main owns integration/source/review; the trusted sidecar only finds reusable
browser/Simulator harnesses and safe local build commands. No new dependency,
module, auth contract, backend state or persistent offline course cache is planned.

Acceptance: reproduce the old redirect/loader, verify EN/DE compact loading and
error states plus retry/reconnect with real app code and synthetic interception;
check a notched Simulator in portrait/landscape and force-close/relaunch the
native bundle already offline, with valid stored test credentials and empty
in-memory cache, then recover without login. This native proof is required;
if unavailable it remains explicitly blocked rather than replaced by browser
reload evidence. Capture real browser evidence under the
existing ignored review root, run focused type/lint/build/regression checks and
normal hooks, then Opus5.5 reviews the exact committed correction. An unchanged
local signing setup is required before any physical install; otherwise deliver
the verified Simulator/source result with that explicit device blocker.
Terminal is the reviewed local correction and available local test build. Existing
stack publication boundary remains; no App Store/TestFlight or signing changes.

#### Startup correction evidence

Planner approved the derived correction in round2; implementation is
`afacc34643`, touching Layout, EN/DE messages and one maintained Control
regression. Normal repository checks pass. Independent simplification found no
justified reduction. Control type/lint, static export and scoped Opengrep pass;
the existing native client22 and API17 tests pass. Token storage, expiry and
confirmed unauthorized handling are unchanged.

The actual static bundle passed synthetic native-boundary browser checks for
offline cold startup, manual retry, automatic reconnect of all four startup
reads, later failure retaining loaded data and confirmed unauthorized sign-out.
Twelve EN/DE phone/tablet/landscape captures are inspected. A separate ad-hoc
Simulator app uses real Keychain storage for a test-only synthetic credential
and injected request failure. Force-close/relaunch offline shows recovery instead
of sign-in; injected reconnect reaches courses without another login. A generated
landscape-only fixture shows the centered loader away from the cutout. These
tests do not establish physical radio-loss or live-account qualification.

The maintained hosted Playwright regression is **not executed**: its canonical
host launcher fails before launch because installed host dependencies do not
match the lockfile. No dependency installation or launcher bypass was used.
Equivalent real-bundle checks pass, but this remains a separate verification gap.
Physical installation was initially pending: automatic approval review rejected the
manual iPhoneOS signing-build attempt because it could access centrally managed
signing resources. That command did not execute; an alternative signing path
was attempted only after owner approval and verification of the local assets.
That initial attempt left the iPad unchanged. After owner approval, read-only
checks confirmed the installed development app, connected iPad and current
project match an existing, valid Personal Team profile and signing identity.
Manual Xcode provisioning rejected that Xcode-managed profile. Compiling with
signing disabled, then signing only the generated app and frameworks with the
same existing personal identity, embedded profile and prior entitlements passed.
The update is installed over the existing app. No signing resource was changed.
Automated launch was denied while the iPad was locked. The owner subsequently
opened the updated app and confirmed that disabling Wi-Fi, force-closing and
reopening shows Retry, and reconnecting recovers. This qualifies that physical
offline/reconnect scenario; other hardware and institutional checks remain separate.

Evidence stays under `project/_local/reviews/control-testflight-preparation/`:
`startup-browser-check.json`, `startup-browser-extra.json`, native captures,
`startup-gallery.html`, source/native build and auth/type/lint/commit logs.
All17 pre-existing personal Xcode and manifest edits are preserved. The local
test runtime/private routes remain available under the user's manual-test lease.
Integrated Opus5.5 high review of `51ef946961..55e0d72db9` found no application
defect and one low-priority test timing issue. Correction `9c54e50ca9` waits for
all four reads to exhaust their network retries and render the terminal error
before checking retained content. Its focused Opus correction review passes
with zero findings; both reports validate against the canonical review schema.
The Playwright package type check and normal commit checks pass. Application
source is unchanged by that correction, so its passing bundle and Simulator
evidence is reused. The maintained hosted regression remains unexecuted.

The source, Simulator and owner-operated physical offline/reconnect correction
is complete. `startup-device-personal-proof.json` records the build, signature,
install and owner-reported acceptance without account or device identifiers.
No source push, new PR or stack change was made. Fresh exact-checkout inventory
confirms seven retained routes for ongoing manual testing. The task-owned
browser sessions, loopback fixture server and separate Simulator test app are
stopped. No certificate, provisioning or publication resource was modified.


## Native publication reconciliation after predecessor landing (2026-11-02)

### Current approved outcome and Progress

The user’s latest “agreed” accepts reconciling the existing native follow-up against merged v3-ai and preparing its publication scope. This is an executable preparation batch, owned by the current main session. Its terminal is a reviewed publication proposal and verified preservation of the pilot checkout, not source integration, a new stack, runtime startup or source publication. Existing local qualification results remain historical evidence; this preparation does not rerun them.

The predecessor six-layer stack is merged. Frozen receiving target is v3-ai at 6c6b7d3429a48ad3604eb2c5ac14db064e9e4b37, including the subsequent v3 synchronization. Native source remains enhance/control-native-login at d00312a260e6669aeb83fcc194948798189e23d3, without an existing PR. The worktree/index/ref is preserved. All 17 original unstaged package/Xcode/Info.plist changes retain their original bytes and diff digest; this dated plan update is separate bookkeeping.

First useful acceptance is complete: the source-to-target reconciliation distinguishes inherited work from the remaining native capability. Of 155 paths changed since the shared merge base, 41 already equal target, 47 are native-only and 67 changed on both sides. An isolated merge simulation found 50 conflicting paths. It wrote only temporary Git objects and changed no source, index, ref, runtime or device state. The marker-bearing simulated tree is not a candidate. Keep newer target LiveQuiz/Manage/runtime fixes; specifically exclude the older dependency-policy bypass and obsolete native-session intermediates.

The working publication proposal separates server native authentication, bundled client/startup, lecture accessibility/recovery, and installed-client compatibility into four independently checked draft layers. It proposes a separate publication worktree while the manual iPad checkout and its private runtime remain intact. No new topology or runtime has been created. The exact future source, verification, draft publication and fresh-only disposable-runtime actions need the completed proposal’s named approval; the preparation itself remains authorized.

Current evidence and frozen draft live under project/_local/reviews/control-native-publication-20261102/. One clean-context independent planner critique completed APPROVED after one focused correction in child 01a19d28-2594-7903-a8cb-375064b5472b. The five dependency/translation, ownership, verification, loader-boundary and gate corrections are verified and accepted. Previous local implementation/device reviews remain historical. No competing writer or automation was started. The current preparation is complete; the next decision is the new four-layer source/runtime/draft-publication batch.


### Reviewed publication proposal — execution approval pending

#### Control native follow-up publication after predecessor landing

#### Approval summary

Current approved work is reconciliation and preparation of publication scope. The actual human reference is the 2026-11-02 “agreed” immediately after “reconcile the existing native follow-up against merged v3-ai and prepare its publication scope.” This preparation may inspect source, simulate integration outside the checkout and update this existing plan. It does not create a new stack, integrate source, start a runtime or publish. The implementing source remains local and the user’s 17 existing edits remain byte-identical.

The predecessor six-layer Control stack has now merged. The receiving v3-ai has additionally merged v3 through PR6788. Frozen target is 6c6b7d3429a48ad3604eb2c5ac14db064e9e4b37. Local native source is d00312a260e6669aeb83fcc194948798189e23d3 on enhance/control-native-login. No PR exists for that branch. The original publication proposal had three capabilities: native app/authentication, lecture accessibility/recovery, and installed-client compatibility. Current evidence supports four review packages by separating the inert server authentication protocol from its native client. This is a proposed topology, not a topology change already performed.

Recommend a new four-layer draft stack targeting actual v3-ai, in one new repository-local publication worktree trees/control-native-delivery. Retain review-control-stack-6539 at its existing head, with all local edits, dependencies, signing setup and private runtime/routes preserved. Extract only the final reviewed native behavior onto the target. Do not merge the old branch wholesale or replay obsolete session-registry intermediates. Each layer must work and pass checks independently. The stack is source delivery only; hardware, institutional sign-in and distribution qualification remain separate.

Future approval would name creation of those four branches/draft PRs, supported source reconciliation, focused checks/reviews and ordinary publication. It would also name one fresh isolated disposable verification runtime for that new source, with explicit fresh-only synthetic initialization and canonical final stop. Existing populated runtimes and volumes are never reset, repaired or recreated. First push is blocked by incomplete normal local checks, source hygiene, required browser/artifact verification or scoped independent implementation review. Hosted CI is collected after push; its pending state is permitted only on explicitly unaccepted draft delivery. No merge, readiness change, deployment, signing/provisioning/account change, device installation, store upload, tester notification or live backend qualification is included.

#### Evidence and integration ruling

The native branch has 100 commits absent by ancestry from current v3-ai; this is not 100 new native packages. Of 155 paths changed since the shared merge base e2ac86f836c3fe78986f9ac51316d1e76bdd2556, 41 are already byte-identical to target, 47 are native-only, and 67 changed on both sides. A merge simulation wrote only temporary Git objects under /private/tmp and found 50 conflicted paths. It changed no index, ref, checkout or runtime. The resulting marker-bearing tree is diagnostic and is never a candidate.

Keep all current target LiveQuiz service/schema/aggregation code and lifecycle tests. Earlier native history contains older forms of the now-merged concurrency fixes. Preserve current Manage projection/evaluation behavior and the post-merge pnpm/runtime setup. In particular, do not carry the old post-start change that sets verify_deps_before_run=false or loses the newer production-test runtime path. No devcontainer change is needed by this native publication proposal. No migration or GraphQL application-schema change is selected.

Shared UI, translations, JWT utilities, package definitions and lockfiles require semantic extraction, not choosing an entire side. Keep current target dependencies and use its pinned toolchain. Add the already implemented direct auth dependencies ioredis5.4.1 and ipaddr.js2.2.0 in layer1, and secure-storage8.0.1 plus the scoped Control Capacitor version exception in layer2. Preserve target framework and transitive versions. Preserve hosted Control routes and web authentication. Maintain the existing local ADR0056 contract’s shared fixed 30-day NextAuth credential policy, proof-bound single-use native handoff, device-only secure storage and local logout. Do not recreate the retired custom Redis native-session registry or a refresh/revocation service; transient handoff/rate-limit Redis remains intentional.

Port native tests into the current maintained Control suite without dropping target regressions. The existing auth/test/control-native-client.test.ts imports frontend nativeSession and Capacitor, so it belongs with the client layer, not the server-only layer. Cross-cutting files evolve only with their owning capability at each layer. Existing deferred result-guard findings remain separately recorded; any overlap already covered by the native command-recovery behavior must be demonstrated rather than used for unrelated cleanup.

#### Proposed layers and independently useful acceptance

| Layer and proposed branch | Complete capability and main source boundary | Verification at this tip | Activation and size ruling |
| --- | --- | --- | --- |
| Server native authentication — enhance/control-native-auth | Final shared NextAuth JWT policy and claim verification; auth broker start/cancel/exchange and system-browser completion; backend native principal/CORS middleware; web-policy acceptance already implemented by its owner; auth log redaction and explicit trusted-proxy handling. Own apps/auth server/UI/tests and its two added direct dependencies, except the client-dependent test; backend app/controlNativeAuth and its test; packages/util clientAuth/controlNativeSession/JWT, package exports and tests; auth chart keys/docs; the EN/DE nativeLogin and signIn strings required by the browser completion page. Publication ADR IDs are reconciled below. | Existing real-Redis handoff race and failure tests, JWT and API auth tests, hosted/assessment/web compatibility, type/lint/build. New native endpoints are safe and usable by protocol clients before the bundled UI arrives. | Complete server protocol, otherwise inert to hosted users. Several thousand source/test lines across roughly 30–40 files, above size thresholds; genuinely one authentication protocol and compatibility boundary. No obsolete intermediate registry state is independently published. |
| Bundled native client — enhance/control-native-bundle | Current Control static export/runtime query routing, native session transport, system browser and secure-storage bridge, native login/account return, startup Retry/reconnect and native-safe presentation. Own frontend nativeRoute/nativeSession/apollo/Layout/login/404 and incremental page routing; native/control generic committed sources; client-dependent auth test; necessary dependency/lock and translated auth/startup messages. | Native client tests; complete static export; synthetic browser login, read failure/retry/reconnect and unauthorized cases; unsigned Simulator compilation with the complete linked Swift sources and nested native package dependencies; hosted path regression; maintained startup regression through the supported host launcher. | Complete native sign-in and startup path against the server layer. Roughly 1,500–2,500 source/test lines across 25–35 files; one OS/browser/storage and bundled-routing contract. Existing iPad proof is historical and does not qualify this integrated candidate. |
| Lecture accessibility and recovery — enhance/control-native-lecture | Existing implemented touch targets, enlarged-text/landscape reachability, chart/contrast, Q&A/moderation/audience/projection controls and recovery from uncertain command outcomes without mutation replay. Incremental frontend-control components/pages/styles/messages and Control browser cases; WebView-facing typography/reflow checks and its existing solution note. The complete native view/controller/bridge implementation lands in layer2 so no later Swift file is needed to compile it. | Existing Control workflows plus failure/recovery and no-replay cases; EN/DE compact/tablet/landscape screenshots with real interactions; relevant native static/compile checks. | Complete lecturer interaction capability. Roughly 1,500–2,500 source/test lines across 20–30 files; coherent lecture behavior. Keep startup/session loading in the preceding client layer. |
| Installed-client compatibility — enhance/control-native-compatibility | Existing persisted-operation capture/merge, build provenance, manifest validation and 90-day installed-client support machinery. Own packages/graphql retention script/index/codegen; backend retention test and the demonstrated codegen build hook; native build/README retention additions and relevant docs. Keep the existing backend dist/server.json loader unchanged unless a specific integration necessity is first proved. | Synthetic retained/current/collision/schema/expiry cases; build output actually loads the union; artifact checks for bundled defaults, operation-map provenance and diagnostic suppression. No real released client or production data enters repository artifacts. | Complete, empty retention index is safe before distribution. Roughly 800–1,200 source/test lines across 10–15 files. This is build/server compatibility machinery, not device distribution or evidence of a supported deployed rollback pair. |

All line/file figures are conservative planning diagnostics from the existing source, not candidate-diff measurements. Extraction may remove inherited changes and conflict markers. Compute actual human-authored/generated/doc delta per layer before publication. A material capability or dependency that defeats these independent boundaries returns to this plan; routine shared-file placement stays with the topology owner.

One native stack is recommended because the packages form a single dependency chain. Alternative: publish the server layer alone and wait for its separate human landing before preparing each consumer. That lowers simultaneous review surface but makes completion depend on repeated landing decisions. A single PR containing all old branch history is rejected because it mixes independently reviewable protocols and would obscure current target fixes. No source is deleted by either choice.

#### Proposed execution and authority boundary

The main session is the only topology/integration writer. Upon specific execution approval, create the new publication worktree from the frozen target; keep the native pilot checkout entirely unchanged. Use supported gh stack commands non-interactively and original project remote. The repository API currently supports native stacks and the installed CLI exposes init/add/submit/push. Never adopt, unstack, modify or revive the closed predecessor stack.

Carry this existing epic plan to the new publication stack as part of its first package; never open a plan-only PR. Maintain a source-to-package disposition map: already target-equivalent, retain newer target, port final native behavior, or defer with an explicit reason. Source commits and earlier review artifacts remain evidence, not a mandate to replay their historical sequence. All 50 conflict paths need an explicit disposition before the corresponding layer can publish.

Preserve the 17 original unstaged paths by byte digest and full diff digest. The existing Xcode project and Info.plist changes and 15 package overrides stay solely in the pilot checkout. Never stage, copy to publication, reset or overwrite those working copies. The new stack uses committed generic native project definitions without organization identity or private endpoint overrides.

Runtime: this preparation starts nothing. Future execution may start only the new publication source, using the installed canonical lifecycle and a narrowly selected synthetic verification profile. Installed Devrouter0.6.4 exposes --initialize-new. Initialize only a never-populated task identity and empty fresh marked main/shadow databases; refuse any retained identity, unexpected volume binding, unsupported transition or existing data. No repair, replacement, reset, reseed, journal/guard edit, dependency bypass or global tooling change is included. The old private iPad runtime/routes have a separate owner and manual-test lease. Stop the new verification runtime canonically after final dependent checks and attest its exact ownership and zero routes.

Browser tests run through the repository’s host launcher; container-dependent checks run in the owning verification container. Use supported host dependency preparation for the historical lockfile mismatch, keeping the fail-closed dependency policy. Stop on an unavailable supported bootstrap; do not set verify_deps_before_run=false. Use synthetic fixtures and avoid saving credential-bearing request logs. Native packaging checks use unsigned compilation with automatic provisioning disabled and no certificate/profile/account operation. Physical radio loss, edu-ID and iPad installation are outside the publication batch.

Reuse existing component reviews only for unchanged contracts and code. New integration and shared auth changes require an independent scoped final review; meaningful simplification is advisory and only when justified. Run normal precommit checks and normal prepush builds per layer. Each layer’s exact nine ultimate-v3-ai contexts/app15368 and actual producer attempts/reporters must be evaluated separately. Same-name passes in another applicable suite do not clear failures. No repeat of consumed historical retries, provider-payment review commands or past slash commands is authorized. Automatic push review wrappers are not review execution evidence.

After all pre-push gates pass, draft publication can truthfully report pending hosted CI or an unavailable separate configured final review; neither becomes green acceptance. A blocked pre-push gate means no affected layer is pushed, while independently completed lower drafts may remain published. If published CI needs waiting, use one new task-scoped observer across the four heads, quiet unchanged, with an original four-hour deadline from the final publication. No blind retries or duplicate watchers. Stop on new source failure, head drift, closure/user stop or deadline; preserve the candidate and classify the gate. Named spending is limited to ordinary existing local verification, configured independent review and repository CI usage; no new paid service/account or cloud resource. Usage cost and queue latency are not known in advance, so no unlimited retry/review loops are included.

Terminal for the proposed future batch: the selected final native behavior is delivered as four reviewed draft PRs, each independently checked; hosted gates are terminally dispositioned or truthfully pending at the observer deadline; the new runtime is stopped; the pilot checkout and its 17 edits remain unchanged. It does not declare release, production performance, institutional login, full physical accessibility or TestFlight acceptance.

#### Current preparation completion

The currently authorized terminal is a reviewed reconciliation and publication proposal, with protected-source proof and all materially new actions presented together. No new stack, source integration, commit, push, runtime start, device change, signing operation, production query or external message occurs in this preparation. Independent planner critique APPROVED after one focused correction; see planner-correction.md. Historical local tests and device acceptance are reused only as historical evidence; new-target execution has not been claimed.


#### Complete target-new file placement and shared-file ownership

This mapping covers every one of the 26 target-new files present in the native committed snapshot. Five obsolete paths absent on both sides are deletions already achieved on target, not new files; never recreate ListButton, EmbeddingModal, LiveQuizBlock, LiveQuizLists or StartModal. There is no blanket directory copy.

| Existing local source path | Owning layer |
| --- | --- |
| apps/auth/src/lib/nativeHandoff.ts | 1 |
| apps/auth/src/pages/api/native/cancel.ts | 1 |
| apps/auth/src/pages/api/native/exchange.ts | 1 |
| apps/auth/src/pages/api/native/start.ts | 1 |
| apps/auth/src/pages/native/complete.tsx | 1 |
| apps/auth/test/control-native-client.test.ts | 2 |
| apps/auth/test/native-handoff.integration.test.ts | 1 |
| apps/backend-docker/src/controlNativeAuth.ts | 1 |
| apps/backend-docker/test/controlNativeAuth.test.ts | 1 |
| apps/backend-docker/test/retainedOperations.test.ts | 4 |
| apps/frontend-control/src/lib/nativeRoute.ts | 2 |
| apps/frontend-control/src/lib/nativeSession.ts | 2 |
| docs/adr/0055-control-native-session-contract.md | 1 |
| docs/adr/0056-share-nextauth-policy-with-native-control.md | 1 |
| docs/solutions/runtime-error/control-webview-text-does-not-follow-dynamic-type.md | 3 |
| native/control/ios/App/App/ControlAuthPlugin.swift | 2 |
| native/control/ios/App/App/ViewController.swift | 2 |
| packages/graphql/retained-operations/index.json | 4 |
| packages/graphql/scripts/retainNativeOperations.ts | 4 |
| packages/util/src/controlNativeSession.ts | 1 |
| project/2026-10-23-control-mobile-release-plan.md | 1 |
| project/2026-10-24-control-apple-hig-claude-review.md | 1 |
| project/2026-10-24-control-apple-hig-review.md | 1 |
| project/2026-10-25-control-nextauth-consolidation-plan.md | 1 |
| project/2026-10-25-cross-platform-login-session-research.md | 1 |
| project/2026-10-25-lecturer-auth-policy-plan.md | 1 |

Historical project plans/audits accompany the existing epic in layer1 as planning context and receive a dated current-status pointer; their old green checks do not qualify new source. No ignored account/device evidence, request logs, archive or private configuration is copied.

ADR collision ruling: target already owns docs/adr/0055-pinned-ocr-source-runtime.md. Keep it unchanged. In the publication worktree only, map local0055-control-native-session-contract.md to publication0056-control-native-session-contract.md as explicitly superseded history, and local0056-share-nextauth-policy-with-native-control.md to publication0057-share-nextauth-policy-with-native-control.md as the current contract. Refresh references in the selected publication files only. Recheck ID availability immediately before creating those publication files; if another owner has claimed them, allocate the next free IDs without changing the contract. Pilot files and historical proof references stay unchanged. This resolves numbering, not architecture.

| Shared changed files | Incremental ownership |
| --- | --- |
| apps/auth/package.json, auth chart keys, packages/util/package.json and index.ts, root pnpm-lock.yaml | Layer1 adds the implemented ioredis/ipaddr dependencies and native/shared JWT exports and preserves target consumers. The same root lockfile receives only layer2 client additions later. |
| packages/i18n/messages/en.ts and de.ts | Layer1 includes nativeLogin and accessibility.signIn keys used by real auth pages; layer2 adds only startup/session/native client keys; layer3 adds lecturer interaction and accessibility keys. Reuse existing target keys unchanged. |
| frontend-control package/config, native/control package/lock/CapApp-SPM/Package.swift and resolved packages, .syncpackrc.mjs | Layer2 adds implemented Capacitor/secure-storage/static-export wiring. Install both workspace and separate native package dependencies; SwiftPM references the nested secure-storage package. No broad dependency update. |
| SceneDelegate.swift, ViewController.swift, ControlAuthPlugin.swift, AppDelegate.swift and generic Xcode source references | All complete and compile together at layer2, including registration of ControlAuth and required native text scaling. No layer3-only Swift source is referenced. Never copy pilot working Xcode/Info.plist values. |
| frontend-control pages/_app, index, course pages, session page, globals.css and shared controls | Layer2 ports only bundled routing, safe startup/session and transport prerequisites against current target UI. Layer3 ports the remaining reviewed lecture controls/reflow/uncertainty behavior. Preserve all target fixes; never drop later regression tests. |
| playwright/tests/C-control.spec.ts | Layer2 ports the startup/four-read failure/reconnect/unauthorized cases; layer3 ports lecture command no-replay/recovery and accessibility cases. Existing target tests remain. |
| packages/graphql/codegen.ts, native/control/README.md, docs/graphql-api-layer.md, turbo.json | Layer4 adds only retention generation/capture/provenance contracts. Production endpoint defaults and diagnostic suppression already belong in layer2. The existing backend runtime map loader stays unchanged. |

#### Bounded verification portfolio

All tests below are existing maintained native tests or focused extensions of existing suites. No prose/seed-content assertions or new production test branches are selected. Keep an earlier layer independently green without files, generated outputs, dependencies or translations from later layers.

| Independent risk | Test obligation | Owning seam and acceptance |
| --- | --- | --- |
| Native credentials escape their audience/scope/lifetime; handoff race/replay/cancel or web-policy compatibility | Extend existing | Layer1: auth native-handoff, salted-jwt, callback-journey, student-session and util JWT tests; backend controlNativeAuth tests. Real isolated Redis for atomic handoff races; synthetic principal records; hosted/assessment compatibility remains. |
| Server browser completion or policy acceptance is misleading/inaccessible | Extend existing | Layer1: A-login.spec.ts and existing native auth browser fixture against the real auth pages with a synthetic issued handoff. Success, refusal, reused-account confirmation and fresh-signin automatic POST; EN/DE compact/desktop captures and interaction checks. No real edu-ID credentials or production records. |
| Bundled runtime IDs, native storage/logout or cold network error lose the session | Extend existing | Layer2: control-native-client.test.ts, current static export, C-control.spec.ts startup cases. Cover all four active reads recovering, cached data after terminal read failure, manual retry, confirmed Unauthorized sign-out and no mutation replay. Capture EN/DE phone/tablet/landscape native-bundle loading/recovery states. Browser storage doubles do not prove hardware Keychain. |
| Lecture commands replay after an uncertain response; controls become unreachable at large text or narrow/landscape layout | Extend existing | Layer3: existing C-control.spec.ts and browser harness. Request counts, real state refresh, Q&A/moderation/audience/projection behavior, keyboard/large text/contrast and observed retained-control reachability. Real captures plus source provenance. Physical VoiceOver/background/radio transitions remain open. |
| Packaged native output differs from verified web source or requires a missing Swift dependency | Extend existing | Layer2: complete static bundle and unsigned Simulator compilation; Release artifact inspection of canonical endpoint defaults, no server.url/private endpoints/source maps and suppressed native diagnostics. No signing or installation. |
| Retained operations validate in isolation but disappear from shipped backend output | Extend existing | Layer4: retainedOperations.test.ts plus the existing synthetic retained-only operation packaging probe through actual GraphQL generation, Rollup and turbo-pruned backend inputs. The old-map counterexample rejects the retained hash; the generated server map contains it while the current client map does not. Corrupt manifest stops generation before Rollup. Preserve the current loader. Empty index alone is insufficient. |
| Documentation/ADR/plan wording | None | Main inspection, ID/reference checks and normal formatter only; no content-pinning tests. |

#### Exact verification entry points and bounded recovery

Commands below describe the future execution batch and have not run in this preparation. Use the new publication checkout root throughout; no command targets the pilot checkout. The frozen target pins Node24.21.0/pnpm12.11.2. Resolve route/database bindings through the new managed runtime; do not hard-code or copy private iPad endpoints.

Fresh runtime bootstrap is `devrouter ensure <publication-root> --profile live-quiz,manage --initialize-new --json`, after confirming the publication path/managed identity and volumes are genuinely new. Only initial synthetic setup of that fresh marked main/shadow database is authorized. Later commands use ordinary `ensure` without initialization; no branch switching is allowed while its previous app processes are running. Stop the publication runtime before navigating each layer, then resume the same exact publication source normally. No repair, recreation or populated reset is allowed. Source snapshots for tests must match the actual selected layer.

Container entry points use `devrouter exec <publication-root> -- <command>`:

- Layer1: `pnpm --filter @klicker-uzh/auth test:run -- test/native-handoff.integration.test.ts test/salted-jwt.test.ts test/auth-callback-journey.integration.test.ts test/student-session.integration.test.ts`; `pnpm --filter @klicker-uzh/util test -- test/jwt.test.ts`; `pnpm --filter @klicker-uzh/backend-docker exec tsx --test test/controlNativeAuth.test.ts`. Inject only the existing synthetic runtime context; add no live secret or configuration probe.
- Layer2: `pnpm --filter @klicker-uzh/auth test:run -- test/control-native-client.test.ts`; `pnpm --dir native/control install --frozen-lockfile`; build the frontend with `NODE_ENV=production NEXT_PUBLIC_CONTROL_BUNDLE=true` and the existing explicit native build variables from native/control/README.md. Use generated local verification routes only for the local variant; separately build/inspect production-default public assets.
- Layer4: `pnpm --filter @klicker-uzh/backend-docker exec tsx --test test/retainedOperations.test.ts`; `pnpm --filter @klicker-uzh/graphql build`; `pnpm exec turbo prune @klicker-uzh/backend-docker --docker --out-dir=project/_local/reviews/control-testflight-preparation/retention-pruned`. Copy only the inspected synthetic retention-packaging-probe.ts harness into the new checkout’s matching ignored test location, then `pnpm --filter @klicker-uzh/backend-docker exec tsx ../../project/_local/reviews/control-testflight-preparation/retention-packaging-probe.ts`. Its cwd resolves the new publication root; use a fresh ignored probe directory on any corrected rerun and never the pilot’s existing generated maps.

For layer1 browser coverage run the canonical host launcher with `--runtime-profile live-quiz,manage --preserve-database --ci-runtime -- tests/A-login.spec.ts --project=chromium`. Layer2/3 use the same launcher and options with tests/C-control.spec.ts. The supported direct entry is `node util/run-playwright-host.mjs ...`; it owns filtered host Playwright installation, host Prisma/types preparation, Chromium, the publication runtime’s stop/resume and binding checks. The source at target lines818–880 supplies that bootstrap; do not invent a global install or disable dependency verification. Additional real auth/native bundle captures use agent-browser and the screenshot-gallery workflow against the verified synthetic source. Native system-browser/physical acceptance is not inferred from Chromium.

The installed full SDK is /Applications/Xcode.app, Xcode27.0 build27A266a. The global developer selection currently points to CommandLineTools; do not change xcode-select. Scope DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer to each native command. After the nested native dependencies and cap sync are prepared in the publication source, host unsigned compile is `xcodebuild -project native/control/ios/App/App.xcodeproj -scheme App -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath project/_local/control-native-unsigned CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO DEVELOPMENT_TEAM= build`. A separate unsigned iphoneos archive uses the documented Release archive entry with the same no-signing constraints. No provisioning-update flag, identity import, profile query/change or simulator/device installation is included.

Per layer, run its tests and required normal checks exactly once on the candidate; only a material correction invalidating relevant evidence triggers a rerun. Existing prior passed checks remain historical after integration. Normal `check:all`, lint-staged/gitleaks/data hygiene and prepush build remain mandatory. Permit at most two diagnosed source-correction cycles per coherent layer; after three distinct failed hypotheses or ten minutes on one investigation, realign to the concrete blocker and finish independent authorized work. Independent plan critique gets this one focused correction; integrated implementation review gets one initial pass and one same-reviewer correction. A terminal model-route failure uses only the existing routing continuity budget; no provider/model/billing change or retry of the old payment-failed workflow.

The nine ultimate required contexts, all app15368, are sync-ancestry, check, check-gitleaks, test-graphql-status, test-playwright-status, test-unit-status, test-olat-api-status, test-intl-production-status and build-images-status. Refresh live rules for new PR acceptance. Before first push each layer needs source hygiene, normal local hooks/build, its focused protocol/browser/unsigned artifact checks, and its applicable independent scoped implementation review. That first push creates draft PRs and starts hosted producers. Subsequent hosted statuses may remain pending on draft delivery; they never imply accepted CI. A source failure blocks that layer’s acceptance and its dependent publication until diagnosed within the correction budget. At the four-hour deadline report pending/failed gates and retire the sole observer. A configured final-review capability failure remains a separate blocked acceptance gate even if the draft source is published after its scoped review passes. No user waiver is inferred.

### Preparation result

Reconciliation and the independently reviewed scope are complete. The 17 original edits, pilot source head and empty index are preserved; only this plan and ignored preparation artifacts changed. No new stack, worktree, source integration, commit, push, runtime start/stop/reset, device/signing action, deployment or external message was performed. Runtime availability was checked through Docker version only; no current pilot runtime health claim is made. The current human authority locator is the actual user agreement at 2026-11-02T16:31:10.097Z; its original scope remains preparation. Future execution needs the named new topology, isolated fresh verification runtime and draft-publication approval described above. The old merged-stack monitors remain retired. No human-only automation is created.


## Approved native publication execution (2026-11-02)

The human “approved” at 2026-11-02T19:06:38.693Z accepts the named four-layer draft-stack execution batch, including its separate worktree, source reconciliation, isolated fresh verification runtime and normal draft publication. Main is the topology owner. No merge, readiness change, deployment, signing/account/device or distribution operation is included.

The publication worktree is trees/control-native-delivery; the retained pilot checkout remains unchanged except its earlier planning note. Initial branch enhance/control-native-auth was created from current origin/v3-ai0c438acb59565d553eb681d5cca6f3916786b9c4. Compared with the reviewed target6c6b7d3429, the only new change is PR6796’s Auto router configuration in the PRD/STG values files. It does not intersect native/auth selected source. Preserve it unchanged. No shared local v3-ai ref was moved.

### Current Progress

Root outcome: deliver the reviewed native follow-up as four independently validated draft PRs. Approved terminal: scoped source/review/local checks before each push, truthful hosted CI disposition with one bounded observer, and canonical final stop of the isolated verification runtime. Physical/institutional/release acceptance remains separate.

Active layer: fresh-runtime prerequisite for server authentication and native handoff. First useful acceptance remains the target-based auth layer building and passing focused handoff/JWT/API/web compatibility tests without client-layer dependencies. Completed: protected pilot fingerprint, refreshed target/non-overlap classification, separate publication worktree/first branch, preserved auth extraction, five-file fresh-only safeguards, synthetic red/green verification and independent scoped source review. Current blocker: Devrouter0.6.6 refuses the receiving source's three explicit Redis volume-name bindings before provider startup and before claiming a fresh initialization attempt. Exact source still has no provider, containers or routes; no native source is committed or published. Remaining: a compatible fresh/retained Redis binding contract, actual fresh initialization and mandatory container checks, auth restoration, all four native packages and final acceptance. Existing execution approval remains valid; the selected five-file prerequisite does not authorize changing retained volume ownership in additional Compose source. All four branch names and ownership remain as reviewed above.


### Execution checkpoint: fresh-runtime admission refused (2026-11-02)

The approved server-auth branch and local stack were created in the separate publication worktree from target0c438acb59. A target-preserving server-auth candidate is extracted, including its direct dependency declarations and only the auth browser’s required translation keys; inherited LiveQuiz/Manage/runtime source is preserved. The candidate and its exact new-file list are saved under project/_local/reviews/control-native-publication/. It is UNCOMMITTED and UNVERIFIED; its lockfile still needs repository tooling in the owning container. No first-layer push or PR exists and no upper layer is created.

Fresh preflight proved no managed provider, no source containers and zero routes. The canonical one-shot command was attempted once and refused immediately with “--initialize-new requires managedRuntime.devcontainer.freshBootstrap.” Installed Devrouter0.6.4 supports the explicit path, but this target and current default branch omit its repository consumer declaration. The refusal occurs before provider creation or claiming an initialization attempt. Ordinary startup is preserving and cannot be substituted. The original preflight missed this required source declaration.

No admission declaration, database emptiness guard, retained-runtime helper, mutable guard/journal, source pin, dependency bypass or global tool configuration was changed. A narrow five-existing-file prerequisite proposal is now frozen for independent critique. It would add the missing fresh-only consumer contract and both-database emptiness checks, rather than infer wider startup/data authority. Current four-layer execution approval remains in force; this newly selected runtime-source change requires a named scope extension. No fifth layer is proposed.

Root outcome remains the four independently validated native draft PRs. The exact blocker is runtime admission, which prevents normal dependency installation, lockfile generation, hooks, container tests and source publication. Source extraction and protected-pilot verification were completed independently. The next action is disposition of the narrow prerequisite plan critique and one concrete human scope decision. The original pilot’s17 edits and head remain unchanged. No new runtime was created, so there is none to stop; fresh exact-source absence/zero-route proof is recorded. No human-only automation is created. The native task-binding helper could not find its session/root receipt for the new worktree; no hook/client state was repaired, and this prose plan plus actual approval reference remain authoritative.

### Approved runtime-admission prerequisite

The original approved source selection stated “No devcontainer change is needed by this native publication proposal.” The admission refusal disproves that prerequisite assumption. Recommend adding a narrow runtime-source correction as the first commit inside the already approved server-auth layer, then continuing the four-layer batch. This needs a scope extension because initialization and data-integrity behavior were not selected in the original native patch. It adds no fifth stack layer.

The selected correction touches five existing files: .devrouter.yml declares the supported literal one-shot freshBootstrap command and existing stateful volume keys, with only pnpm_store shared; .devcontainer/recover-bootstrap.sh refuses any application objects/data in either restricted marked main or shadow database before initialization; .devcontainer/recover-runtime.sh refreshes only reviewed source checksum pins; util/test-recover-bootstrap.sh covers fresh-empty success and nonempty or wrong-identity refusal while preserving ordinary retained startup; .devcontainer/README.md describes this qualified one-shot contract. Ordinary startup remains preserving. No reset, reseed of retained data, mutable fence/guard repair, provider setup or tooling upgrade is selected.

Before setting aside the auth candidate, create and verify a recoverable archive containing every tracked modification and untracked candidate file, including binary contents and modes. Store the exact base, path/mode/content manifest and supplementary binary diff in the existing ignored review directory. Refresh it if the candidate changes, and verify every restored path, mode and hash before auth work resumes. Stop on overlap or mismatch. Never change the retained pilot source or its17 protected edits.

Run the existing pure shell transport harness and native config checks, then independently review the frozen prerequisite source before any database write. Commit hooks still require the runtime, so source review precedes activation and normal checks/commit follow successful verification; no hook bypass or unverified source push is allowed. Reverify exact-source absence and qualified installed Devsy1.24.0/Devrouter0.6.4, then make one actual canonical fresh initialization attempt. Provider admission must own the exact new local resources and mounts. Failure, interruption or unknown completion after the attempt is claimed stops the batch and retains its partial state/fence; never clear, rearm, replay, repair or recreate it. Canonically stop any created resources and record exact-source terminal state.

If initialization succeeds, run normal checks and commit the reviewed prerequisite, restore and verify the auth candidate, generate its lockfile with repository tooling in that container, and resume the existing four-layer implementation/review/draft-publication sequence. The final canonical stop and one four-hour hosted-CI observation boundary remain unchanged. No merge, readiness, deployment, device/signing/account or distribution action is added. This uses the existing local machine and review cost class; build time and local storage use remain uncertain. The alternative is to wait for a qualified repository consumer change from its existing owner; that leaves dependent tests and publication blocked.

The prerequisite plan passed independent native planner critique after one preservation correction. The human approved this exact extension at 2026-11-02T20:16:43.674Z in the native session. This extends selected source only as described above; the original four-layer delivery approval remains valid. The task binding now resolves to that actual user approval. No new human decision is pending.

The corrected detailed proposal and both critique reports are under project/_local/reviews/control-native-publication/. All41 candidate files were archived and read back with modes/content verified immediately before baseline restoration. The24 tracked native modifications were restored to the receiving source and16 untracked files moved into the ignored holding directory; the active plan remains present and its execution checkpoint advances separately. No original candidate file was deleted and no pilot path was changed. Restore and verify the40 held source/document files from that snapshot after prerequisite acceptance, preserving this plan's expressly approved checkpoint delta.

Current execution: the five-file prerequisite is implemented and unstaged. Its synthetic regression first failed on missing empty checks, then the complete recovery harness passed after correction. Shell syntax, installed Devrouter profile parsing and diff whitespace passed. Independent frozen source review PASS covers all five paths and the runtime/data-integrity seam. One accepted prose-spacing correction does not change the reviewed behavior. Exact-source fresh admission, normal mandatory checks/commit, auth candidate restoration and the four native packages remain. No runtime has been created and no source is published. New target movement since approval touches only deployment PDB/dashboard/docs/plan files, with no intersection in the five prerequisite files; the receiving baseline stays0c438acb59 until a concrete integration need.

The recovery owner requested an idle confirmation for the human-approved coordinated Mac Studio0.6.6 adoption. Its actual preceding card and approval were read from that thread: userMessage01a19ded-6019-7fe2-9a71-1e0381a0eaa3, turn01a19ded-5f6b-7a72-8691-bf1326c481e2 in thread01a188fd-2c10-7e10-b62a-de8509b08f20. This chat's source reviewer is closed, and it owns no active lifecycle CLI/worker/controller. PATH resolves through .local0.6.4, no explicit task executable pin exists, and the shared journal root is /Users/roland/.config/devrouter with no state override. All new shared-journal CLI operations are held for the adoption window; do not start initialization with a replacing or dormant tool.

Automatic approval review initially rejected the factual idle-confirmation send to the recovery thread because it did not consider the transcript clear authority to message that destination. The human subsequently answered “yes” to this chat's exact named message request. The confirmation was delivered successfully to recovery thread01a188fd-2c10-7e10-b62a-de8509b08f20 through the supported app tool. No workaround or indirect transport was used. No human decision remains pending here. Wait for that independent owner's adoption result while holding shared-journal CLI operations; then verify qualified fresh admission under the common0.6.6 selection and continue the existing approved batch without another generic approval. The owner has a supported task-reply return path. No duplicate runtime/CI watcher is created.

### Current execution: Redis binding admission refusal

The recovery owner completed the human-approved common0.6.6 adoption and released the hold. This thread independently verified both selected package versions and exact CLI/lifecycle-worker hashes, the qualified installed Devsy1.24.0 fresh path, unchanged reviewed consumer source, empty index, source absence and all17 protected pilot hashes. The process helper is a separate executable from the lifecycle worker; their different hash labels were resolved without changing tools or configuration. Primary documentation and installed source agree on the fresh-only contract; the indexed Devsy-version excerpt lags the installed1.24.0 guard. No new tooling installation or global edit occurred in this thread.

One canonical command was issued under fresh-066-initialize-receipt.json. It exited1 after about5seconds: “Fresh bootstrap refuses fixed names for non-cache volumes before provider startup. Managed runtime transition did not reach a rollback boundary.” No retry was issued. The provider is absent, source containers are absent and exact route count is0. The initializer did not run. Read-only inspection of this exact source's reliability record shows no freshBootstrap attempt field, matching installed source order: all Compose files are inspected for name declarations before claimActiveFreshBootstrap. The failed running intent exists and was not manually repaired, settled or rewritten. No resource was created, so no runtime stop or deletion was required.

The rejection is caused by existing .devcontainer/docker-compose.yml volume names for redis_exec_data, redis_assessment_data and redis_cache_data. Each supports an explicit KLICKER_REDIS_*_VOLUME retained binding, with a project-derived default. Installed fresh admission rejects any explicit non-cache name field before provisioning. These aliases intentionally support retained-storage recovery, as documented in the existing README. Removing them blindly would change that compatibility contract. The dependency-volume generator is not the cause. A passing five-file source review did not attest actual provider admission; that expected coverage is now blocked by this demonstrated receiving-source incompatibility.

Continuation is blocked at the fresh/retained storage seam. The five selected files cannot remove the Compose incompatibility while preserving the documented retained override behavior. Do not add a Compose rewrite, weaker cache classification, alternate runtime, old executable, fence edit, initializer replay or hook bypass. The human explicitly approved this chat's exact request to send the blocker/proof to “Resume Klicker control recovery” for a compatible fix proposal. The supported app tool delivered that request to existing thread01a188fd-2c10-7e10-b62a-de8509b08f20. Its bounded read-only proposal is now the independent producer, with a requested reply to this source chat as the return path. No current human response is pending; verify the returned proposal and resolve any genuinely extended source/data authority before integration. The message grants no runtime, retry, source-edit, provider-change or installation authority. Preserve the auth archive/holding directory and this reviewed prerequisite. Normal hooks, auth lock generation, native verification and publication remain pending. No CLI process, hosted CI producer or duplicate autonomous monitor exists.

Exact refusal/absence/no-attempt proof: project/_local/reviews/control-native-publication/fresh-066-refusal-proof.json. The original published/native source is unchanged; no iPad, retained runtime/private route or Apple resource was touched.

### Approved Redis compatibility extension

The human-approved recovery-owner handback is complete. Main verified its receiving source seams and primary Compose input documentation. A read-only synthetic Compose5.1.2 config probe confirms that removing explicit names for clean defaults produces the same project-prefixed Redis names as the old fallback, and restoring the original clauses in an overlay preserves synthetic retained aliases. This proves the naming premise only. No compatibility source patch, full generator test or provider operation has run. Independent native planner critique APPROVED this new bounded plan with no load-bearing finding; advice does not grant implementation or another command.

The human approved both linked additions at2026-11-03T16:56:44.069Z: the four-existing-file compatibility extension within layer1 and ONE additional corrected canonical fresh-initialization command for this same publication source after its checks pass. The first refused command's receipt and failed intent remain intact. Its absent freshBootstrap field did not replenish the human command allowance; the actual new user approval supplies this one corrected command. No fifth PR/layer, global tool change or retained-runtime adoption is included.

The exact four paths are .devcontainer/docker-compose.yml, util/generate-dependency-mounts.mjs, util/generate-dependency-mounts.test.mjs and .devcontainer/README.md. Remove only the three unconditional Redis name properties from the base. Through the existing generated dependency overlay, emit the original expressions verbatim whenever any supported alias input may be present; let Compose continue interpolation. Preserve service mounts, logical keys, package volumes, atomic generation, all data classifications and pnpm_store as the sole shared cache. No new helper file, descriptor, dependency or mode framework. This changes source/generated fingerprints even when resolved mounts match; it does not authorize moving this source into a retained checkout or adopting new journal baselines there.

Fresh rendering is qualified only when alias absence is proved for the canonical invocation. Consider presence of the three KLICKER_REDIS_*_VOLUME keys, including empty values, Compose environment/file selectors, and metadata for potential dotenv files in the checkout, Compose and invocation directories. Present, opaque, unreadable, symlinked or otherwise unproved inputs retain the original clauses and keep the unchanged fresh guard fail-closed. Do not read dotenv values, add a competing parser, unset user inputs to force admission or claim arbitrary custom Compose CLI compatibility. Validation/discovery failure preserves the last valid generated artifact. If supported ordinary alias provenance cannot be preserved within this seam, stop and report it.

Before provider effects, extend structured synthetic regressions for defaults, each alias/combinations, empty/ambiguous inputs, invalid input and stale-clause removal after proved absence. Render the full actual selected file set in normal and no-interpolate modes. Prove name equivalence, unchanged package/cache/mount behavior, atomic writes, both canonical entry points producing identical bytes for equivalent inputs, and continued raw-guard visibility for retained bindings. Run affected existing generator/bootstrap/runtime contracts and scoped syntax/format checks. Use no actual negative initialization call as a test. Independently review the frozen new data-binding seam before activation; at most one focused same-reviewer correction. Reuse byte-identical bootstrap guard review. Complete normal mandatory hooks/checks after actual bootstrap, without bypass or unverified push.

Only after tests/review pass, exact selected source/environment is qualified and ordinary admission accepts the previous drained operation without repair, the added command is devrouter ensure /Volumes/HOME/Git/klicker/klicker-uzh/trees/control-native-delivery --profile live-quiz,manage --initialize-new --json, once. Write a separate one-use receipt, preserving every prior receipt/intent/fence. Use common0.6.6 and qualified Devsy1.24.0. Provider admission must prove exact new/project-owned local non-cache volumes and mounts with only pnpm_store shared. Both marked restricted main/shadow identities and real emptiness must pass before writes. Require useful managed/application readiness, normal prerequisite checks and commit, then restore/hash-verify the40 held candidate files while preserving this approved plan checkpoint and resume the already-approved four native packages.

On a pre-provider refusal, preserve evidence and stop without gratuitous stop/repair. If resources are created and failure/interruption/unknown completion follows, capture exact stage/IDs, retain partial data/fences and use only the ownership-proven canonical stop. An unprovable stop is a capability blocker, not permission for raw lifecycle fallback. No further corrected command, replay, reset/reseed, deletion, baseline edit, alternate checkout, provider patch, installation, merge/deploy or signing/device/distribution action. On success the original batch still ends with canonical exact-source stop, retained resources, providerStopped/zero routes and its single bounded hosted-CI disposition.

This uses existing local compute/storage and review cost class; duration and disk use remain uncertain. No new recurring service is selected. An ordinary source revert can undo code, without authorizing data rollback. Alternative: keep native publication blocked pending a separate qualified Devrouter-owner guard-extension proposal. That provider route is outside this proposed batch.

Detailed frozen execution proposal and critique: project/_local/reviews/control-native-publication/redis-compatibility-extension-proposal.md and redis-compatibility-plan-critique.md. Exact-source journal inspection was read-only: worker absent, previous operation drained/INTERRUPTED, desired running, phase recovering and no freshBootstrap field. Do not settle or repair those values. No human response is pending; all prior native/source approvals persist.

Current execution: the four-file extension is implemented. Generator regressions reproduced the missing alias rendering before correction, then passed all11tests. The existing dev-runtime, local-EduID, readiness5tests and recover-bootstrap contracts passed; sandbox process/listener restrictions were resolved by rerunning only those affected pure harnesses outside the sandbox. Matching repository Biome2.5.2/Prettier3.3.3 tools were reused read-only from the primary's existing ignored dependencies, without installation. Scoped lint/format and syntax checks pass. A24-render full consumer Compose probe covers defaults, each alias, combined aliases and empty aliases in normal/no-interpolate modes; names/mounts/cache classifications remain equivalent and retained expressions stay visible to the raw guard. Independent frozen source review PASS found no load-bearing issue; prior guards remain byte-identical.

The additionally approved corrected canonical command completed successfully, with its separate one-use receipt retained. Actual provider freshBootstrap stage is ready and its completed operation exited0. All7source-owned containers run; all42selected non-cache volumes are new, local and project-owned, with six declared data bindings and exact mountpoints verified. The sole shared cache is the existing pnpm store. There are45named mount references across43unique named volumes. Guarded schema initialization/seeding completed and managed startup reported ready. Canonical exec independently verified Node24.21.0, pnpm12.11.2 and the reviewed mounted bootstrap hash. This proves the prerequisite runtime path, not native auth/UI or release acceptance. No replay, reset, retained adoption or pilot mutation occurred.

The documented checkout-local root-tooling install for host Git contract checks completed frozen/ignore-scripts; application dependencies/build checks remain in the exact container. Next: normal plan/prerequisite commits with mandatory hooks, then restore/hash-verify the held auth candidate, generate its lockfile in the runtime and continue the approved native packages. Source publication and all four PRs remain pending. Runtime is active only for this ongoing approved verification batch; final canonical stop remains mandatory. The native task-binding helper could not find its session/root receipt after the pause; no hook state was repaired, and the actual user approval locator plus this plan retain semantic authority.
