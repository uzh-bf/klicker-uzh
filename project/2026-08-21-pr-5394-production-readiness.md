# Production readiness — PR #5394 current-state audit

## Execution snapshot (2026-08-22)

This is a dated release-gate snapshot for source commit `3c0b11398b8ed40be962d78dd9823134b4c831b3`, the correction commit `1035a3a2f`, and the simplification head `a07def5b5`. The PR source is based on `v3` at `f58986faa8cfa4ff78d20a1ebeb1666473343d38`, the exact-head Playwright rerun is green, and the native Sol review completed its correction pass. The two PR documentation logs are removed. GitHub remains the live source for later CI and approval state.

The final database-backed invitation suite passes 21/21 after a clean disposable reset. The concurrency regression forces two service calls through one shared Prisma query extension, uses a five-second barrier, releases it in `finally`, and awaits both operations before fixture cleanup. Migration status reports 178 migrations and an up-to-date schema. The course-history migration uses `CREATE INDEX CONCURRENTLY` as its single SQL statement so index construction does not take the normal write-blocking lock.

GraphQL generation passed twice without generated-artifact changes before the simplification head, then regenerated cleanly once more after removing the unused unbounded field. GraphQL, Prisma, frontend-manage, and repository checks passed at both heads. The repository build completed with 23 successful tasks and exit code 0. `check:all` remains blocked only because the analytics image lacks a C compiler while building `pandas`. The exact runtime is stopped with `routeCount: 0` and no hosts.

The historical commit list and verification rows below describe earlier snapshots unless they are superseded by this dated record.

## Verdict

**Ready for merge review, but not for production rollout.** The published source and exact-head CI are verified, and the native Sol correction pass is complete. Production rollout still requires deployment sequencing, migration verification, accepted-invitation recovery, and telemetry. No legacy-client drain gate exists because the removed unbounded field never shipped in a deployed release.

This report is limited to the local branch `rs/pr-5394-backend-repair` at the current local repair commits:

- `d2ca218f2` — merge current `v3` and resolve the three documentation conflicts.
- `af4232519` — record the accepted-invitation and deferred-capacity rulings.
- `d4bf10693` — preserve invitation identity and leaderboard consent.
- `32bb24298` — close conditional-update races and duplicate CSV-row handling.
- `bbd972763` — centralize invitation import acceptance.
- `3595facef` — preserve non-empty import metadata when deduplicating rows.
- `83cbf380a` — serialize auto-acceptance and harden accepted-row repair.
- `5427a58cf` — share the serializable transaction and sole-eligible-participant helpers.
- `05d533c42` — close the stale duplicate result after a concurrent invitation deletion.
- `555392af7` — consolidate retry handling, test fakes, and importer metadata precedence.
- `8e557c17f` — avoid a serializable transaction for rows absent from the lightweight precheck.
- `114a6cd90` — merge the current `origin/v3` head `4e5f1d368ef579aac44027ea73f36b21754397f1`.
- `5ac9c5136` — bound assessment invitation imports and add stable paginated history for Manage.
- `75e4b60f1` — add the production-sized Playwright capacity regression.
- `517e0fc39` — refresh the execution-plan evidence and rolling-compatibility boundary.
- `71b85295e` — refresh the production-readiness evidence.
- `73c89d36f` — add the course-scoped invitation history index and migration.
- `f32495158` — make the paginated invitation fixture deterministic.
- `b4d92c8cc` — record indexed invitation verification and publish-readiness evidence.
- `1035a3a2f` — close the migration-safety, accessibility, and localization findings from the native Sol review.

The authoritative current `v3` readback is `f58986faa8cfa4ff78d20a1ebeb1666473343d38`; it is an ancestor of the reviewed source snapshot. The source branch was published before the exact-head CI rerun.

## Findings

