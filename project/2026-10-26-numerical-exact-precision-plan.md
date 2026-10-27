# Preserve decimal exact solutions in numerical questions

## Approval summary

Numerical-question authors can enter a decimal exact answer, leave Precision
empty, and silently save a rounded integer. The current save helper turns an
absent precision into `NaN`, which makes `toFixed` use zero decimal places.
It also rounds newly typed strings but skips existing numeric answers.

Preserve decimal answers when Precision is empty. Treat explicit `0` as integer
precision and positive precision as the selected number of decimal places.
Apply that rule consistently when an author changes an answer or Precision,
including edits that clear Precision. Preserve unchanged saved exact answers
on unrelated edits, even when they have more digits than their stored precision. Validate explicit precision as
a whole number from `0` through `100` before rounding, with a localized error
for unsupported values. Verify preview input precision and prove exact-answer
fidelity through the mutation payload and reopened question.

Deliver one focused fix against `v3`, with regression coverage in the existing
numerical-question Playwright suite and real browser evidence. No new dependency,
schema migration, grading change, or bulk data repair is proposed. Answers
previously saved as zero cannot be reconstructed by this change; authors must
re-enter their intended answers. Ordinary source revert provides rollback for
the code, but cannot reverse answers saved by users.

The principal risk is changing an existing answer when an author explicitly
lowers Precision. That rounding is intentional under this proposal and must
match the behavior for a newly typed answer. An unchanged legacy precision and its unchanged exact answers remain savable
on unrelated edits; new or changed unsupported precision is rejected. Stored
questions are not rewritten.
No unresolved product choice remains beyond approval of this contract. Local
verification adds no model/API requests; existing review and CI usage apply.

The user approved this executable batch with "execute with a goal", then required
that existing questions remain compatible. This authorizes implementation,
disposable local verification, configured reviews,
commits, ordinary task-branch pushes, and draft PR delivery. It ends at a verified
draft PR; merge, readiness, deployment, data repair, and human notifications remain
outside this batch.

## Execution details

### Contract and evidence

| Precision | New or changed exact solution, supplied as string or number | Saved result |
| --- | --- | --- |
| Empty, null, or absent | `-0.02` | `-0.02`; precision remains unset |
| Explicit `0` | `-0.02` | `0`; precision remains explicitly `0` |
| `2` | `-0.024` | `-0.02`; precision remains `2` |
| Cleared after previously being `2` | `-0.024` | `-0.024`; precision becomes unset |
| Unchanged persisted `2` | Unchanged persisted `-0.024` | `-0.024`; unrelated edits preserve the answer |

Equivalent positive decimals follow the same rules. Preserve the existing
rounding mechanism for valid explicit precision; do not introduce a new tolerance
or reinterpret exact solutions as intervals. Clearing Precision removes the
restriction but cannot restore digits lost during earlier rounding.

Supported explicit precision is a finite whole number in `0..100`, matching the
rounding operation's bounds. A new or changed unsupported value blocks submission with an EN/DE validation
message; it must not be clamped or silently treated as unset. Preserve an
unchanged legacy precision when its saved exact answers are unchanged. Guard
the conversion before calling `toFixed`, including when a caller supplies loaded
numeric answers. Pass the original persisted options explicitly to distinguish
unchanged answers from intentional changes; draft/autosaved values cannot grant
the legacy exception. A bypass of form validation must use a handled submission error
rather than an uncaught rounding exception. The template consumer must preserve
this failure behavior for unsupported loaded precision.

Evidence inspected at `origin/v3` commit
`1c2dbe5317224726bc10d5542c6ee980fbfa02cc`:

- `apps/frontend-manage/src/components/elements/manipulation/helpers.ts`,
  `prepareNumericalArgs`: the string branch always calls `toFixed`, while the
  number branch returns unchanged. The precision property uses a truthiness
  check that can omit numeric zero.
- `options/NumericalOptions.tsx` and `options/NumericalExactSolutionsInput.tsx`
  in that directory stringify absent precision and can pass `NaN` to the input.
