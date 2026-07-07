# PR 5132 Production-Readiness Review — tRPC Dual-API Migration

- **Date:** 2026-07-07
- **PR:** [#5132 feat(trpc): migrate dual api workflows](https://github.com/uzh-bf/klicker-uzh/pull/5132) (`codex/trpc-dual-api-migration` → `v3`)
- **Reviewed head:** `d1daf0b8165223293741cd793c43ba6bb3a40b65`
- **Method:** current-head CI evidence ledger + multi-agent code review (UX/cache audit of `frontend-manage` with adversarial verification of every blocker/major finding, Cypress failure triage, branch-hygiene analysis) + targeted manual checks. Five audit dimensions could not be completed in this pass and are listed under [Pending audits](#7-pending-audits-not-yet-reviewed) with ready-to-run instructions.

## 1. Verdict

The migration itself is in good shape: the dual-API architecture is sound, deployability is real (backend image ships `packages/api/dist`, `/api/trpc` is mounted beside `/api/graphql`, superjson is configured on every client link branch including WebSockets), test lanes are cleanly separated, and the ~20 "surface refresh failures" UX commits establish a correct, repeatable pattern. The PR body is honest about its own state.

**The PR is not merge-ready.** Four things stand between here and merge, in order of impact:

1. A single component regression (`ConfirmationItem.tsx`) breaks ~44 of the 47 failing Cypress tests.
2. The branch is contaminated with unrelated `v3-ai` content (`apps/mcp-student` + its CI/deploy files never merged to `v3`) and conflicts with `v3` in 2 files.
3. Three verified UX gaps in flows the refresh-failure fix pass missed (sharing revocation, unpublish actions, refresh-failure copy).
4. Two CI-gate chores (SonarCloud security-hotspot review at 0%, GitGuardian incidents pinned to old commits).

After that, production readiness needs the five pending audits plus a browser-verification pass over the ~30 UX fixes that the plan itself marks "Completed Locally With Runtime Blockers" (i.e. never seen in a browser).

## 2. Evidence ledger (current head `d1daf0b8`)

| Check | State | Evidence |
| --- | --- | --- |
| `packages/graphql Vitest` | pass | GH check on head |
| `packages/api tRPC Vitest` | pass | GH check on head |
| check / lint / format / builds (amd+arm ×9) | pass | GH checks on head |
| Playwright (5 shards) | pass | GH checks on head |
| Cypress Cloud run 6983 | **fail: 47 failed / 714 passed / 3 flaky** | [run](https://cloud.cypress.io/projects/y436dx/runs/6983), tied to head `d1daf0b8` via check-run |
| SonarCloud PR gate | **fail: security hotspots 0% reviewed** (duplication now passes: 2.5% < 3%) | `api/qualitygates/project_status?pullRequest=5132` |
| GitGuardian | skipping/red in dashboard | incidents point at superseded branch commits |
| Mergeable vs `v3` | **CONFLICTING** | `git merge-tree --write-tree origin/v3 HEAD`: `apps/chat/src/app/noLogin/page.tsx`, `package.json` |
| Human review | none yet | only bot comments, all resolved |

Cypress failures by spec: `V-template-workflow` 28/33, `O-live-quiz` 7, `U-catalog` 6, `Q-practice-quiz` 3, `P-microlearning` 2, `N-course` 1.

## 3. Blockers

### B1 — `ConfirmationItem` drops `data-cy` after confirmation → ~44 Cypress failures

**File:** `apps/frontend-manage/src/components/common/ConfirmationItem.tsx:32-48`
**Introduced by:** branch-only commits `d93fa403d` ("hide inactive confirmation selectors"), `fe62869b5` ("expose confirmation active state") — made during Playwright stabilization, never run against Cypress locally.

Evidence (verified in code + CI log):

```tsx
const keepConfirmedData =
  confirmed && notApplicable && confirmationType === 'delete'
...
data-cy={keepConfirmedData ? data?.cy : undefined}
```

Once an item is confirmed, the inner `<Button data={data}>` unmounts (line 81-102 renders a bare checkmark icon) and the wrapper only keeps `data-cy` in the narrow `delete && notApplicable` case. The spec then fails deterministically, e.g. `V-template-workflow.cy.ts:542-546`:

```ts
cy.get('[data-cy="confirm-content-visibility"]').click()        // works (not yet confirmed)
cy.get('[data-cy="confirm-content-visibility"]').should(        // times out — data-cy is gone
  'have.attr', 'data-confirmation-active', 'false')
```

This one component is used by `TemplateConversionModal`, `LiveQuizDeletionModal`, `MicroLearningEndingModal`, `CourseDeletionConfirmations`, `ActivityRemovalModal`, and more — which maps exactly onto the failing specs (V-template cascade from test 1, U-catalog, O-live-quiz, P-microlearning, Q-practice-quiz).

**Fix (junior-executable):**

1. Change the gate so the selector survives confirmation but still hides when the item is inactive/disabled (that was the intent of `d93fa403d` for Playwright):
   ```tsx
   const exposeData = !disabled
   ...
   data-cy={exposeData ? data?.cy : undefined}
   data-test={exposeData ? data?.test : undefined}
   ```
   Then remove `data={data}` from the inner `Button` (avoid duplicate selectors matching two elements — check specs that click the button vs the row).
2. Check `V-template-workflow.cy.ts:530-556` and the Playwright confirmation specs for the exact expected states: `should('not.exist')` must still hold for disabled/hidden items; `data-confirmation-active` assertions must hold before and after clicking.
3. Verify locally — both frameworks, this is the trap the regression came from:
   ```bash
   KLICKER_NONINTERACTIVE=1 KLICKER_DEPENDENCIES_DETACH=1 ./_run_app_dependencies.sh playwright
   volta run pnpm run dev:playwright:raw
   # Playwright confirmation-modal specs:
   volta run pnpm --filter @klicker-uzh/playwright test:run:raw -- --project=chromium tests/V-template-workflow.spec.ts
   # Cypress (against the cypress dev stack): run V-template-workflow.cy.ts headed or via CI
   ```
   If local Cypress is not feasible, push and watch the Cypress Cloud run for the new head — `V-template` should go from 28 failures to ~0.

### B2 — Branch contamination from `v3-ai` merge + conflicts with `v3`

Evidence:

- Merge commit `c7cfcc330 merge(v3-ai): sync latest base` pulled in `1b83e36de`, which is **not an ancestor of `origin/v3`**. Net effect in the PR diff vs `v3`: `apps/mcp-student` (16 files, from unmerged [PR #5090](https://github.com/uzh-bf/klicker-uzh/pull/5090)) plus its GitHub Actions deploy workflows, Helm charts, `project/STUDENT_MCP_CONCEPT.md`, screenshots — and the head commit of this tRPC PR is literally `fix(mcp-student): align docker build with node 24`.
- `apps/chat` (30 files) mostly matches what already landed in `v3` via #5136/#5137, but the not-yet-merged remainder causes the conflict in `apps/chat/src/app/noLogin/page.tsx`.
- The v3 merges themselves (`29b00f9d4`, `5b5f83540`) are clean — their parents are in `v3`.

**Why it matters:** a reviewer of "the tRPC migration" is also silently approving an unrelated student-MCP app, its deploy pipeline, and chart changes. Revert/bisect before squash is impractical, and CI triage keeps mixing signals (see B1 head commit).

**Fix (decision needed from Roland, then junior-executable):**

- **Preferred:** land the ride-along content in `v3` first (merge PR #5090, finish the chat PRs), then in this branch `git merge origin/v3` — the contamination disappears from the diff and only the 2 known conflicts need resolving (`package.json` is a routine dependency-block merge; `noLogin/page.tsx` take the `v3` side unless the branch intentionally changed it — it did not, it's ride-along).
- **Fallback:** if #5090 will not land soon, explicitly document the ride-along in the PR body ("this PR also carries mcp-student from v3-ai, reviewed separately") and get maintainer sign-off. Do **not** try to revert the `v3-ai` merge on this branch (`git revert -m1` would poison the next real `v3-ai` sync).
- Either way, merge the latest `origin/v3` and resolve the 2 conflicts so the PR leaves the CONFLICTING state:
  ```bash
  git fetch origin v3 && git merge origin/v3
  # resolve apps/chat/src/app/noLogin/page.tsx (prefer v3 side) and package.json, then:
  pnpm install && git add -A && git commit
  ```

### B3 — Sharing/permission revocation reports success when the required list refresh fails

**File:** `apps/frontend-manage/src/components/sharing/usePermissionRevocation.ts:93-110` (verified: confirmed by adversarial re-read)

`refetchElements?.().catch(console.error)` / `refetchActivities?.().catch(console.error)` (lines 93, 101) swallow failures before the outer try/catch can see them, so `onPermissionRevocation` returns `true` unconditionally once the server revocation succeeded — and `ObjectSharingModal.tsx:166-186` then shows the `accessRemovalSuccessful` toast while the visible permission list may still show the revoked entry. False success feedback after a security-relevant operation (this is the exact bug class the branch's own "surface refresh failures" commits fixed elsewhere; this surface was missed).

**Fix:** remove the two inner `.catch(console.error)` so failures propagate; wrap the `Promise.all([invalidateAnswerCollectionList(), refreshOwnPermissionLists()])` (line 105) in try/catch and return `false` (or a distinct refresh-failed signal) on failure so the modal shows the error path instead of the success toast. Verify: `pnpm --filter @klicker-uzh/frontend-manage check`, then manually revoke own access with devtools blocking `/api/trpc` after the mutation response.

## 4. Majors (fix before merge)

All verified against the code by an independent second pass.

1. **Unpublish swallows required refresh in all four activity types.** `useLiveQuizActions.ts:257`, `useGroupActivityActions.ts:90-97`, `usePracticeQuizActions.ts:171-178`, `useMicroLearningActions.ts:206-214` — the post-unpublish `Promise.all([...invalidate/refetch]).catch(console.error)` hides failures; the `PublicationStatus` badge in `ActivityListEntry.tsx` silently stays "Published". Fix: replace `.catch(console.error)` with try/catch + error toast, mirroring `FinalizeGradingModal.tsx`/`ActivityReviewButton` (commit `51106086b`).
2. **Refresh-failure copy is indistinguishable from mutation-failure copy.** Every "fixed" flow reuses `shared.generic.systemError` for refresh failures; `FinalizeGradingModal.tsx:57-62` shows no toast at all on refresh failure. Users can't tell "not saved, retry" from "saved, but reload the page" — different recovery actions. Fix: add one i18n key (e.g. `shared.generic.refreshFailedAfterSave`, EN + DE in `packages/i18n/messages/`) and use it in the refresh-failure catch blocks across the ~20 fixed flows; add the missing toast in `FinalizeGradingModal`.
3. **`FinalizeGradingModal` toasts success and closes before its background invalidate settles.** Lines 55-68: `void utils.activity.groupActivityGrading.invalidate(...).catch(...)` is fire-and-forget before toast + `onClose()`. The `setData` patch keeps the immediate UI correct, so either await the invalidate before closing (match `GroupActivityGradingStack.tsx:239-254`, same query key) or add a comment declaring the invalidate intentionally best-effort.
4. **SonarCloud gate: review the security hotspots.** Gate fails only on `new_security_hotspots_reviewed = 0%` (needs 100%). Junior with SonarCloud rights: open the [PR 5132 dashboard](https://sonarcloud.io/dashboard?id=uzh-bf_klicker-uzh&pullRequest=5132) → Security Hotspots tab → review each (expect mostly the `crypto.randomInt` / hashing changes the PR body describes) → mark "Safe" with a one-line justification or fix. No code change usually required.
5. **GitGuardian incidents.** Findings point at earlier branch commits whose password-like test fixtures were already replaced; the repo squash-merges, so the flagged blobs never reach `v3` history. Resolve in the GitGuardian dashboard as test-credential/removed (needs dashboard access — Roland or an admin). Do not rewrite 500+ commits of branch history for this.

## 5. Minors / follow-ups

- `CancelLiveQuizModal.tsx:109-115` — invalidate failures swallowed before navigation; `setCancelPending(false)` never runs on the success path (button can stick if navigation stalls). Wrap in try/catch + `finally`.
- `N-course-workflow` Cypress failure ("Found multiple elements with the text: Course to be deleted") looks like test-data leakage from a retry, not a migration regression — re-check after B1 lands; if it persists, fix the spec's cleanup/setup, not app code.
- 3 flaky tests flagged on run 6983 — triage after B1, most likely the same selector class.

## 6. What is good (keep it this way)

- **Dual-API discipline holds:** `/api/trpc` mounted beside `/api/graphql` (`apps/backend-docker/src/app.ts:222`), Apollo intentionally retained in manage/pwa, GraphQL tests still exercise GraphQL (`packages/graphql Vitest` separate from `packages/api tRPC Vitest`, both green).
- **Deployability is real, not claimed:** backend `Dockerfile:53` copies `packages/api/dist` into the runtime image; staging builds trigger on `packages/api/**`.
- **Client link setup is correct:** `splitLink` with `wsLink` for subscriptions and `superjson` configured on every terminating branch (`apps/frontend-pwa/src/lib/trpc.tsx:194-226`), mutations unbatched by design.
- **The refresh-failure UX pattern, where applied, is right** (verified): `ElementBatchOperationsModal`, `GroupActivityGradingStack`, `AssignmentConfirmationModal`, course creation — await required invalidations, gate toast/close on them, distinct error handling. `ChatbotDetails.tsx` even has properly distinct copy. Enabled-guards and invalidate-key/query-key matching sampled clean.
- **Usefulness:** the migration pays for itself — `frontend-control` runs fully without Apollo/codegen, end-to-end type inference replaces a generated-types pipeline, and React Query invalidation is simpler than the Apollo cache choreography it replaces. The dual-API + reversible-cutover approach is the right risk posture for a product in active teaching use.

## 7. Pending audits (not yet reviewed)

This review pass could not complete five dimensions (agent budget exhausted mid-run). Treat them as **open review debt — none of them is implicitly "fine"**. Each block below is a self-contained instruction; run them one at a time (with an agent or manually) and append results to this file.

1. **`packages/api` server quality.** Sample 10 security-sensitive procedures (grading, course management, account, sharing) and compare auth middleware + role checks against their `packages/graphql` twins — any lost check is a blocker. Check every input has a Zod schema (`rg -n "z.any\(\)|passthrough\(" packages/api/src`), procedures return DTOs not broad Prisma entities (`rg -n "return .*prisma\." packages/api/src/trpc`), and errors map to `TRPCError` codes.
2. **Client/server boundary.** `rg -n "from '@klicker-uzh/api" apps/*/src packages/shared-components/src` — every hit must be type-only (`import type` / `RouterOutputs`); check `packages/api/package.json` exports map for what the specifiers resolve to at runtime. Also `rg -n "@klicker-uzh/graphql" apps/frontend-control packages/shared-components` — control claims zero GraphQL.
3. **UX audit of `frontend-pwa` + `frontend-control`** — same method as section 3/4 (`rg -n "catch\(console.error\)|mutateAsync|invalidate\(\)" apps/frontend-pwa/src apps/frontend-control/src`, classify each refresh as required / cache-first / best-effort). Priority: join flows, answer submission (non-idempotent scoring → duplicate-submit protection), auth/locale cache ordering, leaderboards.
4. **Realtime correctness.** WS auth (cookies at upgrade vs connectionParams — compare against GraphQL subscription auth; unauthenticated cross-course events would be a blocker), single event bus feeding both stacks vs duplicated publishes, invalidate-on-reconnect for missed events, traefik/ingress WS upgrade path for `/api/trpc` in `deploy/charts`.
5. **Test parity matrix.** For 5 migrated behaviors, name the GraphQL test and the tRPC test covering the same semantics incl. auth + error contract; flag tRPC tests that bypass the HTTP route where the GraphQL twin used it.

## 8. Path to production (ordered)

Steps 1–6 to make the PR mergeable; 7–10 to make the cutover production-ready.

1. **Fix B1** (`ConfirmationItem`) → push → confirm Cypress Cloud goes green-ish on the new head (expect ≤ a handful of residual failures; triage those individually).
2. **Resolve B2**: decide ride-along strategy with Roland, merge `origin/v3`, resolve the 2 conflicts, leave CONFLICTING state.
3. **Fix B3 + majors 1–3** (four small PR-internal commits: sharing revocation, unpublish hooks ×4, i18n refresh-failure key, FinalizeGradingModal). Each: edit → `pnpm --filter @klicker-uzh/frontend-manage check` → commit.
4. **Sonar hotspots** review to 100% (major 4).
5. **GitGuardian** dashboard resolution (major 5).
6. **Re-run the ledger** (section 2) on the new head: all checks green, mergeable state clean → request human review.
7. **Complete the five pending audits** (section 7); fix or explicitly defer findings here.
8. **Browser-verify the "Runtime Blockers" UX fixes**: the plan's Progress log marks ~30 UX slices "Completed Locally With Runtime Blockers" — none were verified in a browser. Boot the local stack, log in via delegated login (`lecturer`/`abcd`, students `testuser1+`/`abcdabcd`), and walk the fixed flows (grading finalize, batch ops, sharing, unpublish, join flows), including one forced-refresh-failure each (devtools → block `/api/trpc` after mutation response). Use the `agent-browser` skill.
9. **Staging dual-API smoke** per the plan's deployability checklist: deploy backend first, verify `/api/graphql` AND a concrete `/api/trpc` procedure (not the bare base path — it 404s by design) in the same instance, WS subscription probe through the real ingress, then the frontend test-switch. Write the tester script (what should hit which API, and the rollback switch) into the PR body.
10. **S06 (GraphQL removal) stays gated** — do not start until steps 1–9 are done and the cleanup gate is explicitly approved.

## 9. Review coverage disclosure

Completed with adversarial verification: manage UX/cache audit, Cypress triage, branch hygiene. Completed manually: CI ledger, conflict analysis, deploy/link spot-checks (`/api/trpc` mount, Dockerfile, superjson/wsLink). **Not covered:** the five dimensions in section 7. Findings in sections 3–5 marked "verified" were independently re-read by a second reviewer pass; line numbers checked against head `d1daf0b8`.