| dimension | current result | disposition |
| --- | --- | --- |
| Deploy and rollback | The branch is based on current `v3`, the former three-way documentation conflicts are resolved, and the reviewed code and readiness evidence are published. No image, deployment, rollback, or production action was performed. | **Open:** establish backend-before-Manage rollout plus accepted-invitation recovery sequencing before release. |
| Failure modes and resilience | Unexpected database failures in `createParticipantInvitations` now rethrow instead of becoming successful row results. A lightweight invitation precheck is followed by a serializable recheck for observed rows, while pending creation owns the create-or-repair race and retries only the configured `P2002`/`P2034` cases. Conditional matriculation updates refetch the row after a lost compare-and-set and fall through to recreation when deletion wins. Auto-acceptance and accepted-row repair use the shared serializable transaction wrapper. The import script deduplicates once before both existing-row updates and shared-service processing, so stale prefetches cannot bypass race handling. | **Backend slice fixed locally;** the focused database suite passes 21/21. Cross-process import races still need an integration run and new-head CI. |
| Data safety and domain contract | Auto-accept requires exactly one distinct participant resolved from verified, eligible accounts whose participant is active. Multiple participants, missing accounts, and inactive participants remain pending. New participation uses the schema default (`isActive: false`); existing participation is upserted with `update: {}` and retains its value. Accepted invitation matriculation metadata is immutable; pending metadata may be updated conditionally. | **Former blockers fixed in code and tests.** A read-only remediation procedure for any historical mistaken auto-acceptance is still needed before rollout. |
| Observability | Expected validation outcomes remain structured invitation results, while unexpected infrastructure errors reach GraphQL error handling. The service and importer expose counts, but there is no server-side aggregate metric or PII-free audit event for invitation outcomes. | **Open:** add or explicitly accept operational telemetry and alerting for created, accepted, duplicate, failed, and repaired rows. |
| Config and secrets | The repair changes no dependencies, environment variables, deployment configuration, or secret-bearing files. Local staged-content review found no credentials or personal data. | **No finding in this slice;** rerun repository secret and generated-artifact checks after push. |
| UX, accessibility, and localization | CSV parse errors and import summaries now use live regions, the native file input is removed from sequential focus, count-bearing copy uses ICU plural forms, invitation timestamps use the active locale, and the pending delete target is 44px. | **Fixed in the correction slice;** retain browser verification for the release evidence. |
| Performance and capacity | The new Manage path rejects more than 200 rows server-side, rejects CSV files above 1 MiB or 200 data rows in the browser, and reads invitation history through a stable paginated field capped at 50 entries. The `courseId, invitedAt, id` composite index now covers the page filter and ordering in both Prisma schemas, with a concurrent production migration. The unused PR-local unbounded list field and its persisted hash were removed at head `a07def5b5` after the consumer audit. | **Partially fixed:** apply and verify the additive migration; the GraphQL surface itself is final. |
| Docs and operability | Domain and GraphQL-layer docs now describe pending-only metadata updates, exactly-one active identity resolution, preserved leaderboard consent, and surfaced unexpected errors. The two PR-added `docs/log` files are removed, and current `v3` deletions remain applied. | **Partially fixed:** document accepted-invitation recovery and complete/archive any stale implementation-plan artifacts after the final head is published. |

## Backend invitation evidence

- `packages/graphql/src/services/participantInvitations.ts` performs the exact-one identity query, preserves `Participation.isActive`, keeps accepted metadata immutable, retries serializable transaction conflicts, and treats only `P2002` as a recoverable duplicate race.
- `packages/graphql/src/scripts/importParticipantInvitations.ts` shares identity matching, preserves participation state, applies conditional pending-only updates, and removes duplicate email rows before creating accepted invitations.
- `packages/prisma/src/prisma/schema/participant.prisma` and the mirrored analytics schema index invitation history by `courseId`, `invitedAt`, and `id`; migration `20260821150000_participant_invitation_course_history` was applied and verified in the disposable PR database.
- `packages/graphql/test/participantInvitations.test.ts` contains 21 passing database-backed tests covering new inactive participation, preservation of both existing participation states, duplicate account rows, inactive and ambiguous participants, accepted metadata immutability, unexpected database errors, a lost conditional-update result, deletion-winning recreation, the 200-row import boundary, and paginated history with deterministic tie ordering.
- `git ls-files docs/log` is empty on the repair branch.

## Verification status

