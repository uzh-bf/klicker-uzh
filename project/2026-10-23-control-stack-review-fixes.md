# Controller audience feedback and follow-up improvements

## Approval summary

Add the agreed compact Audience feedback strip below the controller session tabs, visible on Control, Q&A and Statistics. Show pace, difficulty and the existing ten-minute response window. Opening it reveals a responsive details sheet with the existing feedback enable switch. Match the current controller typography, colors, cards and sheet behavior. Treat zero recent responses as an empty state and describe the aggregate as responses, not unique participants.

Remove the control app's embedding-link functionality: list/session/legacy-menu entry points, modal, dedicated translations and browser expectations. Retain the existing projector display controls and embedding functionality in manage. Reuse existing GraphQL fields, feedback aggregation and settings mutation; add no dependency, schema migration or new data collection.

The user approved this executable batch and one new PR on Max's existing stack, including all our earlier review corrections. Keep the already verified corrections in their published lower layers and inherit them in the new top. Do not regress published intermediate trees merely to relocate a diff. Keep all original PR identities, order and commits. The new layer is `enhance/control-audience-feedback`, based on `feat/control-ios-shell`; create it as a draft. Authority covers implementation, synthetic local verification, ordinary commits/pushes, required internal reviews and PR descriptions. Force pushes, merging, marking ready, deployment and branch/worktree deletion remain separately gated.

Finish when the new layer inherits all our corrections and adds audience feedback and embedding removal, focused tests/browser checks and required reviews pass, the new draft PR is linked to stack 6540, and the exact existing local runtime remains available for the user's testing. Report current-head CI and screenshot-publication limitations separately. No new paid-provider budget or production access is needed.

## Execution details

### Evidence and product primitives

Starting top: `9ec603a8d150e405745487df74de91de4880d0e9`; target `v3-ai`; existing PR order 6536, 6537, 6538, 6509, 6539. Prior corrections and verification are recorded in the ignored review area. Earlier final review passed for the lifecycle, polling, statistics and manage null-result corrections. Those results remain reusable when exact source behavior is preserved.

| Product primitive | Disposition | Contract and consumers |
| --- | --- | --- |
| Confusion feedback | Reuse | Existing quiz-wide pace/difficulty submissions, ten-minute average, count of records and enable flag; participant PWA, manage cockpit, new controller summary |
| Quiz settings | Reuse | Existing EXECUTE permission and ChangeLiveQuizSettings mutation; preserve independent Q&A/confusion flags and other-controller updates |
| Live quiz lifecycle and response counts | Reuse corrected implementation | Retain the already reviewed atomic end/reward behavior, exact-true close handling, Q&A polling, content exclusions and manage rejection feedback |
| Embedding-link creation in control | Retire presentation | Remove controller links/copying; existing manage embedding and controller projection settings retain their current contracts |

No semantic aggregation change: signed pace/difficulty range remains -2 to 2. UI clamps drawing positions and handles null/non-finite/zero-response data neutrally. Existing aggregate count is labelled responses. No participation percentage or unsupported audience size is introduced.

### Ownership and sequence

Execution mode: standard because exact selected runtime model identity is unavailable. Main owns stack topology, backend seam, tests, runtime, integration and publication. One clean-context native executor owns the settled controller component/integration, embedding removal and EN/DE translations on the new branch. No child mutates Git or runtime. Planner hardens this frozen package; a simplifier and risk reviewer cover the new committed slice; integrated final review includes the complete new-PR delta while reusing unchanged prior correction evidence.

Delegation Map: new branch → main (accept corrected top ancestry and unchanged inherited source); backend/query/test seam → main (accept bounded recent aggregation and existing GraphQL data contract); controller feature/removal → executor (accept existing style, compact/full states and no controller embedding callers); maintained browser regressions and all integration/delivery → main (accept synthetic interactions, reviews and one linked draft PR).

1. Main verifies remote heads and source-matched runtime, saves the private overlay, and creates `enhance/control-audience-feedback` from corrected top 9ec603. Commit this updated plan first. Lower branches and descriptions retain their verified fixes. Route: main, critical-path integration. Acceptance: unchanged inherited tracked application tree and correct ancestry.
2. Main edits `packages/graphql/src/services/liveQuizzes.ts` and `packages/graphql/src/graphql/ops/QGetControlLiveQuizFeedbacks.graphql`: extend getControlLiveQuizFeedbacks to include confusion records strictly newer than ten minutes ago and older than now, return aggregateFeedbacks and preserve null for missing/unpublished/invisible quizzes. Keep EXECUTE permission wrappers and existing settings mutation. Extend `packages/graphql/test/liveQuizLifecycle.test.ts` using its owned disposable fixture for recent/expired/future/empty summary and query/settings access. Normal codegen regenerates ignored client documents and persisted-query outputs; tracked SDL changes only if the actual schema changes (none expected). Route: main, coupled backend/test seam. Acceptance: focused summary/access cases, existing permission contracts and codegen/type checks.
3. In parallel with step 2 after step 1, native executor owns `apps/frontend-control/src/components/session/AudienceFeedback.tsx` (named new component for compact summary/details), `apps/frontend-control/src/pages/session/[id].tsx`, `apps/frontend-control/src/components/liveQuizzes/LiveQuizList.tsx`, `apps/frontend-control/src/components/layout/MobileMenuBar.tsx`, deletion of `apps/frontend-control/src/components/liveQuizzes/EmbeddingModal.tsx`, affected obsolete quizId forwarding in `apps/frontend-control/src/components/Layout.tsx`, and `packages/i18n/messages/en.ts` plus `packages/i18n/messages/de.ts`. Use ResponsiveSheet/Switch/tokens and existing failure toast. Integrate below SessionTabs using the existing three-second feedback poll; explicitly pass initial loading and query error alongside retained data. Keep disabled polling. Require non-null mutation success, refetch, and preserve the independent Q&A flag. Remove only control embedding creation/copy entry points and dedicated unused translations; retain LeinwandCard. No Git/runtime writes by child. Acceptance: type-correct compact/off/empty/loading/error and retained-stale states, accessible labelled native controls, EN/DE; main verifies real browser proof.
4. Main edits `playwright/tests/C-control.spec.ts` to remove obsolete embedding interactions and add audience summary/details, settings success/failure, cross-controller refresh, loading/error/stale data, and query absence coverage. Preserve existing lifecycle/polling/statistics checks and projector interactions. Use the existing synthetic route harness and owned fixtures; no runtime reset. Route: main. Acceptance: host browser suite and desktop/phone EN/DE captures.
5. Main integrates accepted executor output, runs relevant repo checks, commits the new end-to-end feature/removal slice, and starts simplifier/risk reviewer together. After corrections and integrated final review, ordinarily push only the new branch, create one draft PR and link it as sixth layer with native gh-stack. Describe the new delta and inherited reviewed fixes separately. Route: main. Acceptance: exact remote head/base/stack read-back, truthful verification/screenshots and retained runtime.

