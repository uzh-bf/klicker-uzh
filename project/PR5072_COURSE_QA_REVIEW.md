# PR #5072 Review — Course Q&A Alpha (UX, Quality, Production Readiness)

- **PR**: [#5072 feat(course-qa): add generalized discussion platform with Course Q&A alpha surface](https://github.com/uzh-bf/klicker-uzh/pull/5072)
- **Branch**: `course-qa` @ `bc4b9edd7` vs base `v3`
- **Review date**: 2026-07-07
- **Method**: full static review of the backend service, PWA and Manage surfaces, Prisma schema/migration, unit + Cypress suites; CI run-log forensics; reconciliation against `project/DISCUSSIONS_PLAN.md` and `project/DISCUSSIONS_TESTING_PLAN.md`. No new browser run was performed in this pass — runtime evidence referenced below comes from the recorded `agent-browser` validation in the plans and the Cypress suite. Phase 3 below re-establishes the browser loop.
- **Audience**: junior engineer executing the follow-up. Every finding has file:line evidence and a concrete fix. Work top-down: P0 → P1 → verification → PR hygiene.

---

## 1. Verdict

The feature is **well-architected and close to alpha-ready, but not mergeable today**. The backend is the strongest part: access control is layered correctly (rollout gate → runtime flag → enrollment/embed-token), the embed JWT is HS256-pinned with strict claim validation, fingerprints are salted hashes, and the migration has good index coverage. The Cypress suite (21 scenarios) is unusually thorough for an alpha.

What blocks merge: **CI has never run on the current head** (and the last full run had 5 failing discussion tests due to a missing CI env var), a **user-visible pagination bug** that makes "Load more" drop the first page of threads, and a handful of hardcoded English strings in an otherwise fully localized surface.

What blocks *rollout to a real course* (not merge): no delete/moderation UI anywhere despite full server-side support, mutation-triggered full refetches that reorder the list under the user's finger, and a content normalizer that mangles STEM text like `x < 10`.

Usefulness assessment: as shipped, the student surface is a functional "question wall". It will demonstrate demand, which is the alpha's stated purpose. It is **not yet a Q&A product**: no answered/resolved state, no lecturer-answer highlight, no sorting UI, no notifications. Those are correctly deferred per the plan — but the delete/moderation gap is *not* safely deferrable, because it means nobody (student or lecturer) can remove an abusive or accidental post through the UI on day one of a pilot.

---

## 2. P0 — Merge blockers

### P0-1: CI never ran on the PR head; last full run had 5 failing discussion tests

**Evidence:**

- PR head `bc4b9edd7` (2026-04-17) has only 4 check runs: 3× CodeQL `Analyze` + GitGuardian. No typecheck, lint, format, `test-graphql`, or Cypress runs exist for this SHA (verified via `gh api .../check-runs`).
- Last full PR CI run (2026-04-13, two commits earlier): `Check file formatting` **failure**, `Test graphql package logic` **failure**, `Klicker automated testing with cypress` **failure**.
- The 5 failing tests in run `24367936204` are exactly the embed-token tests: `rejects anonymous posting when embed token scope does not match`, `only exposes anonymous embed posting when the specific token allows it`, `hides anonymous posting when an embed scope key is tampered with`, `clamps anonymous embed capability to the course setting`, `does not persist a new scope when a tampered anonymous embed thread is rejected`.
- **Root cause**: the `test` job env in `.github/workflows/test-graphql.yml` (env block around line 208) defines `DATABASE_URL`, Hatchet vars, and all `APP_ORIGIN_*` values — but **no `APP_SECRET`**. Every failing test goes through `getAppSecret()` (`packages/graphql/src/services/discussions.ts:280-288`), which throws when `APP_SECRET` is unset. Compare `packages/graphql/test/accountLtiLinking.test.ts:138`, which self-heals with `process.env.APP_SECRET = process.env.APP_SECRET ?? 'test-app-secret'` — `discussions.test.ts` has no such fallback.
- The format failure is **already fixed on the current head**: I ran `prettier --check` against the 4 files flagged in run `24367936233` (`MCreateCourseDiscussionReply.graphql`, `MCreateCourseDiscussionThread.graphql`, `MToggleCourseDiscussionThreadUpvote.graphql`, `schema/mutation.ts`) and all pass now.

**Fix (junior):**

1. Add `APP_SECRET: test-app-secret` to the `test` job env in `.github/workflows/test-graphql.yml` (next to `DATABASE_URL`). Optionally *also* add the `?? 'test-app-secret'` fallback at the top of `packages/graphql/test/discussions.test.ts` mirroring `accountLtiLinking.test.ts:138`, so local runs work without Infisical.
2. Re-trigger CI on the head: push the workflow change (that alone triggers `synchronize`), or run `gh pr ready 5072` if the draft state is what suppressed runs.
3. Confirm all of these are green before anything else: `Check typescript types`, `Check file formatting`, `Check linting`, `Test graphql package logic`, `Klicker automated testing with cypress`. The old Cypress failure predates the new `Y-course-qa-workflow.cy.ts` suite — treat any red here as real and investigate, don't assume flake.

### P0-2: "Load more" replaces the thread list instead of appending

**Evidence:** `apps/frontend-pwa/src/pages/course/[courseId]/qa.tsx:283-288` calls `fetchMore({ variables: { cursor: nextCursor } })` with no `updateQuery`. The Apollo client is constructed as `new InMemoryCache()` with zero `typePolicies` (`apps/frontend-pwa/src/lib/apollo.ts:172`), so there is no `merge` function for `Query.courseDiscussionThreads`. Apollo's default behavior overwrites the cached field with page 2 — a student who taps "Load more" (button at `qa.tsx:577`) sees threads 1–20 vanish and threads 21–40 appear. Looks like data loss.

**Fix (junior):** add an `updateQuery` to the `fetchMore` call that concatenates `threads` and carries over `nextCursor`/`hasMore` from the new page:

```ts
await fetchMore({
  variables: { cursor: nextCursor },
  updateQuery: (prev, { fetchMoreResult }) => {
    if (!fetchMoreResult) return prev
    return {
      courseDiscussionThreads: {
        ...fetchMoreResult.courseDiscussionThreads,
        threads: [
          ...prev.courseDiscussionThreads.threads,
          ...fetchMoreResult.courseDiscussionThreads.threads,
        ],
      },
    }
  },
})
```

Caveat: the active 30s `pollInterval` (`qa.tsx:99`) refetches with the *original* variables and will reset the list to page 1. That is acceptable behavior-wise but test the interaction; if it feels broken, pause polling once the user has paginated (`stopPolling()` after first `fetchMore`, resume on manual refresh). Verify with >20 seeded threads (see Phase 3).

### P0-3: Hardcoded English strings in localized surfaces

**Evidence:**

- `qa.tsx:471` — `aria-label={`Upvote, ${thread.upvotes} current upvotes`}`
- `qa.tsx:507` — `aria-label={`Upvote reply, ${reply.upvotes} current upvotes`}`
- `apps/frontend-manage/src/components/courses/CourseDiscussionOverview.tsx:306` — literal `Generate a new link before copying.`

Every other string in these files goes through `useTranslations`. German-speaking users get English screen-reader announcements on the core interaction, and lecturers get an English sentence in a German UI.

**Fix (junior):** add keys to `packages/i18n/messages/en.ts` and `de.ts` (e.g. `pwa.courseQA.upvoteAriaLabel` with `{count}` interpolation, `manage.course.embedExpiredRegenerate`), replace the literals. Grep the diff for any others: `git diff origin/v3...HEAD -- apps packages/shared-components | grep -nE '>(\s*[A-Z][a-z]+ )|aria-label=\{`'`.

---

## 3. P1 — Fix before enabling the rollout flag on any real course

### P1-1: No delete/moderation UI anywhere, despite full backend support

**Evidence:** `deleteCourseDiscussionThread` / `deleteCourseDiscussionReply` (`packages/graphql/src/services/discussions.ts:1861,1924`) implement author-delete *and* lecturer-delete (course WRITE access via `canDeleteDiscussionContent`, `discussions.ts:1831-1859`), with tests. But `grep -rn "DeleteCourseDiscussion" apps/frontend-pwa/src apps/frontend-manage/src` returns **zero hits** — the ops `MDeleteCourseDiscussionThread.graphql` / `MDeleteCourseDiscussionReply.graphql` exist and are never imported. On day one of a pilot, an abusive or accidentally identifying post can only be removed by someone with DB access.

**Fix (junior):**

1. PWA (`qa.tsx`): render a small delete button on threads/replies where the viewer is the author. The thread data includes `authorParticipantId`; compare with `self` participant id already available on the page. Confirm-dialog → mutation → `refetchThreads()`. Add `data-cy="course-qa-delete-thread-N"` hooks.
2. Manage (`CourseDiscussionOverview.tsx`): delete button per thread/reply in the overview (server already authorizes WRITE-access users). This is the minimum viable moderation console.
3. Extend the Cypress suite: author deletes own thread; second student cannot see a delete affordance on someone else's thread; lecturer deletes a student thread from Manage.

### P1-2: Full-list refetch after every mutation + activity sort = list reorders under the user

**Evidence:** every mutation handler in `qa.tsx` awaits `refetchThreads()` (lines 171, 222, 252, 272). Sort is hardcoded `ACTIVITY_DESC` (`qa.tsx:93`), and replying bumps `lastActivityAt` server-side (`discussions.ts:1493-1499`), so posting a reply teleports that thread to the top mid-interaction. Upvote mutations already return the full updated thread/reply fragment, which Apollo normalizes into the cache automatically — the refetches are redundant round-trips that add latency and flicker. No optimistic updates anywhere in the file.

**Fix (junior):** remove `refetchThreads()` from both upvote handlers (cache normalization covers count + `hasUpvoted`). Keep the refetch after thread/reply creation for now (simplest correct behavior), but consider `NEWEST_DESC` as the default sort for the student view — it's stable under replies. Manual browser check afterwards: upvote a thread mid-list and confirm nothing moves and the count updates instantly.

### P1-3: `normalizeContent` mangles legitimate text and truncates silently

**Evidence:** `discussions.ts:162-167`: `content.trim().replace(/<[^>]*>/g, '')` then `.slice(0, 4000)`. Two problems:

1. The tag-strip regex eats anything between `<` and `>`: a student typing `for x < 10 and y > 2` loses ` 10 and y > ` — content is silently corrupted. XSS is *not* the reason to keep this: React already escapes on render (`qa.tsx:458,492` render as plain text, no `dangerouslySetInnerHTML` — confirmed safe).
2. Content beyond 4000 chars is silently cut server-side. The client `maxLength={4000}` (`qa.tsx:384,522`) masks this in our own UI but not for other clients.

**Fix (junior):** drop the tag-strip entirely (keep trim + length cap) or replace with a targeted `<script`-only rejection if defense-in-depth is wanted; rendering is already safe. Return `null` (reject) on over-length input instead of slicing, so the client error toast fires. Add a unit test posting `a < b > c` and asserting round-trip fidelity, and one posting 4001 chars asserting rejection. Add a `{length}/4000` counter under both textareas.

### P1-4: Every rate-limited anonymous attempt writes a DB row — unbounded growth under abuse

**Evidence:** `enforceAnonymousRateLimits` (`discussions.ts:633-724`) calls `createDiscussionEvent(ANON_RATE_LIMITED)` on *each* blocked attempt. A single abuser hammering an embed URL generates one Redis incr + **one Postgres insert per request**, forever. The rate limit protects thread creation but not the event table itself.

**Fix (junior):** throttle the event write with the same Redis counter — e.g. only log the *first* rejection per window (`if (scopeWindowCount === ANON_SCOPE_LIMIT + 1)`), so you record that limiting occurred without recording every attempt. Same pattern for course/IP windows. One unit test: 5 rapid anonymous posts → exactly 1 `ANON_RATE_LIMITED` event.

### P1-5: Manage overview silently caps at 50 threads with no pagination UI

**Evidence:** `CourseDiscussionOverview.tsx:41` requests `limit: 100`, but the server clamps to `LIMIT_MAX = 50` (`discussions.ts:11,169-172`). The response's `hasMore`/`nextCursor` are never read — no "load more" control exists. A course with 80 threads shows 50 with zero indication more exist. Also `variables: {...} as any` (`:42`) defeats codegen typing for the whole variables object.

**Fix (junior):** request `limit: 50` honestly, read `hasMore`/`nextCursor`, add a "Load more" button (same `fetchMore` + `updateQuery` pattern as P0-2 — the groups shape needs a small merge helper). Remove the `as any` by using the generated `DiscussionSortType` enum value instead of the string literal.

### P1-6: Upvote un-toggle uses a read-modify-write; concurrent votes can throw

**Evidence:** `discussions.ts:1715-1725` (thread) and `:1794-1804` (reply): on un-upvote, the code reads `upvotes` then writes `Math.max(0, current - 1)` — two concurrent un-upvotes at READ COMMITTED can both read 2 and both write 1, drifting the counter. Conversely two concurrent upvote=true calls both pass the `findUnique` null-check, and the second `create` violates the composite PK, throwing an unhandled P2002 out of the resolver.

**Fix (junior):** use atomic `decrement: 1` guarded by a `WHERE upvotes > 0`-style conditional (Prisma: `updateMany({ where: { id, upvotes: { gt: 0 } }, data: { upvotes: { decrement: 1 } } })`), and wrap the vote `create` in a `try/catch` that treats P2002 as "already voted" (idempotent success). Low urgency at alpha traffic, cheap to fix now.

### P1-7: Embed tokens are irrevocable for up to 14 days

**Evidence:** `getCourseDiscussionEmbeddingInfo` signs tokens valid 1–336h (`discussions.ts:1179`) with the global `APP_SECRET`. There is no `jti`, no per-course secret, no revocation list. A leaked embed URL (they will be pasted into LMS pages, emails, chats) grants read access — and anonymous *write* access if `allowAnonymous` — to that scope until expiry. Disabling `isCourseQAEnabled` kills all tokens for the course (checked per-request via `getCourseSettings`), which is the only kill switch, and it takes the whole course Q&A down with it.

**Fix (junior, alpha-acceptable scope):** document the "disable course Q&A = kill switch" behavior in the PR description and lecturer-facing tooltip. For GA, plan a `jti` + Redis denylist or per-course token secret. Do not build the GA mechanism now — just make the limitation explicit and confirm the kill switch works in Phase 3 verification.

### P1-8: Replies beyond 50 per thread are stored but never rendered

**Evidence:** reply creation has no per-thread cap (`createCourseDiscussionReply`, `discussions.ts:1383+`), but listing includes at most `REPLIES_PER_THREAD_MAX = 50` (`discussions.ts:12,760`) with no reply-level pagination. Reply #51 is accepted, bumps `replyCount`, and is invisible to everyone.

**Fix (junior):** cheapest correct alpha behavior: reject reply creation when `replyCount >= 50` (return null → existing error toast fires), so stored data always matches rendered data. Note the cap in the UI when reached. GA can add reply pagination.

### Smaller P1 notes (bundle into one cleanup commit)

- **XFF trust**: `getRequestIP` (`discussions.ts:243-263`) trusts the first `x-forwarded-for` entry. Behind the HAProxy/Traefik ingress this is fine *only if* the ingress overwrites rather than appends client-supplied XFF — verify in `deploy/charts/klicker-uzh-v3` ingress config and note the result in this file; otherwise the IP rate limit is trivially bypassable with spoofed headers.
- **Query with side effects**: `getCourseDiscussionEmbeddingInfo` is a GraphQL *query* that upserts `DiscussionScope` rows (`discussions.ts:1165-1177`). Every lecturer typo in source/ref creates a permanent junk scope with no cleanup path. Acceptable for alpha; add a follow-up ticket for scope cleanup/list-existing-scopes UX, and consider making the embed generator suggest previously used source/ref pairs (also better UX).
- **Anonymous reply checkbox persists after posting**: `handleCreateReply` resets the draft (`qa.tsx:218-221`) but not `postReplyAnonymous[threadId]` (`qa.tsx:62,204,540`). Privacy-sensitive toggle silently sticks across posts. Reset it alongside the draft.
- **Poll cost**: PWA polls every 30s (`qa.tsx:99`), Manage every 20s (`CourseDiscussionOverview.tsx:44`), both `cache-and-network`, neither gated on `document.visibilityState`. Fine at alpha scale; gate on visibility before broad rollout.
- **Course theming**: discussion links hardcode `text-blue-700` (`ElementStack.tsx` diff, `evaluation.tsx` diff) instead of the course/primary theme token used elsewhere. Cosmetic; align with design-system colors.

---

## 4. P2 — GA gaps (explicitly deferred; do NOT build during alpha)

Recorded so the alpha decision (per the ClickUp task "Decide future of course Q&A alpha versus tutor chatbot roadmap") is made with full sight of remaining product cost:

1. **Answered/resolved/pinned state** — schema has no fields for it (`discussion.prisma` thread model: only soft-delete flags). Without triage state, a lecturer cannot see "what still needs attention"; this is the single biggest gap between "wall of posts" and "Q&A".
2. **Lecturer answer authoring + highlight** — Manage overview is read-only (`CourseDiscussionOverview.tsx:339-371`, no reply input); PWA thread data has no author-role field, so students can't distinguish a lecturer/TA answer from a peer comment.
3. **Sort/search/filter UI** — backend already supports 3 sort modes (`schema/discussions.ts` `DiscussionSort`); UI hardcodes one. Cheap win when wanted.
4. **Notifications** — no lecturer signal for new questions, no student signal for answers. Events table already captures everything needed.
5. **Rich text** — content is plain text; code/math in STEM courses renders as a wall. Markdown rendering exists in `packages/markdown` — reuse, don't rebuild (needs sanitization review when adopted).
6. **Overview grouping is a no-op** — `sourceLabelForSpace()` returns the constant `'Course'` (`discussions.ts:201-203`), so all threads land in one group and the group abstraction does nothing yet. Either group by `scope.scopeLabel` or drop the grouping layer.
7. **Student Q&A entry is a floating button, not a tab** (`course/[courseId]/index.tsx:202-213` diff) — discoverability will suffer; the course page already has a `Tabs` component right below it.
8. **A11y polish** — upvote touch targets 28–32px (`qa.tsx:468,504`), `aria-pressed` unverified on the design-system `Button` `active` prop, no focus management after posting.

---

## 5. Test & verification status

### Unit/integration (`packages/graphql/test/discussions.test.ts`, 13 tests)

Covered well: happy path, idempotent toggles (sequential), rollout/runtime fail-closed, embed scope mismatch + tamper + clamping, delete authorization + events, stack/external scope creation, schema-surface DDL lock, course-feed isolation.

**Not covered (add during P1 work):**

| Gap | Why it matters | Test to add |
| --- | --- | --- |
| All 4 rate limits (`discussions.ts:17-24`) | Core abuse control entirely untested; helpers hardcode one IP (`test ctx :51,66`) | Loop posts to exceed each window; assert null + exactly one `ANON_RATE_LIMITED` event (pairs with P1-4) |
| Embed token expiry | Only tamper/mismatch tested, never time-based rejection | Sign token with `expiresIn: '1s'`, wait/fake-time, assert fail-closed |
| Cursor pagination | P0-2 showed nobody exercised paging | Seed 25 threads, page with `limit: 20` + cursor, assert disjoint pages, `hasMore` flip |
| Reply on deleted thread / reply cap | Guard exists (`discussions.ts:1414`) but untested; cap missing (P1-8) | Delete thread → reply attempt → null; 50-reply cap test |
| Content normalization | P1-3 regression protection | `a < b > c` round-trip; 4001-char rejection |
| Concurrent vote toggle | P1-6 | `Promise.all` duplicate upvotes → no throw, count = 1 |

### Cypress (`cypress/cypress/e2e/Y-course-qa-workflow.cy.ts`, 21 scenarios)

Strong coverage of the full alpha surface including rollout matrix and embed tamper. Known flakiness risks, fix opportunistically if CI shows instability (don't preemptively refactor):

- 5× fixed `cy.wait(500)` (lines 112, 117, 146, 175, 208) — replace with assertion-based waits on the expected count/text if they flake.
- Cross-test state via `cypress/fixtures/_qa-embed-url.txt` (lines 240, 246, 266) and strict test-order dependence within one `describe` — acceptable, but never run this spec with `--record --parallel` group splitting.
- Several lecturer-side tests assert element existence only (not toggle values/persisted state) — QA-001's "settings persist after save" criterion is not actually asserted; add a reload + checked-state assertion.

### QA matrix reconciliation (plan table is stale — dated 2026-04-13, pre-Cypress)

| ID | Plan status (04-13) | Actual status now | Remaining action |
| --- | --- | --- | --- |
| QA-001 | BLOCKED (manage misroute) | Mostly covered by Cypress (tab gating, toggles exist) | Add persist-after-reload assertion; close out |
| QA-002 | PARTIAL | Covered by Cypress (link visibility, runtime off/on, rollout off) | Mark PASS after CI green |
| QA-003/004 | PASS | Also Cypress-covered | Done |
| QA-005 | PARTIAL PASS | Cypress covers practice-quiz stack path + isolation; microlearning link render covered | Flag-off matrix rerun in Phase 3 |
| QA-006 | BLOCKED | Cypress covers overview aggregation + rollout-off tab removal | Mark PASS after CI green |
| QA-007/008/009 | PASS (service-generated URL) | Cypress now covers manage-generated URL end-to-end | Done |
| QA-010 | NOT RUN | **Still not run anywhere** | Runtime rate-limit check in Phase 3 + unit tests above |
| QA-011 | PASS | Unit test 7 + Cypress rollout-off access-denied | Done |
| QA-012 | NOT RUN | **Still not run** — legacy live feedback regression | Run existing live-quiz feedback Cypress specs against this branch; confirm green (this PR touches no live-feedback code, so green CI ≈ pass) |

**Update `project/DISCUSSIONS_TESTING_PLAN.md`'s status table as part of this follow-up** — it is the declared source of truth and currently understates coverage.

---

## 6. What is done well (keep, don't churn)

- Three-flag rollout model implemented exactly as planned, fail-closed everywhere; the flag-gating learning from `AGENTS.md` is respected (flags gate visibility alone).
- Embed JWT: HS256 pinned in `packages/util/src/jwt.ts:56` (`algorithms: ['HS256']` default), issuer check, version/scope/spaceType/courseId/scopeKey claim binding, clamped lifetime, anonymous capability double-gated (course setting AND token claim) — genuinely careful token design.
- Anonymous fingerprint = `sha256(APP_SECRET|courseId|ip|ua)` (`discussions.ts:290-298`) — salted, unlinkable across courses, no raw PII at rest. Raw IP appears only in short-TTL Redis keys; worth one sentence in the privacy notes, nothing more.
- Migration index coverage matches the hot paths (`(spaceId, scopeId, lastActivityAt)` etc. — migration.sql:130-175); counters denormalized with events for future analytics.
- Transactions around create+event, vote+counter, delete+cascade; author FKs `SET NULL` so content survives account deletion; soft-delete clears content immediately (good GDPR posture).
- Alpha schema surface locked by a DDL assertion test — scope creep will fail loudly.
- `data-cy` discipline and DE/EN i18n parity (two exceptions in P0-3) are excellent.

---

## 7. Execution plan for the junior

Work in this order. One commit per numbered item, conventional commits (`fix(course-qa): ...`), pre-commit hooks on. After each phase, push and confirm CI.

**Phase 0 — CI green (½ day)**

1. `APP_SECRET` into `test-graphql.yml` + optional test-file fallback (P0-1). Push, watch `gh pr checks 5072 --watch`.
2. If Cypress fails: pull the artifact screenshots from the failed run before touching code (`Cypress CI signal timing` note in AGENTS.md applies — wait for `cypress-run-cloud` completion).

**Phase 1 — merge blockers (1 day)**

3. P0-2 fetchMore fix. 4. P0-3 i18n fixes. Both verified in Phase 3.

**Phase 2 — pre-rollout fixes (2–3 days)**

5. P1-1 delete UI (PWA then Manage) + Cypress scenarios.
6. P1-2 drop redundant refetches.
7. P1-3 normalizeContent + tests + char counter.
8. P1-4 rate-limit event throttle + tests; P1-6 atomic vote ops + test; P1-8 reply cap + test.
9. P1-5 Manage pagination + remove `as any`.
10. Bundle commit: anonymous-checkbox reset, XFF verification note, theming color, i18n sweep.

**Phase 3 — runtime verification (1 day; MANDATORY before marking ready)**

Local env: `pnpm install`, seeded DB (`pnpm run prisma:setup`), dev servers up, then `npx agent-browser` (never bare). Logins: lecturer `lecturer`/`abcd` (Delegated Access — check Terms checkbox first), students `testuser1..50`/`abcdabcd` on Testkurs. Follow the per-scenario command skeletons in `project/DISCUSSIONS_TESTING_PLAN.md`; capture before/after screenshots to `/tmp/discussions/`.

Must-capture items this round:

- Pagination: seed >20 threads (quick script via Prisma Studio or a loop against the API), tap "Load more", screenshot showing pages accumulate (P0-2 evidence).
- Upvote mid-list: no reorder, instant count (P1-2 evidence).
- Delete flows: student own-post, lecturer moderation (P1-1 evidence).
- QA-010: burst anonymous posts on an embed URL → UI error after limit; corroborate `ANON_RATE_LIMITED` count in DB (exactly 1 per window after P1-4).
- Kill switch: disable `isCourseQAEnabled` while an embed URL is open → next action fails closed (P1-7 evidence).
- Mobile viewport (375px) pass over `/qa`: compose, reply, upvote reachable and legible.
- Update the status table in `project/DISCUSSIONS_TESTING_PLAN.md` and paste the evidence table into the PR.

**Phase 4 — PR hygiene**

- Un-draft, re-request CodeRabbit (`@coderabbitai review`), triage its findings per the AGENTS.md guidance (verify before "fixing" — many false positives).
- Update the PR description (whole-branch scope, evidence, what reviewers must manually verify) — use the MR-description workflow, include the Phase 3 screenshots.
- Final pass: run a strict maintainability/security review before merge; resolve or explicitly defer each finding with rationale.
- **Do not merge without explicit approval from Roland.**

**Rollout (after merge, separate)**

- Deploy to staging; apply migration; flags remain `false` everywhere by default (safe).
- Enable `isCourseQARolloutEnabled` + `isCourseQAEnabled` on ONE pilot course via DB/admin. Anonymous stays off unless the pilot needs embeds.
- Monitor for the first week: `DiscussionEvent` volume by type, `ANON_RATE_LIMITED` counts, thread/reply creation errors in API logs, DB size of `DiscussionEvent`.

**Do NOT during this follow-up:** widen the alpha scope (no `PRACTICE_QUIZ`/`PRACTICE_ELEMENT`/`LIVE_QUIZ` surfaces — the DDL lock test will catch you), build GA moderation (pin/resolve schema), add realtime subscriptions, or weaken any failing test to get CI green.

---

## 8. Open questions for Roland (answer before Phase 2 completes)

1. Default student sort: keep `ACTIVITY_DESC` (threads jump on reply) or switch to `NEWEST_DESC` for stability? Recommendation: `NEWEST_DESC` until sort UI exists.
2. Is lecturer-delete-from-Manage sufficient moderation for the pilot course, or does the pilot need the answered/pinned triage state (P2-1) pulled forward?
3. Embed-token revocation: is "disable course Q&A" an acceptable kill switch for the alpha (documented), or should the pilot avoid `allowAnonymous` embeds entirely?