- `useElementFormInitialValues.ts` loads exact solutions as numbers;
  `ElementEditModal.tsx` submits the helper output. Live-quiz template processing
  also calls the same helper, so it must retain the same contract.
- `useValidationSchema.ts` currently checks only the minimum precision, so
  applying rounding to loaded answers needs an upper-bound and integer guard.
  A local Node probe confirmed that precision `100` succeeds and `101` raises
  `RangeError`; fractional precision is silently truncated by `toFixed`.
- `packages/graphql/src/lib/validateAndProcessElementOptions.ts` preserves
  numerical precision and exact solutions. `packages/grading/src/index.ts`
  compares against stored exact solutions; it cannot recover a corrupted answer.
- `playwright/tests/I-elements-numerical.spec.ts` covers creation, editing,
  persistence, ranges, and exact solutions, but sets explicit precision before
  exact solutions. There is no manage component-test layer or manage unit suite.

The previous investigation executed the actual save function extracted from
tracked source, using synthetic form values. Empty precision changed the string
`-0.02` to `0` in the JSON payload; precision `2` preserved it. The current helper
retains that code. This is source-level evidence, not browser or serving evidence.

### Primitive impact

| Product primitive | Disposition | Contract delta | Consumers |
| --- | --- | --- | --- |
| Numerical question with an exact solution and optional precision | Reuse | Enforce one precision meaning across input and save; preserve unset decimals and reject unsupported explicit precision before rounding | Question creation, editing, duplication, template authoring, preview, and downstream grading of saved answers |

The API shape, ownership, permissions, range semantics, and grading algorithm
remain compatible. No new primitive or ADR is warranted for this defect fix.
An API-wide precision policy, grading-tolerance change, migration, or automatic
repair of existing answers would require a separate decision.

### Ownership and sequence

Execution mode: `standard` for the current `gpt-6.1-sol` model. Ceremony: full
path because the defect changes persisted correct answers. Keep one small,
cohesive branch and ordinary PR. The isolated defect is exempt from the package
size floor. There is no need for a PR stack.

| Workstream | Slice | Owner | Handoff and acceptance |
| --- | --- | --- | --- |
| Regression and source fix | 1 | Routed executor | Settled contract; first failing and then passing persistence regression |
| Browser verification and delivery | 2 | Main | Slice 1 integrated; real save/reopen proof, checks, reviews, and draft PR |

#### Slice 1: preserve the answer throughout authoring and save

Route: `executor`. Add the missing regression first to the existing numerical
spec, with test-owned synthetic input and stable selectors. Do not couple the
new assertions to shared seed text or question counts. Use the existing guarded
local test setup.

Make the smallest correction in `prepareNumericalArgs` and the existing numerical
input components. Distinguish absent precision from zero and normalize exact
solution values consistently. Prevent absent precision from becoming `NaN` at
the input boundary. Preserve decimals when unset and round strings and numbers
equally when explicitly configured and the answer or Precision changes. Preserve
unchanged persisted answers under unchanged precision, including when a sibling
answer is edited. Do not add a module or dependency.

Required source scope is `helpers.ts`, `options/NumericalOptions.tsx`, and
`options/NumericalExactSolutionsInput.tsx` under element manipulation. Inspect
`useArtificialElementInstance.ts` and `types.ts`; change only the corresponding
precision conversion/type if the actual field state demonstrates a mismatch.
Extend numerical precision validation in `useValidationSchema.ts` and update
the existing `manage.formErrors.NRPrecision` message in
`packages/i18n/messages/en.ts` and `packages/i18n/messages/de.ts` for the supported
range. Keep unrelated question types and validation rules untouched. Inspect
the template helper caller's error handling; change only its existing submission
boundary if necessary to present the same safe rejection for invalid precision.