Stop dependent work if the extended query changes permission contracts, inherited source equivalence cannot be established, or browser proof is unavailable. Finish independent work and report the concrete gap. No separately gated external actions are needed for this package.

### Verification portfolio

| Risk or outcome | Test obligation | Primary seam and acceptance |
| --- | --- | --- |
| Existing fixes regressed | none for unchanged lifecycle; extend existing controller suite | Inherit reviewed 9ec source; reuse six PostgreSQL lifecycle cases and independent reviews under unchanged source/toolchain/environment; run controller suite because page integration changes |
| Old/future feedback treated as current, empty data looks balanced | extend existing | Query service with owned disposable fixtures proves existing ten-minute semantics; browser shows neutral empty state and a finite mapped signal |
| Settings mutate the wrong flag or falsely report success | Extend existing | Browser toggles confusion flag with Q&A independent, mutation failure retains state, second loaded controller sees remote changes without reload |
| Feature disappears while changing tabs or during blocks | extend existing | Browser sees the same strip on Control/Q&A/Statistics; primary quiz action and projector interaction remain usable |
| Controller embedding functionality survives | extend existing | Browser verifies no embedding controls and no embedding-query requests while course/session navigation and projector settings remain usable |

Keep maintained assertions on observable behavior and machine values, not prose or translation snapshots. Use focused browser route fixtures and owned synthetic records. Reuse prior data-integrity review unchanged; final review checks the reassembled package, public field additions and settings seam. Build/codegen/type/format/lint/syncpack and repository hooks remain required. No new broad security assessment.

| Missing quiz or access leaks | extend existing | Query returns null for missing/unpublished quizzes; EXECUTE can read/toggle while READ cannot through unchanged schema authorization wrappers |
| Initial loading or refresh failures look like a valid neutral signal | extend existing | Browser distinguishes initial loading and initial error, retains stale prior data with refresh warning, and shows disabled/empty states without balanced labels |

### Runtime and publication

Reuse the exact `trees/review-control-stack-6539` runtime and its seeded local database. The fifteen package-manifest --forceExit edits remain a private uncommitted build workaround, excluded from delivery. Host owns Git/gh and Playwright; container owns application checks. Use preserve-database mode and delete only explicitly owned temporary fixtures.

The user keeps the runtime running for manual testing; retain the pin until testing ends or the user requests stop. Capture and record source equivalence when branch changes carry the same application tree. GitHub previously returned native attachment URLs that did not load independently; keep publication/rendering status separate and do not blindly retry uncertain uploads. CI previously contained cancelled summaries and queued replacements; fresh per-head evidence is required for any green-CI claim.

## Progress

- User-approved behavior delivered in [draft PR #6686](https://github.com/uzh-bf/klicker-uzh/pull/6686), sixth layer of native stack 6540. The five existing stack heads and their reviewed fixes remain unchanged.
- Planner approved the bounded package after dropping proposed inverse commits. The audience strip/details, existing settings mutation, English/German text and controller embedding removal are implemented. Projector controls remain available.
- Eight PostgreSQL tests passed together: two new aggregation/access cases plus six inherited lifecycle regressions. All five host Chromium controller workflows passed after the final accessibility correction, including failure/stale/empty/off states, remote changes, independent flag mutation, response-count accessible name and projection interaction. Required type/format/lint/syncpack/contract hooks passed. Full build passed 27/27 tasks on the final accessibility-corrected source before its ordinary push.
- Simplifier reductions accepted: remove redundant mutation-loading status and obsolete embedding quizId forwarding. Slice risk review found no actionable defect. Integrated final review found one compact-summary accessible-name omission; the focused correction passed the same independent review with no remaining findings. Current-platform native review substituted after automatic approval review blocked external CLI egress; no external retry was made.
- Seven real synthetic screenshots cover empty/populated phone states, desktop, English/German details and disabled collection. All seven native images load in the public PR description. Temporary response fixtures were removed by recorded IDs and the quiz setting restored. Native iOS remains untested; hosted CI is pending.
- Exact retained runtime is the original review-control-stack-6539 checkout, kept available under the user's manual-testing request. The fifteen private Rollup package-manifest edits remain uncommitted and excluded from delivery. No merge, ready, force-push, deployment or deletion is authorized.
- Final product head was ordinarily pushed and read back. Source-matched retained runtime remains available for manual testing; hosted CI status is reported separately. This final progress-only commit reuses unchanged application verification and reviews.
