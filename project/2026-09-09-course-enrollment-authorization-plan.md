# Course enrollment through PIN and LTI

## Approval summary

Authenticated participants must not acquire course membership merely by opting
into a leaderboard or supplying a course ID during ordinary signup. A verified
LTI launch into any supported course page must continue to create participation
for an existing LTI-linked account, including when a participant session already
exists. Membership and leaderboard visibility remain separate.

The user authorized implementation and a PR on 2026-09-09. This is a full-path,
executable batch: implement the bounded correction, run local synthetic checks,
complete independent reviews, and publish a draft PR against `v3`. Merge,
deployment, real enrollment, OLAT configuration changes, and restricted course
content are excluded. Preserve existing identity linking and assessment
invitation rules; no schema or dependency changes are planned.

Generated LTI links currently use query `redirectTo`. Preserve these links in
the core correction. Strict binding of LTI identity to a verified course is a
separate compatibility decision pending the user's answer; do not change that
contract silently. The current handoff authenticates identity but accepts the
course separately. A completed core correction must disclose this limitation. This pending ruling gates only additional strict-binding work, not the independent core correction. Even custom redirect claims do not currently bind the separately supplied enrollment course.

Success means ordinary login/signup cannot create course membership without
PIN or LTI, existing members can opt into a leaderboard, and supported LTI page
launches create exactly one participation without opting into the leaderboard.

## Execution details

Authority: local source/test/documentation changes, synthetic disposable local
runtime checks, commits, ordinary task-branch push and draft PR are approved.
Terminal: verified and independently reviewed draft PR, with exact evidence and
limitations, and the task runtime stopped. Boundary owner: self.
Pause: an incompatible LTI link migration or account identity change needs the
user's ruling; infrastructure and live-system changes remain excluded.

### Working context and evidence

- Repository: `klicker-uzh`; branch `rs/course-enrollment-authorization`; worktree
  `trees/rs/course-enrollment-authorization`; target `v3`.
- Refreshed baseline: `d3a1853565e220fc97e28ce4bf22c1aca66b5ab4`.
- Inspected staging source: `39571575b720328c9756dd9e4bef4950a4eeced0`.
  No live exploit or live deployment claim.
- `courses.ts:joinCourseLeaderboard` upserts participation without an enrollment
  check. `accounts.ts:createParticipantAccount` has a non-LTI course-ID upsert.
  `resolveOrCreateParticipantForLti` separately creates participation, defaulting
  to inactive, after signed LTI identity resolution.
- `getParticipantToken` deliberately processes fresh LTI launches even with an
  existing session. Preserve this behavior and its cookie/query handoff support.

### Primitive impact

| Primitive | Disposition | Contract and consumers |
| --- | --- | --- |
| Course participation | Extend enforcement | First membership requires PIN, existing supported LTI enrollment, or assessment invitation; login alone supplies identity. |
| Leaderboard opt-in | Reuse | Change visibility only for existing membership, including inactive participation. |
| LTI account identity | Reuse | Keep existing subject/email resolution and repeat-launch behavior. No account switching policy redesign. |

### Ownership and sequence

One cohesive PR, no stack. Main owns authorization decisions, integration,
runtime, and delivery. The explore worker owns the route coverage matrix.

| Workstream | Owner | Paths and handoff | Acceptance |
| --- | --- | --- | --- |
| Backend membership boundary (slice 1) | Main | GraphQL courses/accounts services and enrollment tests | No membership from login/signup alone; PIN and LTI membership retained |
| Supported course launches (slice 2) | Executor | PWA course pages and narrow LTI token/redirect helpers; main integrates browser tests | Complete target/branch matrix below |
| Final proof and delivery (slice 3) | Main | Browser tests, auth-model documentation and plan | Focused checks, independent reviews, draft PR and stopped runtime |

The read-only explore mapping is an input to slice 2, not another implementation
owner. Executors do not own backend changes or publication. Native planner challenges this draft;
simplifier and slice reviewer inspect the committed implementation; the final
reviewer inspects the complete verified package.

1. Close course-ID-only membership creation. Preserve nullable mutation failure
   behavior and make the leaderboard write unable to create a missing row.
   Ordinary signup may create an account but must not enroll it from `courseId`.
   Route: main, because authorization and compatibility decisions are coupled.
   Acceptance: service and GraphQL boundary tests on guarded disposable data.