Acceptance: the test catches the original save/reopen corruption before the
patch, then passes the portfolio below. Inspect mutation variables as part of
the browser regression to distinguish serialization failure from display-only
behavior. Verify the existing template caller still compiles and uses the same
normalization and handled failure behavior; exercise it with synthetic valid
and legacy unsupported loaded precision. Forward persisted options through the
normal edit and template forms and serializer call sites. This adds the existing
`ElementEditForm.tsx`, `ElementEditModal.tsx`, and template form/caller files to
the narrowly changed precision boundary. Commit as one coherent `fix` slice.

#### Slice 2: verify and deliver the complete fix

Route: `main`. Execution-tier skip reason: critical-path coupling between
integration, browser acceptance, external PR delivery, and final proof.

Run the focused numerical suite and applicable repository checks. Capture the
original and corrected editor states with `agent-browser` and use
`rs-build-screenshot-gallery` for the PR evidence. Cover desktop save/reopen,
editing and clearing Precision, and a narrow viewport. Check both EN and DE
number entry with the same synthetic decimal and the localized validation
state. Preview acceptance covers decimal response entry and the selected input
precision only: it does not display or grade exact solutions. Prove exact-answer
fidelity through mutation variables and save/reopen assertions; adding preview
solution support is outside this fix.

Apply the configured simplifier and data-integrity slice review to the committed
source slice, disposition findings, and run one integrated final review after
verification. Use the existing same-reviewer correction budget. Keep findings
and captures in ignored `project/_local/` paths. Prepare the whole-branch draft
PR with `rs-mr-description-writer`, retain required human review gates, and use
the repository CI observer for terminal evidence. Routine source commits and
the plan belong to this same implementation PR.

### Test portfolio and verification

| Consequential behavior | Existing evidence and obligation | Primary seam / distinct failure | Slice |
| --- | --- | --- | --- |
| An unset precision preserves positive and negative decimal exact answers through create, edit, save, and reopen | Extend existing numerical Playwright spec | Real form and mutation persistence; catches silent truncation | 1 |
| Explicit `0` persists; changed answers or changed Precision round consistently, while unchanged persisted answers retain their value | Extend the same focused regression with equivalent cases and synthetic legacy answers | Real form and mutation variables; catches omitted zero, type-dependent rounding, and accidental legacy rewrites | 1 |
| Clearing precision removes the restriction; an unrelated edit preserves the answer | Extend the same synthetic workflow | Reopen and edit transitions; catches stale precision or normalization on a later save | 1 |
| Unsupported explicit precision cannot throw during save | Extend the focused workflow for precision `101`, and probe loaded/template input rejection; verify `100` remains accepted | Validation and handled submission boundary; catches the new crash risk from rounding loaded answers | 1 |
| Existing ranges, numerical restrictions, and exact-answer workflows still work | No new tests; run existing numerical suite | Existing behavior coverage; catches accidental widening of the patch | 2 |
| Input, preview, and layout remain usable in relevant viewports/locales | No additional permanent test layer; real browser captures and interaction checks | Rendered and interactive behavior that the save helper cannot prove | 2 |

Run `node util/run-playwright-host.mjs tests/I-elements-numerical.spec.ts --project=chromium`
from the host against the exact routed disposable worktree stack, using the
existing host wrapper and its installed help/config for target options.
Install/build/typecheck work runs inside the container. Use repository-native
format, lint, type, secret, and build checks required by hooks; report any
unresolved failure rather than bypassing it. No new test runner is needed.

Implementation uses `klicker-frontend-ui`, `klicker-testing-verification`, and
`klicker-playwright-e2e`; consult `rs-find-docs` before relying on version-sensitive
library behavior. No external research is needed to choose the contract.

Documentation disposition, revised after the user's correction and Opus
consultation: restore the numerical-response tutorial to its upstream text.
The fix restores expected behavior; save mechanics and legacy preservation
belong in engineering and change artifacts. Encode the documentation decision
policy in `docs/developing-a-feature.md` with a discovery link in `AGENTS.md`.
No user-facing docs change remains against the target. Validate formatting,
policy links, and the restored tutorial without starting an application runtime.

### Working context, authority, and recovery

