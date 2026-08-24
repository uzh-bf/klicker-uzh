# Production readiness — PR #5496

## Verdict

**ready-with-conditions**. I found no confirmed blocker in the implementation: the client restricts deletion to draft/scheduled activities, the server-side mutations hard-delete only those eligible states, assessment activities retain the admin check, and archive/restore is transactional and reversible. Merge remains conditional on confirming production backup/restore coverage for an irreversible multi-activity deletion and completing the missing standing review gates. The repaired namespaced workspace now passes delegated login and browser verification for batch deletion and element archive/restore; the prior auth 404 was a workspace/runtime defect, not a current PR-flow blocker.

## Prior gates

| gate | artifact | status (present / stale / missing / not applicable) |
| --- | --- | --- |
| `$code-review` | none matching PR head `5154177aa19425bcd193fd18f828c393e24bc78f` | missing |
| `$thermo-nuclear-code-quality-review` | none matching PR head | missing |
| `$security-review` | none matching PR head | missing |
| combined-final | none matching PR head | missing |

The PR reports green `check:all`, build, focused Playwright checks, CodeQL, SonarCloud, and GitGuardian checks, but those results are not standing-gate artifacts in `project/_local/reviews/`.

## Findings

| severity | dimension | finding | evidence | proposed action | verification (confirmed / refuted / unverified) |
| --- | --- | --- | --- | --- | --- |
| major | Data safety / Docs & operability | Batch deletion permanently hard-deletes multiple activities and has no application-level undo; production recovery therefore depends entirely on database backup/restore operations. | `packages/graphql/src/services/practiceQuizzes.ts:645` calls `ctx.prisma.practiceQuiz.delete`; `microLearning.ts:757` and `groups.ts:1883` do the same; `liveQuizzes.ts:2347` is reached through `hardDeleteLiveQuiz` for draft/scheduled quizzes. `useActivityBatchDeletion.ts:11` sets `DELETE_CONCURRENCY = 5`, and `ActivityBatchOperationsModal.tsx:269-285` executes independent mutations and refetches. | Before release, verify the production backup retention, point-in-time restore, and operator runbook for accidental batch deletion. State the recovery procedure and expected restore scope in the Manage/on-call documentation. | unverified |
| minor | Failure modes & resilience | A thrown mutation is reported as `uncertain`, but the UI cannot distinguish a timeout after server commit from a timeout before commit; retrying can produce confusing already-deleted failures. | `useActivityBatchDeletion.ts:70-79` maps every thrown error to `status: 'uncertain'`; `ActivityBatchOperationsModal.tsx:290-297` shows one generic uncertain toast after refetch. | Keep the current safe classification, but ensure the runbook tells operators to refresh/reconcile before retrying and treats the activity list as authoritative. | confirmed |
| minor | Performance & capacity | Deletion has no visible progress indicator for a large selection; work proceeds in sequential chunks of five, so a large batch can leave the destructive modal busy without a completion estimate. | `useActivityBatchDeletion.ts:62-76` loops over chunks sequentially and exposes no progress callback; `ActivityBatchOperationsModal.tsx:269-321` only toggles `deleting`. The selected list is a normal mapped table in `SelectedActivitiesList.tsx:42-60`. | Add progress feedback or document a practical selection limit if large draft collections are expected. | confirmed |
| minor | Observability | New outcome states are exposed as client toasts and console errors, but this audit found no new durable metric or operator-visible event distinguishing full, partial, uncertain, and failed batch deletion outcomes. | `ActivityBatchOperationsModal.tsx:290-321` uses `toast`; `useActivityBatchDeletion.ts:73` uses `console.error`. No schema, migration, or dedicated telemetry path is included in the 13-file PR diff. | Decide whether existing mutation/audit telemetry is sufficient; otherwise add aggregate monitoring for deletion failures and uncertain outcomes before relying on this at scale. | unverified |
| minor | UX | The initial isolated-workspace auth defect temporarily blocked UX verification; no current runtime UX blocker remains. | Initial auth returned an HTML 404. After recreating the workspace with the Devrouter overlay, Manage returned 200, `/api/auth/providers` returned JSON, delegated login succeeded, batch deletion removed two disposable draft activities with refetched counts 34 → 33 → 32, and element archive → Show archived → Restore returned the element to `Ready`. | Keep the namespaced browser pass in release evidence; no PR code change is required for this environment-only defect. | refuted |

## Not checked

- Browser verification covered the English desktop flows and a narrow 390x844 Library state. The transient success toast was not retained in the later snapshot, although the refetched activity list visibly removed the selected activities; partial/uncertain mutation failure and the error-state toast were not induced.
- German rendering was not exercised in-browser; en/de translation-key parity was confirmed statically at the PR head.
- A real production backup restore or point-in-time recovery was not performed; no production access was used. The report therefore does not claim that an accidentally deleted batch can be recovered operationally.
- Partial/uncertain mutation failure was not induced against the shared seeded environment because doing so would require mutation or network fault injection. Static control-flow review was completed instead.
- No production load test was run. Capacity assessment is based on the bounded concurrency and service code paths, not representative production activity sizes.
- Standing-gate artifacts for `$code-review`, `$thermo-nuclear-code-quality-review`, `$security-review`, and `combined-final` are absent for this head.

## Handoffs

- Code style and specification compliance observations belong to `$code-review`; this audit did not re-review those lenses.
- Maintainability and architecture proportionality observations belong to `$thermo-nuclear-code-quality-review`; the sequential chunking/progress concern is recorded here only as an operational capacity observation.
- Code-level vulnerability observations belong to `$security-review`; CodeQL and GitGuardian were green, but this readiness audit is not a substitute for that gate.
- Integrated final correctness and plan-compliance review belongs to `combined-final` / the applicable final-reviewer gate.

## Coverage

I inspected the PR diff at immutable head `5154177aa19425bcd193fd18f828c393e24bc78f`, the four existing server deletion services, the element batch-operation service, the relevant Manage components, i18n parity, compose/devrouter configuration, and the PR's automated verification claims. I also recreated the linked Devrouter workspace with the correct overlay, verified healthy Postgres/app containers and all 10 namespaced routes, completed delegated browser login, verified batch deletion and element archive/restore, and captured local ignored screenshots under `project/_local/reviews/`. The configured eight-worker wave could not complete because child tool permissions were denied; I completed the eight dimension reviews inline and record that fallback explicitly rather than presenting unavailable worker verdicts as completed.
