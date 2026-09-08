# Reliable activity retries and explicit local test profiles

Draft delivery: [PR #5835 — repeatable focused activity runs](https://github.com/uzh-bf/klicker-uzh/pull/5835), targeting `v3`.

## Approval summary

Prevent partially created activities from contaminating subsequent test retries,
and allow focused local Playwright runs to request an exact runtime profile.
The existing activity workflow retries from its clean seeded baseline. Calendar
interactions wait for rendered state instead of fixed sleeps. The launcher gains
an explicit profile option; ordinary invocations retain their full-stack default.
It never silently inherits a previously selected smaller stack.

The user approved this package and continuation, including one upstream merge.
That merge is complete. Approval covers scoped source changes, checks, review,
commits and ordinary draft-PR delivery. No merge, runner change, canary activation,
cache reset, shared infrastructure repair or package release is included.

The current approved continuation replaces the proposed Next.js patch with a
development-only configuration for the four Pages Router apps, if repeated
startup and browser qualification pass. Chat, production and CI serving retain
their existing configuration. The local Hatchet HTTP correction remains.
No dependency version changes are included.

The main risk is under-provisioning a focused test: the caller must request all
needed profiles. Argument validation must finish before any external command.
Success requires command-boundary regression tests, unchanged default behavior,
and a complete browser run of the retry group. The Devrouter startup blocker
is resolved. Qualification now targets the consumer-side Next.js route watcher.
Source checks alone do not qualify browser behavior. No new runtime-repair loop
is added.

## Execution details

Worktree: `trees/rs/playwright-activity-retry-safety`.
Branch: `rs/playwright-activity-retry-safety`; target: `v3`.
Current target baseline: `e3fb9873c98a664987cc48f0ec9bbf51c9337e8a`, integrated
with the host/container dependency-isolation correction. Boundary owner: self.
Artifacts root: `project/`.
This is a full-path package because the launcher changes a lifecycle contract.
General lifecycle hardening stays with the existing Devrouter task; this package
does not edit its repository. No new product primitive, dependency version or
irreversible architectural choice is introduced; no ADR is required.

### Argument contract

After removing the existing optional leading `--`, consume a launcher-option
prefix containing `--runtime-profile VALUE`, `--runtime-profile=VALUE`,
`--print-env`, or `--show-report`. Stop at the first other argument. An explicit
`--` ends the prefix and is consumed; preserve all remaining arguments verbatim.
Profile-looking arguments after that boundary belong to Playwright.

Accept one profile flag with comma-separated names matching
`^[a-z][a-z0-9-]*$`. Reject whitespace, duplicate names, empty components,
duplicate flags, duplicate mode flags, both modes together, or a profile combined
with `--show-report`. Reject before subprocesses. Devrouter validates whether
syntactically valid profiles exist. Do not duplicate its profile resolver.

No profile means the existing `ensure <exact-checkout>` invocation. An explicit
profile adds one `--profile` value. `--print-env` still reconciles the runtime
and can start services; it is not a read-only status command. `--show-report`
retains its no-runtime path. The documented focused activity example uses
`manage,live-quiz`; the 12-test element-instance update group qualifies this
union. That proof does not cover the entire spec file or every profile union.

### Ownership and acceptance

| Work | Owner | Acceptance |
| --- | --- | --- |
| Launcher and command-boundary tests | executor | Only `util/run-playwright-host.mjs` and its existing test file; exact default/explicit ensure arguments, no commands on invalid input, preserved forwarded arguments, report path without runtime |
| Consumer guidance and integration | main | Update existing Playwright skill and devcontainer guide; describe defaults, option placement, profile sufficiency and print-env effects |
| Existing retry fix and delivery | main | Preserve test intent; complete focused browser group after runtime recovery, then required reviews and draft PR |

Main retains coupled documentation, runtime decisions and final evidence.
Extend the existing launcher suite rather than adding a new framework. Use the
smallest injectable side-effect seam for orchestration tests. Parser-only tests
are insufficient. Keep test-owned synthetic inputs. No browser or service is
needed for launcher wiring tests. Container-dependent checks keep the repository
toolchain boundary; local browser execution remains host-only.

Run source syntax, existing Node tests, scoped formatting, diff/secret checks,
then committed-slice simplification and lifecycle-risk review. After the full
browser gate is satisfied, run integrated final review before publication.
Pause on a repeated runtime failure, missing required review capability or a
material contract change. Do not weaken assertions or increase retry counts.

## Progress

### Approved configuration-only continuation

The September 8 approval supersedes the historical patch implementation below.
Main owns the scoped configuration, real runtime proof and existing draft
delivery. A bounded executor owns false-ready protection in
`util/dev-runtime.sh`, `util/dev-runtime-readiness.test.mjs`, and
`util/test-dev-runtime.sh`, with a dependency-free helper only if needed.

Explicit `pagesRouterOnly` opt-in defaults to false in the shared config.
Only Auth, Control, Manage and PWA opt in. Disable `clientRouterFilter` only
when the caller also passes `NODE_ENV=development`. App Router consumers,
production and test configuration retain the upstream default. A future
App Router migration must remove the opt-in.

Qualify three fresh application-process starts in the existing disposable
unpatched checkout. Each compares the live HTTP development manifest with
source routes and exercises synthetic nested HTTP paths. At least two starts
must pass the unchanged 12-test activity group with zero retries, including
normal client navigation. Recheck manifests after browser execution. Keep
cache preservation enabled, do not inject observation hooks, and verify the
resolved package and effective configuration. Stop and prove zero exact routes
between cycles. Preserve the retained task runtime and both databases outside
the existing synthetic test cleanup contract.

Readiness compares dynamic routes discovered from each selected Pages Router
app's `src/pages` with the running server's HTTP development manifest.
Normalize source extensions and terminal `index`; include dynamic API routes.
Missing or unreadable source, malformed or unavailable manifests, and missing
routes cannot pass an empty comparison. Inventory failures take precedence
over shell stale-cache classification and never return repair status 20.
Both HTTP requests share the remaining readiness budget; the existing
90-second deadline stays unchanged. No new repair loop or cache reset is added.

The test portfolio extends the existing readiness suites for a healthy shell
with incomplete inventory, eventual completeness, malformed/unavailable
inventory, a hanging manifest, selected-profile isolation and no cache repair.
A configuration matrix proves opt-in/development-only behavior. Main explicitly
wires these checks into the existing workflow in place of the aggregation test.
After qualification, remove the patch, registration and patch-specific harness,
then regenerate the lockfile natively without version changes. Update the
existing solution, complete committed-slice and final reviews, and push the
existing draft. Merge, release, shared infrastructure and runner changes remain
outside this approval.

Planner Confucius approved revision 2 after requiring source-driven membership,
repair-isolated failures within the existing deadline and explicit CI coverage.
The executor repeatedly revisited implementation choices without producing code
after a narrowing checkpoint. Main reclaimed its unchanged paths without
dispatching a replacement.

Three fresh process cycles now resolve unpatched Next 16.2.11 and expose every
source route: Auth 9, Control 8, Manage 34 and PWA 43. Each synthetic nested
HTTP probe returns 200. Actual process environments contain no observer hook.
The effective configuration matrix also verifies the four app wrappers, not
only the shared helper. Production and test keep the upstream filter default.
Two exact 12-test activity runs pass with zero retries in 2.1 and 1.7 minutes.
Post-run inventories remain complete. The third startup includes the new
source-driven readiness check and passes without cache repair.

One earlier invocation accidentally included unrelated cleanup tests through
an over-broad grep. It passed the activity group but failed two cleanup-only
tests whose setup was excluded. That invocation is not qualification evidence;
the two exact-filter runs above are separate. No test assertion was weakened.

The native unpatched lockfile regeneration uses pnpm 11.5.0 in the disposable
container, with scripts disabled and no installed dependency changes. Its
result is byte-identical to the target lockfile. The patch and patch-specific
handler harness are removed. The configuration matrix and readiness tests now
run explicitly in the existing checks workflow. The synthetic shell suite
passes; the readiness suite proves incomplete/malformed/source-missing failure,
eventual completeness, a shared 15-second request budget and the unchanged
90-second overall deadline. Full application builds remain for exact-head CI;
the changed option is absent from production/test configuration.

The final Playwright package typecheck passes in the disposable container.
The final exact stop is verified outside the sandbox's process-inspection
restriction: stopped, empty active membership, no drift and zero routes.
The qualification-only cache-preservation marker is removed after shutdown;
the worktree, source overlays, diagnostic artifacts and database remain intact.
All 28 host launcher/configuration checks pass with the Volta-pinned toolchain.
Scoped Biome, Prettier and diff checks pass. These focused checks replace the
broad application hooks for source commits; no full monorepo build is claimed.

The configuration/readiness source is committed at `cf3629cea6`; simplification
and bounded risk review pass without findings. Reports are
`_local/reviews/2026-09-08-next-no-patch-simplifier.md` and
`_local/reviews/2026-09-08-next-no-patch-slice-review.md`. The latter uses the
trusted native route for unpublished source, not the external GLM role.
Two existing PR comments correctly identified missing command-boundary
environment assertions. Commit `d7cccf3b13` adds them to existing tests;
all 28 host checks still pass. The prose-pinning suggestion is rejected because
validation already proves zero external calls, and the call-order suggestion
is obsolete after target integration. Whole-branch Gitleaks finds no leaks.
The final dependency definitions and lockfile match current `v3` exactly.
Integrated final review passes on all 20 paths through `6d03be2777`, with no
findings. Report: `_local/reviews/2026-09-08-next-no-patch-final-review.md`.
The local implementation and verification package is complete for the ordinary
draft update. Exact-head GitHub CI and human review remain before any separately
authorized merge. No runner, shared infrastructure or release change is included.

### September 8 causal observation and configuration-only comparison

This investigation leaves implementation and publication unchanged. Ref refresh
finds task head `95a6825b2ae8d976712a50c2cef45d3e6c8059f6`, 11 ahead and zero
behind `origin/v3`; the live PR still publishes `1129332039`. Main owns consumer
runtime observation and the causal decision. A read-only researcher covers
public upstream source only. The separate external advisor request was denied
because it included unpublished diagnostic reasoning; no such payload was sent.

The existing synthetic propagation-barrier test proves a possible stale-write
ordering, but does not identify the actual first-startup suspension. A temporary
observer in the disposable unpatched checkout therefore recorded Watchpack
inventory, scan identity, project-update timing, and actual dynamic-route
publication. It did not serialize callbacks, inject delays, change route values,
or retry. Observation can affect timing; the uninstrumented comparison below
therefore remains a separate evidence requirement. Automatic cache repair was
disabled with the existing preserve marker. No dependencies were installed,
source pages changed, database reset, or bundler/version switched.

The first observed startup reproduced an older empty publication overwriting a
complete newer publication in Auth and Control. A second, more narrowly timed
startup reproduced it in Auth, Manage, and PWA. In the PWA process, elapsed time
from first aggregation was:

| Time | Scan | Observed state |
| --- | --- | --- |
| 0 ms | First scan | Begins with zero page files; enters Turbopack project update |
| 42 ms | Second scan | Publishes 16 routes |
| 252 ms | Third scan | Publishes all 43 routes |
| 270 ms | First scan | Resumes and publishes zero routes, while shared pageFiles still contains 43 |

The HTTP development manifests subsequently reported PWA 0, Manage 0, Auth 0,
Control 8. Top-level readiness still passed. A synthetic nested-route 404 from
the preceding browser failure was `PageNotFoundError` for `/session/<id>`; it
was not an application selector or proxy failure.

The first scan's delay is `hotReloader.turbopackProject.update`, not ordinary
await-of-undefined propagation. All four apps report `appDir: false` and default
`experimental.clientRouterFilter: true`. The handler initializes its client
router filter even with no App Router paths, sets `envChange = true`, records
the filter as current, then awaits project update. Subsequent scans see the same
filter and skip that expensive update; they can overtake the first scan. When
the first scan resumes, it publishes its old snapshot. Progressive initial file
discovery plus out-of-order publication explains both top-level-only and empty
route lists. Bind-mount timing exposes this; OS watch exhaustion was not observed.

One configuration-only comparison set `experimental.clientRouterFilter: false`
in the disposable shared config, affecting only the selected Pages Router apps
in this run. It eliminated the initial project updates. PWA publications advanced
0, 16, 26, 37, 43 with no stale overwrite; Manage advanced 28, 34. Final HTTP
route counts were PWA 43, Manage 34, Control 8, Auth 9. A fresh application-process
startup after removing the observer produced the same four counts. Actual Next
process environments proved no observer injection, and package inspection proved
Next 16.2.11, the original async handler, and no serialization queue. Synthetic
PWA and Control session routes and the Manage cockpit returned HTTP 200.

This qualifies a targeted candidate, not a complete patch retirement. No full
browser group was rerun with this candidate. The filter is an experimental
cross-router navigation facility; a durable change must be scoped explicitly to
Pages Router-only development apps, preserve App Router/mixed-router behavior and
production configuration, and test normal client navigation. It removes this
startup trigger, not all possible asynchronous watcher races (e.g. later env,
tsconfig or middleware changes). Do not replace the dependency patch with a
global filter disable or infer that one green run proves all reload behavior.

Readiness should separately verify expected nested routes and report an
incomplete development inventory without interpreting every such failure as
corrupt disk cache. That is detection, not serialization. CI already runs built
Next apps through `start:playwright:ci`, the profile runtime, and `start:test`;
this reproduced failure belongs to local `next dev` qualification. Production
serving remains the recommended E2E boundary, but is not a fix for local HMR.

Evidence stays local: `/tmp/klicker-next-watch-observation.jsonl`,
`/tmp/klicker-next-watch-detail.jsonl`,
`/tmp/klicker-next-watch-filter-disabled.jsonl`, and the
`/tmp/next-filter-uninstrumented-*` lifecycle logs. No raw runtime evidence was
published. The disposable config and startup instrumentation are restored after
the final exact stop; synthetic database and prior test artifacts are preserved.

Primary source anchors:

- [Next 16.2.11 route watcher](https://github.com/vercel/next.js/blob/v16.2.11/packages/next/src/server/lib/router-utils/setup-dev-bundler.ts): first filter initialization around lines 774-815; latest route publication later in the same callback.
- [Next 16.3.4 route watcher](https://github.com/vercel/next.js/blob/v16.3.4/packages/next/src/server/lib/router-utils/setup-dev-bundler.ts): same structure; Webpack and Turbopack share the discovery handler.
- [Next client route filter](https://github.com/vercel/next.js/blob/v16.3.4/packages/next/src/lib/create-client-router-filter.ts): App Router path and optional redirect inputs.
- [Watchpack event aggregation](https://github.com/webpack/watchpack/blob/v2.4.4/lib/watchpack.js): snapshot inventory and non-awaiting aggregated event emission.
- [Next Playwright guidance](https://nextjs.org/docs/app/guides/testing/playwright): recommends testing built production code.

### September 8 fresh unpatched consumer comparison

The user approved a fresh disposable runtime, preserving the retained runtime
and its database. Proof checkout: `trees/rs/unpatched-next-proof`, branch
`rs/unpatched-next-proof`, based on exact v3 `e3fb9873c98a664987cc48f0ec9bbf51c9337e8a`.
Only the existing launcher profile option, retry/calendar fixes, and local
Hatchet HTTP endpoint correction were overlaid for test parity. Next remains
16.2.11 with no patch registration, unchanged lockfile, ordinary Turbopack dev
mode, and no polling override. Actual loaded-handler inspection confirms the
unpatched asynchronous callback and absence of the serialization queue.

Fresh container mount inspection proves per-package dependency volumes, including
all frontend apps. Initial runtime readiness passed with Devrouter 0.0.59,
34 Manage routes, and HTTP 200 from the synthetic cockpit route. The installed
Devrouter changed externally to 0.0.60 before browser qualification; both browser
cycles use that version. Its upgrade guidance was inspected without changing the
proof checkout's version pin. Host dependency installation ran only after stop.
The disposable app was recreated during first browser preparation; both browser
cycles then used container `29d2e9bb26e8eb9a18a701956e211e0f73142a6574963db9ae3afcaf852be8aa`.

Cycle one passed 12/12 in 2.2 minutes with zero retries. Exact stop then proved
empty active membership, zero routes and no drift. Cycle two started a separate
application process without installing host dependencies and failed: 7 passed,
1 failed, 4 serial successors did not run, in 2.1 minutes. The student live-quiz
step displayed the application's 404 page. At failure, the PWA development
manifest had zero routes and Manage had 28, down from 34. No assertions were
weakened. Logs are `/tmp/klicker-unpatched-proof-cycle-1.log` and
`/tmp/klicker-unpatched-proof-cycle-2.log`; screenshot, video and error context
remain under the proof checkout's `playwright/test-results/`.

Conclusion: the merged dependency-isolation correction alone does not prevent
this development-route failure. The first green run is not sufficient to remove
the patch. No patch removal, bundler switch, production-serving implementation,
runner change, or publication was performed. This is a real unpatched consumer
reproduction, but does not by itself prove the exact overlapping event sequence.

Final cleanup verification reports the disposable runtime stopped, with empty
active apps/services/processes, no drift, and zero exact-checkout routes. Its
database and diagnostic artifacts remain preserved; the retained task runtime
was not recreated or reset.

### September 8 upstream upgrade experiment and conflict resolution

The user approved testing unpatched Next.js 16.3.4, including an exact-version
exception to the dependency waiting period. Main owns this coupled experiment
and integration. The candidate was installed with scripts disabled in an isolated
temporary directory, without changing repository manifests or the lockfile.
The published package integrity is
`sha512-/Ztf6CeRH+ejEXUrYtqI4gkS66eFIHuSwqi60RgcpWKodxFZx2/dqVCMKBwILfAHXQ+F1b1vAudgj3mnxqtoIA==`.

The unchanged actual-handler suite loads both distributions successfully:
4 checks pass and 6 fail. Both overlap checks fail because two scans run before
the older publication finishes. Four early propagation-error checks also fail;
the four existing sorting-error checks pass. A separate outcome-only diagnostic
allows concurrent scans and checks final route membership. Both distributions
still publish `/old` instead of `/quizzes/[id]/cockpit`. This demonstrates stale
route state, not merely a preference for a particular locking implementation.

The candidate fails the regression gate. The proposed two browser cycles were
therefore not run: intermittent browser success cannot establish that this
deterministically reproduced race is fixed. No version bump or waiting-period
exception was committed. The existing 16.2.11 patch remains unchanged; its prior
browser evidence below is not evidence for 16.3.4.

The in-progress target integration uses `e3fb9873c9`, the v3 host/container
dependency-isolation change. Conflicts preserve its fail-closed pnpm policy and
host preparation before reconciliation, plus this branch's profile argument
contract and validation before external commands. Both workflow checks and both
documentation sections are retained. The combined launcher and dependency-mount
tests pass 34/34. No application runtime was started for this experiment.

September 8 pinned patch qualification: native pnpm patch and lockfile generated
for Next.js 16.2.11. Ten actual-handler checks pass across CJS and ESM; both
unpatched ordering controls fail at the intended overlap assertion. Eighteen
host launcher checks pass. Biome, syntax and diff checks pass. Turbo's Docker
prune includes byte-identical patches in `json` and `full` output; generated
lockfile changes are limited to patched Next references and peer deduplication.
Two fresh process startups both resolve the patched package and expose 34 routes,
including cockpit. The unchanged activity group passes 12/12 with zero retries
in 2.1 and 1.9 minutes. Between cycles, exact status is stopped, zero routes,
zero active resources and no drift. Final shutdown has the same verified state.
Slice simplification, correctness review and integrated final review pass with
no requested changes. The draft is published; exact-head GitHub checks and human
review remain before any separately authorized merge. Launcher/Hatchet
corrections are committed at `0c749d6034`.
No global runner or GitHub setting was changed.

### Approved pinned Next.js patch extension

The September 8 approval includes a native pnpm patch of Next.js 16.2.11,
without a version bump, bundler switch, global preload or runner mutation.
Main owns the coupled patch, regression harness and runtime qualification.
Serialize the complete Watchpack aggregation callback per watcher, reading its
inventory when each queued invocation begins. Preserve the existing handler
body and error policy. Catch escaped failures with startup rejection before
resolution and warning afterward; failures must not poison subsequent scans.
Apply equivalent CJS and ESM changes and generate the pnpm lockfile natively.

The regression executes the actual installed handler with synthetic bindings,
not copied queue logic. A controlled propagation barrier proves non-overlap
and final nested-route membership after addition/removal. The unpatched
handler must fail this ordering assertion. Cover failures before and inside
the existing catch, startup rejection, later-event recovery and no unhandled
rejections in both distributions. Extraction fails on missing/ambiguous anchors.

Qualify two consecutive exact-worktree starts. Each must resolve the patched
package, expose nested routes and pass the unchanged 12-test activity group
with zero retries. Stop and verify stopped runtime plus zero exact routes after
each cycle. Stop on failed regression, startup, browser proof, resolution
mismatch or unrelated lockfile churn; do not broaden runtime repair. Complete
independent implementation reviews before ordinary draft-PR delivery. Merge,
release and infrastructure changes remain excluded.

Planner revision 1 identified the partially covered callback error boundary;
the requirements above incorporate every finding. Diagnostic serialization
supports this bounded experiment, not a definitive causal or readiness claim.

The existing retry/calendar fix is commit `29965a153f`; the approved target merge
is `d9cf28ab49`. The branch originally has two changed source files, 14 additions
and six deletions relative to its target. Container formatting/typecheck passed;
the prior browser run reset and recreated activities on retry without duplicates,
but finished 2 passed, 1 failed and 9 not run because cockpit navigation returned
a Next.js module-resolution 404. Warm preparation subsequently rejected surviving
children. The exact runtime was stopped; no further repair is authorized here.

Fresh launcher baseline: 13 Node tests pass. Planner Hooke approved revision 2
after requiring a precise argument boundary and mandatory command-wiring proof.
Native agents are now available again; OpenCodex readiness reports ready.
Current work is the isolated launcher extension. Browser qualification and
independent implementation reviews remain outstanding; there is no PR yet.

Launcher source and guidance are committed at `b359fae8dd`. All 17 launcher
tests, syntax checks, scoped Prettier and staged Gitleaks pass. Source-only
checks replaced broad application hooks; no full build or browser pass is
claimed. The executor repeatedly revisited design without an edit after a
narrowing message, so it was closed and main completed the same approved scope.
There was no replacement executor or runtime operation.

Slice simplification is complete: no justified reduction in the four changed
paths. Report: `_local/reviews/2026-09-07-runtime-profile-simplifier.md`.
Lifecycle-risk review passed for the committed launcher slice; the report is
`_local/reviews/2026-09-07-runtime-profile-slice-review.md`. This is not final
package readiness. Installed Devrouter 0.0.59 now starts the selected profile.

September 8 continuation: main owns the remaining coupled consumer diagnosis
and launcher correction after the previous executor exhausted its correction
budget. The launcher now disables pnpm's implicit workspace-wide pre-run repair
while preserving explicit install commands. All 18 launcher tests pass. A real
host browser invocation without an environment override reaches the tests.
Invoking the launcher through an outer pnpm command can still trigger repair
before the script starts; use `volta run node util/run-playwright-host.mjs` for
this deliberately partial host dependency tree.

The latest focused run has two passing tests, one failure, and nine not run.
It fails before publication because Next.js returns a cockpit page-module
ENOENT and HTTP 404. Earlier runs reached publication and failed in Hatchet's
HTTP scheduling client. Values-free endpoint inspection shows the local token
advertises localhost:8888, while Hatchet runs in a sibling container. The local
environment now explicitly sets the existing HATCHET_API_URL to compose DNS;
Turbo already forwards this variable. Runtime verification of this correction
and the complete retry group remain outstanding. No assertions were weakened,
no runner settings changed, and no PR has been published.

The next September 8 reproduction also finished two passed, one failed, nine
not run, before publication. Direct unauthenticated requests to a synthetic
cockpit route return 404. The live Next.js development pages inventory contains
only seven top-level routes and omits every nested route, although the source
files exist. A standalone probe using Next's bundled Watchpack, including its
recursive ignore predicate, discovers all 34 TSX routes. This rules out the
Playwright click sequence and simple missing source files, but does not yet
explain the running server's incomplete route inventory. No speculative route,
bundler, timeout, or assertion change was made. The Hatchet endpoint correction
still lacks publication proof because this earlier failure blocks the journey.

Subsequent diagnostic qualification: temporary instrumentation around the
bundled Watchpack aggregate callback observes a complete 34-file route scan
while Next serves an empty route inventory. A temporary promise queue around
that callback produces the complete 34-route inventory. The unchanged focused
browser group then passes all 12 tests in 2.1 minutes with zero retries,
including activity publication, participant views, and cleanup. This qualifies
the Hatchet HTTP endpoint correction and demonstrates a viable workaround for
the route issue; it is not proof of a production-ready Next.js patch or of the
uninstrumented branch. The temporary preload and startup edit are removed.
The remaining proposed scope is a reviewed, pinned Next.js dependency patch,
with focused ordering coverage and repeat startup/browser qualification; no
dependency patch, bundler switch, or version change has yet been applied.