Repository: `/Volumes/HOME/Git/klicker/klicker-uzh`.
Worktree: `trees/rs/fix-numerical-exact-precision`.
Branch: `rs/fix-numerical-exact-precision`. Target: `v3`, resolved from repository
instructions and `origin/HEAD`; recorded target SHA is above. Artifacts root:
`project/`, the sole existing root. Preserve unrelated primary-checkout files.

Approval mode: **executable batch approved** by the user's instruction
"execute with a goal", with the subsequent constraint that existing questions
must not break.
Boundary owner: **self**.
Authority now: the finite implementation and draft delivery sequence
in the summary, including a fresh disposable managed `manage` profile when needed
for verification. Read `rs-local-runtime-lifecycle` before starting that runtime;
stop and verify this exact runtime after the last runtime-dependent check.
Do not delete its worktree or volumes.

Use only synthetic/seeded local content and the restricted marked disposable
test databases. No production query, repair, external paid model call, new
secret, cluster connection, or infrastructure change is necessary. Keep the
reported conversation and identifying material out of public artifacts.

Terminal: required checks and reviews pass, browser evidence demonstrates the
contract, and a draft PR against `v3` contains the plan and fix with an accurate
description and CI evidence. No PR exists at planning time.
Pause: a required tool/review/test capability remains unavailable after its
permitted recovery, or a new product/data/authority decision is needed. A failed
test first triggers focused diagnosis within scope; it does not grant broader
environment repair. Missing disposable markers stop mutation. Report concrete
CI or environment blockers and keep the draft incomplete. Failed conditions
block only dependent actions.

Alternative rejected: require authors to enter Precision for every exact
answer. This adds an unnecessary restriction and contradicts the optional
field. Reopen only if evidence establishes an intentional integer default
across existing consumers. A larger precision-policy refactor is out of scope.

## Progress

2026-10-27 readiness continuation: strict target freshness now requires
integrating `v3` at `80885112ac9889dc67b4dea1820ffa89c9cd08eb`.
Its single staging-CI correction merges without conflicts and changes no
numerical application code, tests, or dependencies. All 51 staging-promoter
contract checks pass; staged secret and whitespace checks pass. Preserve the
existing application reviews and browser evidence. Next: publish the ordinary
merge and verify required hosted CI on its head. The separate final AI review
remains incomplete after its failed tool-access preflight.

2026-10-27 documentation follow-up: the user requested an Opus consultation
and a durable policy for deciding when user docs need updates. Opus recommended
restoring the tutorial; the policy now lives in the existing feature guide,
with root and lifecycle discovery links. Formatting, frontmatter, and policy
links pass; the tutorial matches upstream. No application source or tests
changed, so existing behavior checks remain reusable. Main reviewed this
documentation-only correction. The earlier readiness attempt did not complete
final review; this correction does not establish merge readiness.