2. Preserve automatic LTI enrollment across the complete supported course-page
   matrix. Correct missing entry points only where the route investigation
   establishes the same intended launch contract. Route: executor for the
   PWA paths in the Delegation Map; main integrates the result. Acceptance: existing LTI
   linking suite plus actual local browser launches and persisted membership
   checks for each supported target and its zero/one/multiple activity branches.
3. Verify, review, document, and publish the whole correction. Route: main plus
   required independent reviews. Acceptance: applicable build/check/lint/format,
   focused tests, browser proof, reviewed diff, draft PR read-back, and runtime
   shutdown proof.

### Supported launch coverage

Generated course LTI targets include course overview, course docs, all three
activity overviews, and direct practice/microlearning activity starts. Include
course-scoped live-quiz entry and legacy course activity aliases as compatible
entry points. Preserve a scalar query `jwt` through same-app legacy redirects.
For course docs and live-quiz exits from the course route, establish enrollment
before redirecting; preserve the usable participant session on cookie-blocked
launches. Ordinary navigation must not manufacture enrollment.

For activity overviews, test valid courses with zero, one, and multiple
activities. Enrollment must run before empty-state returns and single-activity
redirects. Keep existing navigation behavior. Internal question/evaluation and
bookmarks pages are not generated LTI launch targets; inspect the route map for
any supported direct launches before deciding whether their entry contract needs
extension. Standalone `/session/:id` without course context keeps its existing
anonymous/PIN/assessment behavior; this package must not infer arbitrary course
authority from a session query parameter.

Fresh LTI identity resolution takes precedence over an existing participant
session, as it does today. Verify no session, the same-account session, and a
different synthetic account session. Only the LTI-resolved account receives
membership and the resulting session; the unrelated account remains unchanged.
Keep failed/expired LTI handoffs fail-closed and retain the existing token-helper
failure behavior. Exercise cookie and query-only handoffs and repeated launches.

### Test portfolio

| Risk | Coverage disposition |
| --- | --- |
| Login-only membership creation | Add focused GraphQL/service denial coverage; verify no participation or leaderboard write. |
| Existing inactive member cannot rejoin | Add behavioral opt-in/repeated-call coverage; preserve score and membership identity. Relaunch must retain opt-in and scores. |
| Signup bypasses enrollment proof | Extend account coverage for ordinary signup with a supplied course ID, invalid PIN/leaderboard denial, and successful subsequent valid PIN enrollment. |
| LTI first/repeated launch and opt-in separation | Extend `accountLtiLinking.test.ts` to assert one inactive membership and no leaderboard entry; retain identity linking/creation tests and reject assessment courses through both LTI mutations and PIN. |
| Course route skips LTI enrollment | Add browser regression coverage using synthetic signed handoffs for target shapes, existing sessions, and query fallback without LTI cookies. |

Use `requireDisposableDatabase` on the actual Prisma client before new fixture
writes and cleanup. Run GraphQL tests serially in the task's self-contained
runtime. Synthetic signed handoffs prove the application seam, not OLAT or the
ltijs cryptographic launch implementation. No external LMS calls are planned.
Tests assert behavior and machine contracts, not prose or seed contents.

This is nonvisual authorization work; no copy or layout redesign is planned.
Browser checks and local before/after captures still apply to the auth flow.
A hosted screenshot gallery is required only if implementation changes visible
UI. Update `docs/auth-model.md` to describe the corrected enrollment boundary
and retained LTI target-binding limitation. No ADR: this restores the clarified
existing domain contract without a new hard-to-reverse architecture decision.

### Research and compatibility

The prior Context7 lookup confirms ltijs `onConnect` receives a validated launch;
the installed dependency's full validation and live configuration are unproven.
No new library behavior is required for the core correction. Generated query
launch targets are an explicit compatibility constraint, not proof of course
authorization. The optional AGY challenge must remain scoped to this plan and
source files, excluding secrets, raw data, restricted course content and prompts.

## Progress

Draft awaiting planner challenge. No implementation committed; no PR exists.
Route mapping is assigned to the read-only explore worker. The local runtime is
starting with `pwa,email` for synthetic verification. Strict LTI course-binding
scope awaits the compatibility answer. Next: finish the bounded mapping and
planner pass, then execute approved independent corrections.
