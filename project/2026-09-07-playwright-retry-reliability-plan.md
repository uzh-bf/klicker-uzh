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

The main risk is under-provisioning a focused test: the caller must request all
needed profiles. Argument validation must finish before any external command.
Success requires command-boundary regression tests, unchanged default behavior,
and a complete browser run of the retry group. The latter is currently blocked
by local runtime failures owned by the existing Devrouter task. Source checks
alone do not qualify that browser behavior. No new runtime-repair loop is added.

## Execution details

Worktree: `trees/rs/playwright-activity-retry-safety`.
Branch: `rs/playwright-activity-retry-safety`; target: `v3`.
Integrated baseline: `d9cf28ab49a422d16e5ab89e4281ffa9ad47ebfd`, including
target `65ae8a3523`. Boundary owner: self. Artifacts root: `project/`.
This is a full-path package because the launcher changes a lifecycle contract.
General lifecycle hardening stays with the existing Devrouter task; this package
does not edit its repository. No new product primitive, dependency or irreversible
architectural choice is introduced; no ADR is required.

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
Lifecycle-risk review is running as
Planck (`01a07c1d-6e4c-7972-ad81-45ae273376f5`). Both cover the complete
committed launcher slice, not final package readiness. Installed Devrouter
remains 0.0.55. Its owner reports synthetic recovery and eLearning warm-resume
proof but no new release, and neither the Klicker preparation-child failure
nor the cockpit ENOENT is qualified. The next delivery gate is complete
Klicker browser verification after that owned runtime blocker is resolved.