| check | result |
| --- | --- |
| `git diff --check` | passed for each committed slice |
| Biome on changed service, importer, and test | passed; formatter applied only to those files |
| `pnpm --filter @klicker-uzh/graphql check` | passed on the final head in the native Node 24 DevRouter runtime; repository commit hooks also passed the package check on host Node 26.7.0 with the Node 24 engine warning |
| GraphQL generation | passed in the final Node 24 DevRouter runtime; generated files remained unchanged across the repair sequence and the working tree stayed clean |
| Focused database-backed invitation tests | passed in the final Node 24 DevRouter runtime: 21 passed, with only expected Redis connection-refused warnings because the Redis services are not running |
| Simplification and slice review | Trusted fallback passes covered f8b48de71..dc506c396 and the correction range 3c0b11398b8ed40be962d78dd9823134b4c831b3; two low-risk simplifications were applied, with no material data-integrity or unnecessary-complexity findings remaining |
| Final Sol reviewer | native review covered `f58986faa8cfa4ff78d20a1ebeb1666473343d38..3c0b11398b8ed40be962d78dd9823134b4c831b3`; its four change-introduced findings were corrected in `1035a3a2f` |
| Full `check:all` | failed at `@klicker-uzh/analytics#lint`: uv could not build pandas 2.2.2 because the runtime image has no `cc`, `gcc`, or `clang`; dependent aggregate tasks were cancelled. No analytics files changed afterward, so this remains an environment blocker rather than a PR finding |
| Browser verification | manual Agent Browser verification passed in English and German, including finite 10/20/50 choices and page two. The focused Playwright test is committed, but the disposable runtime lacked Playwright's headless shell after the install attempt, so that spec remains a CI/runtime follow-up |
| Build and exact-head CI | the final build passed with 23 successful tasks and exit code 0, and the exact-head Playwright rerun passed all eight shards and its status gate |
| Simplification head `a07def5b5` | consumer audit found no caller of the unbounded list field; field, service function, operation document, and persisted hashes removed; codegen, graphql check, frontend-manage check, format check, and the database-backed invitation suite (21/21) pass; exact-head CI reruns green on GitHub |
| Final review at `a07def5b5` | native Sol xhigh final review of e2e885bdd..a07def5b5 passed with one evidence-drift finding; the plan-compliance correction is this snapshot update; simplifier xhigh reported no further behavior-preserving simplifications |
| Field rename at final head | query field renamed to `assessmentParticipantInvitations` to match the shipped `userActivities`/`courseAssessmentReportRecords` convention while keeping the `AssessmentParticipantInvitationPage` payload type; codegen, checks, and focused tests rerun green |

## Not checked

- The snapshot records source commit `3c0b11398b8ed40be962d78dd9823134b4c831b3` and correction commit `1035a3a2f`; no merge, deployment, production access, rollback, or worktree deletion has been performed. The additive invitation-history migration was applied only to the disposable PR database; production migration completion and query-plan verification remain unchecked.
- The exact DevRouter runtime for `/Users/rschlae/Git/klicker/klicker-uzh/trees/pr-5394` was used successfully for Node 24 checks, then stopped. `devpod status` reports `Stopped`; the exact-path workspace readback reports `routeCount: 0` and no hosts.
- No production workload, large-file stress test beyond the bounded 51-record browser fixture, cross-process import race, telemetry collector, or operator recovery system was inspected.
- No broad security scan was run; this audit stays within the requested production-readiness and bounded backend review scope.

## Handoffs

1. No legacy-field follow-up remains: the unused PR-local unbounded field was removed at `a07def5b5` because both fields were introduced by this unmerged PR and no deployed client can depend on them.
2. Complete the accepted-invitation recovery procedure and PII-free invitation outcome telemetry before production rollout.
3. Obtain the required code-owner approval before merge. Do not merge or deploy in this task.

## Final publication addendum (2026-08-23)

- The final functional backend head is `0237a3363`, and the exact published
  head is `2654bbf959b83391cddc7f3a20bc7b3eb57a062a`, based on current `v3`
  `de366d6f943b06f15354db8364cafefef94aa592`. GitHub reports `MERGEABLE` with
  no conflicts and `BLOCKED` only because the required code-owner approval is
  absent.
- Exact-head workflow `32606503311` completed successfully on the published
  head. The generated merge ref
  `584e62d2010e38def931f2027732f26b9485cd8e` has an identical tree, and 45
  required PR checks are green.
- The invitation import result no longer publishes unused `invitationId` or
  `participantId` fields. The operation, schema, persisted-query maps, and
  generated TypeScript artifacts were regenerated; the GraphQL typecheck and
  clean seeded 21-test invitation suite pass.
- `git ls-files docs/log` is empty. No merge, deployment, production access,
  or worktree deletion was performed. Required code-owner approval remains
  open.