2026-10-27: the user authorized the next readiness sequence for
[PR #6741](https://github.com/uzh-bf/klicker-uzh/pull/6741): integrate current
`v3`, resolve the remaining advisory review thread, mark ready, and run the
normal final-review process on the refreshed head. This supersedes the earlier
draft-only terminal for those named actions. Merge into `v3`, deployment, and
data repair remain outside scope. The unchanged numerical-answer compatibility
contract and regression portfolio still apply.

First readiness integration target: `4b09b2f2b2bac1d5e028af2203942a50edcfbf41`,
the `origin/v3` head at that pass. Reason: strict required checks need an up-to-date branch.
The upstream CI-routing change has no path overlap with the precision fix.
Preserve history with one ordinary merge into the task branch and a non-force
push. Reuse source reviews and browser captures because the affected source,
dependencies, and application behavior are unchanged; obtain new hosted CI and
the separate final-review result for the integrated head. Resolve the advisory
helper-extraction thread without refactoring, following the user's verified
disposition. Main owns this coupled integration and forge-readiness sequence.
Acceptance: refreshed checks succeed, no unresolved review threads remain,
the PR is ready, and final review actually runs against the held head. Any
required human review or new finding remains visible and blocks merge.

The first refreshed run exposed an upstream CI failure before job creation:
GitHub could not resolve the seven immutable reusable-workflow references
imported from `v3`. Repin only those seven caller references to the merged
target commit above. Each referenced executor is byte-identical at the old
and replacement commits; permissions, admission, runners, and job definitions
are unchanged. Treat this as the bounded repair needed to run the authorized
validation sequence. Verify generated/pinned parity, existing CI contracts,
and actual workflow job registration before accepting the new candidate.

2026-10-26: execution started. Root outcome: prevent silent loss of decimal exact
answers, following the approved plan and the user's compatibility constraint.
Current authorized terminal: verified draft PR against `v3`.

First useful acceptance: a real create/edit/save/reopen regression preserves
`-0.02` with Precision empty. Proven path: form save helper to mutation payload;
API pass-through and grading consumers inspected. Browser/widget behavior is
still unverified and belongs to execution acceptance.

Completed: source diagnosis, task worktree, approved plan, implementation,
synthetic serializer/schema checks, secret and focused Opengrep scans,
simplification, and independent data-integrity/integrated source reviews.
The test executor and both native review children are closed. Source candidate
`8d9d272bdd4ed469fb9939ee64906ddb660e6553` includes the verified correction that
awaits mutation completion before database assertions. Substantive package size:
401 added and 23 removed lines, excluding this plan. One cohesive isolated bug
fix remains the package boundary.

Draft PR: [#6741](https://github.com/uzh-bf/klicker-uzh/pull/6741), target `v3`.
Required delivery: verified draft PR; achieved delivery: source and tests pushed,
verification incomplete. One CI observer owns the candidate watch; its local
session and evidence are recorded under `project/_local/reviews/`.
Browser/runtime checks remain blocked by Docker reporting that all predefined
address pools are fully subnetted. The failed task's provider state is
`NotFound`, and zero exact routes exist. Canonical stop is refused because the
failed runtime has no complete selected population; no task containers exist.
No unrelated network, container, volume, or client configuration was modified.
Startup selected the already-installed compatible Volta devrouter instead of
the older `.local/bin` binary.

Required remaining proof: terminal candidate CI, actual browser save/reopen,
locale and narrow-viewport checks, and screenshot publication. No data repair,
readiness, merge, or deployment is authorized. Next action: resolve candidate CI
findings; browser proof requires restored local Docker capacity and a usable
managed lifecycle. No failed runtime startup is a passing acceptance check.

Compatibility refinement from the user's latest instruction supersedes the
blanket normalization of existing numeric answers: unchanged saved exact answers
must survive unrelated edits even when their digits disagree with stored
precision. Normalize a loaded answer only when that answer or Precision changes.
Unchanged legacy precision outside the new authoring bounds must likewise retain
its previous save behavior when its exact answers are unchanged. New or changed
unsupported precision remains rejected. Add synthetic legacy coverage; no data
discovery or repair. Main owns this tightly coupled form/save boundary because
it requires deciding how to preserve loaded state; the executor owns the
independent test-only seam.

Review provenance: native planner `01a179e5-4010-7d73-8dc2-c42fe5456653` returned
`REVISE` in round 1. Accepted all three findings after source verification:
use the canonical host launcher to avoid pnpm host-dependency preflight; bound
explicit precision to prevent new rounding exceptions; limit preview acceptance
to response entry. Round 2 returned `APPROVED`; reviewer child closed. Full
transcript: `project/_local/reviews/2026-10-26-numerical-exact-precision-plan-hardening.md`.
Planning terminal reached; implementation approved by the user. Native slice
review found one test race, corrected in `8d9d272bdd` and verified by the same
reviewer. Integrated Claude review of `1c2dbe5317..8d9d272bdd` found no source
defect; its one stale-plan-wording finding is corrected in this update and
verified by the main session. Source review remains reusable; missing browser
and CI evidence is not waived.
The optional opposing-provider
check is unavailable: `agy models` reported missing Antigravity authentication
and sandbox-denied cache/log writes. Do not change agent configuration or retry
authentication for this plan. This does not waive the required planner critique.
