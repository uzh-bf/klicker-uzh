# Reliable activity retries and explicit local test profiles

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

The approved continuation also patches the pinned Next.js development route
watcher and fixes the local Hatchet HTTP endpoint. No dependency version changes.
Repeated startup and browser qualification must pass before draft delivery.

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
Integrated baseline: `d9cf28ab49a422d16e5ab89e4281ffa9ad47ebfd`, including
target `65ae8a3523`. Boundary owner: self. Artifacts root: `project/`.
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
`manage,live-quiz`; it is source-supported, not yet runtime-qualified.

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
Slice simplification and correctness review pass with no requested changes;
integrated final review and draft publication remain. Launcher/Hatchet
corrections are committed at `0c749d6034`.
No global runner or GitHub setting was changed. No PR exists yet.

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
