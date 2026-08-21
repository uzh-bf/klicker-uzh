# Production readiness — PR #5394 current-state audit

## Verdict

**Not ready for merge or production rollout.** The local repair branch now contains the current `v3` base, removes the PR documentation logs, and fixes the invitation data-integrity and failure-handling issues found in the earlier audit. The remote PR is unchanged and still reports `DIRTY` because no push was authorized. Capacity limits, frontend accessibility and localization findings, operational recovery, and new-head CI evidence remain open.

This report is limited to the local branch `rs/pr-5394-backend-repair` at the reviewed commits:

- `d2ca218f2` — merge current `v3` and resolve the three documentation conflicts.
- `af4232519` — record the accepted-invitation and deferred-capacity rulings.
- `d4bf10693` — preserve invitation identity and leaderboard consent.
- `32bb24298` — close conditional-update races and duplicate CSV-row handling.
- `bbd972763` — centralize invitation import acceptance.
- `3595facef` — preserve non-empty import metadata when deduplicating rows.
- `83cbf380a` — serialize auto-acceptance and harden accepted-row repair.
- `5427a58cf` — share the serializable transaction and sole-eligible-participant helpers.

The authoritative current `origin/v3` readback is `65b4ac4a983e6dc2fe01880c9409a87e30dbbc7`; it is an ancestor of the repair branch. The remote PR head remains `8515e3b07cae4d7824328e601d3f9d1970cb55b0`, with successful checks only for that older head.

## Findings

| dimension | current result | disposition |
| --- | --- | --- |
| Deploy and rollback | The local branch is based on current `v3`, and the former three-way documentation conflicts are resolved. No image, migration, deployment, rollback, or remote PR update was performed. | **Open:** push the reviewed branch, rerun CI, and establish backend-before-Manage rollout and accepted-invitation recovery sequencing before release. |
| Failure modes and resilience | Unexpected database failures in `createParticipantInvitations` now rethrow instead of becoming successful row results. Unique-email races refetch the winner and return a duplicate result. Matriculation updates use a conditional `updateMany` on invitation id, `PENDING` status, and the previously observed value, so a concurrent status or value change cannot mutate an accepted invitation. Auto-acceptance and accepted-row repair use one serializable transaction wrapper with bounded `P2034` retries. The import script shares the same conditional update and deduplicates new CSV emails before auto-accept processing. | **Backend slice fixed locally;** the focused database suite passes. Cross-process import races still need an integration run and new-head CI. |
| Data safety and domain contract | Auto-accept requires exactly one distinct participant resolved from verified, eligible accounts whose participant is active. Multiple participants, missing accounts, and inactive participants remain pending. New participation uses the schema default (`isActive: false`); existing participation is upserted with `update: {}` and retains its value. Accepted invitation matriculation metadata is immutable; pending metadata may be updated conditionally. | **Former blockers fixed in code and tests.** A read-only remediation procedure for any historical mistaken auto-acceptance is still needed before rollout. |
| Observability | Expected validation outcomes remain structured invitation results, while unexpected infrastructure errors reach GraphQL error handling. The service and importer expose counts, but there is no server-side aggregate metric or PII-free audit event for invitation outcomes. | **Open:** add or explicitly accept operational telemetry and alerting for created, accepted, duplicate, failed, and repaired rows. |
| Config and secrets | The repair changes no dependencies, environment variables, deployment configuration, or secret-bearing files. Local staged-content review found no credentials or personal data. | **No finding in this slice;** rerun repository secret and generated-artifact checks on the published head. |
| UX, accessibility, and localization | The PR's frontend findings remain outside this repair: dynamic CSV errors are not reliably announced, the hidden file input is keyboard-visible without a label, singular/plural copy is fixed, the delete target is below the touch-size guideline, and timestamps use a fixed format. Row errors can still expose backend text. | **Open:** address these in the frontend slice and verify English/German desktop and mobile flows with the browser skill. |
| Performance and capacity | Import remains a serial, unbounded mutation and invitation listing/refetch still loads the complete history. Browser CSV parsing has no documented byte or row budget. The plan records capacity as deferred because no product ruling was returned; this branch deliberately makes no public GraphQL contract change. | **Open and release-blocking:** authorize and implement bounded import plus stable pagination, or explicitly accept the measured operational risk as a separate task. |
| Docs and operability | Domain and GraphQL-layer docs now describe pending-only metadata updates, exactly-one active identity resolution, preserved leaderboard consent, and surfaced unexpected errors. The two PR-added `docs/log` files are removed, and current `v3` deletions remain applied. | **Partially fixed:** document accepted-invitation recovery and complete/archive any stale implementation-plan artifacts after the final head is published. |

## Backend invitation evidence

- `packages/graphql/src/services/participantInvitations.ts` performs the exact-one identity query, preserves `Participation.isActive`, keeps accepted metadata immutable, retries serializable transaction conflicts, and treats only `P2002` as a recoverable duplicate race.
- `packages/graphql/src/scripts/importParticipantInvitations.ts` shares identity matching, preserves participation state, applies conditional pending-only updates, and removes duplicate email rows before creating accepted invitations.
- `packages/graphql/test/participantInvitations.test.ts` contains 17 passing database-backed tests covering new inactive participation, preservation of both existing participation states, duplicate account rows, inactive and ambiguous participants, accepted metadata immutability, unexpected database errors, and a lost conditional-update result.
- `git ls-files docs/log` is empty on the repair branch.

## Verification status

| check | result |
| --- | --- |
| `git diff --check` | passed for each committed slice |
| Biome on changed service, importer, and test | passed; formatter applied only to those files |
| `pnpm --filter @klicker-uzh/graphql check` | passed on host Node 26.7.0, with the repository's Node 24 engine warning |
| GraphQL generation | passed in the native Node 24 DevRouter runtime; a second run produced no diff |
| Focused database-backed invitation tests | passed in the native Node 24 DevRouter runtime: 17 passed, with only expected Redis connection-refused warnings because the Redis services are not running |
| GraphQL package check | passed in the native Node 24 DevRouter runtime |
| Full `check:all` | failed only at `@klicker-uzh/analytics#lint`: uv could not build pandas 2.2.2 because the runtime image has no `cc`, `gcc`, or `clang`; dependent aggregate tasks were cancelled |
| Build, browser, and new-head CI | not run on this local repair head |
| Native simplifier and slice-reviewer | native Gemini route rejected the configured effort; trusted Luna fallback completed the requested read-only passes and the correction pass with no material concerns |
| Final Sol reviewer | pending after the final local verification commit |

## Not checked

- No push, PR update, merge, deployment, production access, migration, rollback, or worktree deletion was authorized or performed.
- The exact DevRouter runtime for `/Users/rschlae/Git/klicker/klicker-uzh/trees/pr-5394` was used successfully for Node 24 checks. Stop and verify that exact runtime before handoff.
- No production workload, large-file stress test, cross-process import race, telemetry collector, or operator recovery system was inspected.
- No broad security scan was run; this audit stays within the requested production-readiness and bounded backend review scope.

## Handoffs

1. Run the native Sol `final-reviewer` over the complete committed `origin/v3..HEAD` range, with special attention to the backend invitation service, importer, tests, generated contracts, auth boundary, consent invariant, and capacity deferral.
3. Resolve any material final-review finding, rerun the final reviewer once if needed, and update this report with the resulting evidence.
4. Stop and verify the exact DevRouter runtime, then keep the branch local until the user separately authorizes pushing or updating PR #5394.
