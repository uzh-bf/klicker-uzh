# Production readiness — PR #5394 current-state audit

## Verdict

**Not ready for merge or production rollout.** The local repair branch now contains the current `v3` base, removes the PR documentation logs, and fixes the invitation data-integrity, failure-handling, and new Manage capacity issues found in the earlier audit. The final Sol review found no remaining backend invitation defect in the reviewed implementation; a fresh final Sol pass is still required over the complete current range. The remote PR still points to its older head because publication has not yet happened. Legacy rolling compatibility, frontend accessibility and localization findings, operational recovery, and new-head CI evidence remain open.

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

The authoritative current `origin/v3` readback is `4e5f1d368ef579aac44027ea73f36b21754397f1`; it is an ancestor of the repair branch. The remote PR head remains `7d05424e66992326ff8bfd94ef5ef139c070241c`, with successful checks only for that older head.

## Findings

| dimension | current result | disposition |
| --- | --- | --- |
| Deploy and rollback | The local branch is based on current `v3`, and the former three-way documentation conflicts are resolved. No image, migration, deployment, rollback, or remote PR update was performed. | **Open:** push the reviewed branch, rerun CI, and establish backend-before-Manage rollout and accepted-invitation recovery sequencing before release. |
| Failure modes and resilience | Unexpected database failures in `createParticipantInvitations` now rethrow instead of becoming successful row results. A lightweight invitation precheck is followed by a serializable recheck for observed rows, while pending creation owns the create-or-repair race and retries only the configured `P2002`/`P2034` cases. Conditional matriculation updates refetch the row after a lost compare-and-set and fall through to recreation when deletion wins. Auto-acceptance and accepted-row repair use the shared serializable transaction wrapper. The import script deduplicates once before both existing-row updates and shared-service processing, so stale prefetches cannot bypass race handling. | **Backend slice fixed locally;** the focused database suite passes 20/20. Cross-process import races still need an integration run and new-head CI. |
| Data safety and domain contract | Auto-accept requires exactly one distinct participant resolved from verified, eligible accounts whose participant is active. Multiple participants, missing accounts, and inactive participants remain pending. New participation uses the schema default (`isActive: false`); existing participation is upserted with `update: {}` and retains its value. Accepted invitation matriculation metadata is immutable; pending metadata may be updated conditionally. | **Former blockers fixed in code and tests.** A read-only remediation procedure for any historical mistaken auto-acceptance is still needed before rollout. |
| Observability | Expected validation outcomes remain structured invitation results, while unexpected infrastructure errors reach GraphQL error handling. The service and importer expose counts, but there is no server-side aggregate metric or PII-free audit event for invitation outcomes. | **Open:** add or explicitly accept operational telemetry and alerting for created, accepted, duplicate, failed, and repaired rows. |
| Config and secrets | The repair changes no dependencies, environment variables, deployment configuration, or secret-bearing files. Local staged-content review found no credentials or personal data. | **No finding in this slice;** rerun repository secret and generated-artifact checks on the published head. |
| UX, accessibility, and localization | The PR's frontend findings remain outside this repair: dynamic CSV errors are not reliably announced, the hidden file input is keyboard-visible without a label, singular/plural copy is fixed, the delete target is below the touch-size guideline, and timestamps use a fixed format. Row errors can still expose backend text. | **Open:** address these in the frontend slice and verify English/German desktop and mobile flows with the browser skill. |
| Performance and capacity | The new Manage path rejects more than 200 rows server-side, rejects CSV files above 1 MiB or 200 data rows in the browser, and reads invitation history through a stable paginated field capped at 50 entries. The old unbounded field and persisted operation remain for rolling clients. | **Partially fixed:** publish the additive path, prove the new head in CI, and retire the legacy field only after deployment evidence shows that old clients have drained. |
| Docs and operability | Domain and GraphQL-layer docs now describe pending-only metadata updates, exactly-one active identity resolution, preserved leaderboard consent, and surfaced unexpected errors. The two PR-added `docs/log` files are removed, and current `v3` deletions remain applied. | **Partially fixed:** document accepted-invitation recovery and complete/archive any stale implementation-plan artifacts after the final head is published. |

## Backend invitation evidence

- `packages/graphql/src/services/participantInvitations.ts` performs the exact-one identity query, preserves `Participation.isActive`, keeps accepted metadata immutable, retries serializable transaction conflicts, and treats only `P2002` as a recoverable duplicate race.
- `packages/graphql/src/scripts/importParticipantInvitations.ts` shares identity matching, preserves participation state, applies conditional pending-only updates, and removes duplicate email rows before creating accepted invitations.
- `packages/graphql/test/participantInvitations.test.ts` contains 20 passing database-backed tests covering new inactive participation, preservation of both existing participation states, duplicate account rows, inactive and ambiguous participants, accepted metadata immutability, unexpected database errors, a lost conditional-update result, deletion-winning recreation, the 200-row import boundary, and paginated history.
- `git ls-files docs/log` is empty on the repair branch.

## Verification status

| check | result |
| --- | --- |
| `git diff --check` | passed for each committed slice |
| Biome on changed service, importer, and test | passed; formatter applied only to those files |
| `pnpm --filter @klicker-uzh/graphql check` | passed on the final head in the native Node 24 DevRouter runtime; repository commit hooks also passed the package check on host Node 26.7.0 with the Node 24 engine warning |
| GraphQL generation | passed in the final Node 24 DevRouter runtime; generated files remained unchanged across the repair sequence and the working tree stayed clean |
| Focused database-backed invitation tests | passed in the final Node 24 DevRouter runtime: 20 passed, with only expected Redis connection-refused warnings because the Redis services are not running |
| Simplification and slice review | trusted Luna fallback completed the final simplification and data-integrity slice reviews after the native Gemini route rejected its configured effort; no material concern remains |
| Final Sol reviewer | the prior pass reviewed `origin/v3..8e557c17f` and found no backend invitation defect; a fresh pass over the complete current range is pending |
| Full `check:all` | failed at `@klicker-uzh/analytics#lint`: uv could not build pandas 2.2.2 because the runtime image has no `cc`, `gcc`, or `clang`; dependent aggregate tasks were cancelled. No analytics files changed afterward, so this remains an environment blocker rather than a PR finding |
| Browser verification | manual Agent Browser verification passed in English and German, including finite 10/20/50 choices and page two. The focused Playwright test is committed, but the disposable runtime lacked Playwright's headless shell after the install attempt, so that spec remains a CI/runtime follow-up |
| Build and new-head CI | not run on this current local repair head |
| Native simplifier and slice-reviewer | native Gemini route rejected the configured effort; trusted Luna fallback completed the final read-only passes and found no material simplification or data-integrity concern |

## Not checked

- No push, PR update, merge, deployment, production access, migration, rollback, or worktree deletion has been performed. Push to the PR source branch is now authorized after the final review and verification.
- The exact DevRouter runtime for `/Users/rschlae/Git/klicker/klicker-uzh/trees/pr-5394` was used successfully for Node 24 checks, then stopped. `devpod status` reports `Stopped`; the exact-path route query returns `[]`; the workspace remains owned with `routeCount: 0`.
- No production workload, large-file stress test beyond the bounded 51-record browser fixture, cross-process import race, telemetry collector, or operator recovery system was inspected.
- No broad security scan was run; this audit stays within the requested production-readiness and bounded backend review scope.

## Handoffs

1. Keep the legacy unbounded field during the rolling window; remove it only in a separate follow-up after deployment evidence shows that old clients have drained.
2. Address the frontend accessibility/localization findings, operational recovery procedure, and PII-free invitation outcome telemetry in their respective slices.
3. Run the fresh final Sol review, push the reviewed branch, and rerun CI on the new head. Do not merge or deploy in this task.
