# PR #5109 Production Readiness Review

- **PR**: [#5109 — feat(chat): add embedded assistant and MCP workflows](https://github.com/uzh-bf/klicker-uzh/pull/5109)
- **Base**: `v3-ai` · **Head**: `codex/manage-assistant-mcp-v3-ai` @ `8e0c851b9`
- **Scope**: 167 files, +12,307 / −713 vs `origin/v3-ai`
- **Date**: 2026-07-07
- **Reviewer**: Claude (multi-agent review + manual verification), on behalf of Roland Schlaefli

## Verdict

The PR is in good shape for a merge into `v3-ai`: auth design is sound, tests pass at the assertion level, Helm/CI deployment artifacts exist for both MCP servers, and the lecturer assistant is deliberately read/draft-only with a signed-proposal pattern for anything that touches data. It is **not yet production-ready**: a handful of small confirmed defects need fixing, runtime verification on staging has not happened, and several security and UX properties are asserted in code but have never been observed in a running environment. The ordered checklist in the last section is the remaining path to production; every step has exact commands.

## How this review was done (and its limits)

1. **Automated multi-agent review** across six dimensions (UX, security, quality, tests, product, ops) with adversarial verification. Due to API rate limits and a spend cap during the run, only the *quality* dimension and the *test-evidence* runner completed; their findings were then re-verified manually with greps/diffs in this worktree.
2. **Manual targeted review** by the main reviewer for security/auth, UX/i18n, ops, and product dimensions — spot-checks on the highest-risk files, not exhaustive reading of all 167 files.
3. **No runtime verification was performed in this review session** (no dev stack, no browser run). Claims marked **UNVERIFIED-RUNTIME** below hold in the code but have not been observed live. The junior checklist closes exactly this gap.

## Test evidence (executed in this worktree)

All four suites were run with `CI=1`:

| Suite | Result | Detail |
| --- | --- | --- |
| `pnpm --filter @klicker-uzh/mcp-lecturer test` | ✅ PASS | 8 files, 33 tests, 0.97 s |
| `pnpm --filter @klicker-uzh/mcp-student test` | ⚠️ 22 tests pass, 1 suite load error | `test/graphqlClient.test.ts` fails to load: `Cannot find package '@klicker-uzh/graphql/dist/client.json'` |
| `pnpm --filter @klicker-uzh/util test` | ✅ PASS | 4 files, 58 tests (incl. new `jwt.test.ts` negative paths) |
| `pnpm --filter @klicker-uzh/chat test:run` | ⚠️ 48 tests pass, 10 suite load errors | All 10 fail with `Cannot find package '@klicker-uzh/util/...'` |

**Interpretation**: 161 tests ran, 0 assertion failures. All 11 suite failures share one root cause — `packages/util/dist` and `packages/graphql/dist` were never built in this worktree, and the test suites import built artifacts via `package.json#exports`. This is a build-order artifact of running `--filter` tests in a fresh checkout, **not** a code defect. To reproduce a clean signal:

```bash
pnpm --filter @klicker-uzh/util build
pnpm --filter @klicker-uzh/graphql build
pnpm --filter @klicker-uzh/mcp-student test
pnpm --filter @klicker-uzh/chat test:run
```

**Action for CI sanity**: confirm the GitHub Actions test jobs build workspace dependencies before running package tests (turbo task dependencies normally handle this — verify once on CI logs, then ignore).

## Confirmed findings (each re-verified manually)

### F1 — `MCP_LECTURER_SCHEME` / `MCP_STUDENT_SCHEME` missing from `turbo.json` `globalEnv` — **medium**

- **Evidence**: consumed at runtime by `apps/chat/src/services/lecturerMcp.ts` and `apps/chat/src/services/studentPracticeMcp.ts`; set in production config `deploy/charts/klicker-uzh-v3/templates/cm-chat.yaml:30` and `:37`. `turbo.json:93-104` lists all other `MCP_*` vars but neither `*_SCHEME`.
- **Impact**: Turborepo cache does not invalidate when these vars change; per repo convention (CLAUDE.md) every Infisical-managed env var must be in `globalEnv`.
- **Fix (5 min)**: add `"MCP_LECTURER_SCHEME"` and `"MCP_STUDENT_SCHEME"` to the `globalEnv` array in `turbo.json`, keeping alphabetical grouping with the other `MCP_*` entries. Run `pnpm run format:check` afterwards.

### F2 — ~450 LOC structural duplication between the two MCP apps — **medium (do not block merge; ticket it)**

- **Evidence**: `toolErrors.ts` (123 lines), `toolPolicy.ts` (151), `toolRunner.ts` (92), `capabilities.ts` (86) exist in both `apps/mcp-lecturer/src/` and `apps/mcp-student/src/` with identical structure and constants (textual diff is large only because of lecturer/student renames).
- **Impact**: every policy/error-format fix must be applied twice; the two servers will drift.
- **Fix**: post-merge refactor — extract a `@klicker-uzh/mcp-shared` package (or a folder in `packages/util`) holding the generic tool-runner/policy/error plumbing, parameterized by role. Do **not** do this inside PR #5109; it is already large. Create a follow-up issue referencing this section.

### F3 — `any`-typed Prisma delegate args in lecturer MCP service — **low**

- **Evidence**: `apps/mcp-lecturer/src/service.ts:244` (`findFirst: (args: any)`), `:248`, `:252`.
- **Impact**: no type-checking on `where`/`select` shapes used by authorization-relevant queries; a wrong field name in a scope filter would compile.
- **Fix**: replace with `Prisma.CourseFindFirstArgs` etc. from `@prisma/client`, or type the delegates as `Pick<PrismaClient['course'], 'findFirst' | 'findMany'>`.

### F4 — `usePwaEmbedTokenBootstrap` duplicates `useChatGuestTokenBootstrap` — **low**

- **Evidence**: `apps/chat/src/hooks/usePwaEmbedTokenBootstrap.ts` mirrors the guest-token hook line-for-line (same `bootstrapTokenFromUrl` call, same try/catch cleanup, same `router.replace` effect).
- **Fix**: fold both into one `useTokenBootstrap({ storageKey, queryKey, evictKeys })` hook when convenient; fine to bundle with F2's refactor ticket.

## Security spot-check (manual, code-level)

What was checked and found **sound**:

- **JWT hygiene**: HS256 pinned with `algorithms: ['HS256']` at verification (`apps/mcp-lecturer/src/jwt.ts:43-47`), so no alg-confusion; issuer verified; 5 s clock tolerance.
- **Token scoping**: lecturer MCP session requires `role === 'USER'` **and** `purpose === 'lecturer-mcp'` **and** explicit scopes (`manage:read` / `manage:draft`) — `apps/mcp-lecturer/src/auth.ts:57-73`. A student/participant token cannot pass this check.
- **Minting**: chat server mints 5-minute JWTs, caches for 4, and **fails loud** if `APP_SECRET`/`APP_ORIGIN_AUTH` are missing (`apps/chat/src/lib/server/mcpAuthMint.ts`). Good failure mode.
- **Write safety**: all lecturer tools are read- or draft-only; the only mutation path is a **signed proposal token** that the lecturer must explicitly confirm in the Manage UI (`apps/mcp-lecturer/src/server.ts:216-237`). The LLM cannot persist anything by itself.
- **Iframe control**: `frame-ancestors 'self' ${allowed}` CSP in `apps/chat/src/middleware.ts:16`.
- **All tools route through wrappers**: `runLecturerReadTool` / `runLecturerDraftTool` / `runStudentTool` — no tool bypasses session checks or the standard error format (verified by the quality agent across every `addTool` call).

**UNVERIFIED-RUNTIME security items** — must be observed on staging before production (see checklist):

1. Rate limiting / abuse protection on the public MCP HTTP endpoints (none seen in app code; if it is expected at ingress level, confirm the annotation exists).
2. CSP `frame-ancestors` value in the **deployed** environment (prod allowlist ≠ local Traefik config; the plan flagged this as an open risk).
3. Real-LMS third-party-cookie behavior for the `_pe` sessionStorage fallback (plan section "Open Risks").
4. No token/PII leakage in production log output during tool instrumentation (code looked clean; confirm once on staging logs).

## UX spot-check (manual, code-level)

- **i18n**: symmetric additions to `packages/i18n/messages/en.ts` and `de.ts` (+13 lines each): 7 course-chatbot keys (`openCourseChat`, `courseChat`, `selectChatbot`, `openInNewTab`, `activeContext`, `questionContext`, `noCourseChatbot`) and 5 manage-assistant keys. No asymmetry found.
- **Empty state exists**: `noCourseChatbot` covers courses without a configured chatbot.
- **Screenshot evidence committed**: only 4 student-chat states (`project/screenshots/mcp-student-chat-*.png`). The plan's slice 6 captured ~10 more states (course home, microlearning, mobile, fallback link) but stored them in `/private/tmp/klicker-pr5109-screens/` — **ephemeral, now lost to the PR record**. Manage assistant has **no** committed screenshot.
- **UNVERIFIED-RUNTIME UX items**: drawer focus trap and Escape handling, mobile drawer width, embed behavior in short LMS iframes, token-expiry recovery UX. All covered in the checklist below.

## Ops spot-check (manual)

Present and correct in the diff:

- Helm for mcp-lecturer: deployment (with `livenessProbe`/`readinessProbe`/`resources`/`imagePullPolicy` from values — `deploy/charts/klicker-uzh-v3/templates/deployment-mcp-lecturer.yaml:50,71,75,79`), HPA, PDB, service, configmap, plus `env-uzh-stg`/`env-uzh-prd` values.
- CI image workflows exist for **both** servers: `.github/workflows/v3_mcp-lecturer-{stg,prd}.yml` (new in this PR) and `v3_mcp-student-{stg,prd}.yml` (pre-existing).
- Dockerfiles exist for both MCP apps.

To confirm before deploy (junior checklist): `mcpLecturer.image.pullPolicy` value should be `IfNotPresent` for immutable tags; ingress/streamable-HTTP timeout annotations; chat app graceful degradation when an MCP server is down.

## Usefulness assessment

- **Lecturer**: 9 tools — capabilities, course list/get, element search/get, question/choices/feedback drafts, and draft-question proposal. Real value: a lecturer can search their question pool, get drafting help, and create a draft question via confirmed proposal without leaving Manage. Honest framing: this is a **solid, safe v1**, not yet a workflow replacement (no editing of existing elements, no session assembly). The read/draft-only boundary is the right call for the first production release.
- **Student**: course chatbot reachable from course home, practice quizzes, and microlearnings, with page context passed to the model — this converts the existing chatbot from a separate page into an in-context tutor, which is where the pedagogical value is. Embed flow has a no-login recovery path and a new-tab fallback.

## Remaining steps to production (ordered, junior-executable)

Work through these in order. Steps 1–3 are local; 4–6 need the dev stack; 7–8 are staging. Tick each box in this file as you go and commit the updates.

### 1. Fix confirmed findings (≈30 min)

- [ ] F1: add `"MCP_LECTURER_SCHEME"` and `"MCP_STUDENT_SCHEME"` to `globalEnv` in `turbo.json`.
- [ ] F3: type the Prisma delegates in `apps/mcp-lecturer/src/service.ts:244-252` (use `Prisma.*Args` types).
- [ ] Commit both as `fix(mcp): address production readiness review findings`.
- [ ] File one follow-up issue for F2 + F4 (shared MCP package + merged bootstrap hook), linking this review.

### 2. Clean local test signal (≈15 min)

```bash
pnpm install
pnpm --filter @klicker-uzh/util build
pnpm --filter @klicker-uzh/graphql build
pnpm --filter @klicker-uzh/mcp-lecturer test
pnpm --filter @klicker-uzh/mcp-student test
pnpm --filter @klicker-uzh/chat test:run
pnpm run check:all
```

- [ ] All suites green (expect 33 + 23 + 105+ tests). If `graphqlClient.test.ts` still fails, run `pnpm --filter @klicker-uzh/graphql generate` first.

### 3. Verify CI is green

- [ ] `gh pr checks 5109 -R uzh-bf/klicker-uzh` — all checks pass on the head commit.

### 4. Local runtime smoke of the MCP servers (≈30 min)

Follow the PR body's "Manual Verification Before Merge":

```bash
./_run_app_dependencies.sh local          # Postgres, Redis, Traefik, Hatchet
pnpm --filter @klicker-uzh/mcp-lecturer dev
pnpm --filter @klicker-uzh/mcp-student dev
pnpm --filter @klicker-uzh/mcp-lecturer smoke:local
pnpm --filter @klicker-uzh/mcp-student smoke:local
```

- [ ] Both smoke runs pass (they exercise auth + every tool against the seeded DB).
- [ ] Negative check: call a lecturer tool with a student token (the smoke client can mint one) and confirm a clean `Authentication failed` error, not a 500.

### 5. Browser verification with agent-browser (≈1–2 h) — closes the UNVERIFIED-RUNTIME items

Start the full dev stack (`pnpm run dev` with Infisical), then use `npx agent-browser` with **delegated** login (lecturer `lecturer`/`abcd`, student `testuser1`/`abcdabcd`, course "Testkurs"). Capture a screenshot for every state and attach them to the PR as a comment (the slice-6 evidence was lost in `/private/tmp` — this time commit them under `project/screenshots/` or attach to the PR):

- [ ] Student: course home → chatbot drawer opens; page context chip shows; send one message.
- [ ] Student: practice quiz question → drawer shows `Question x/y` context; answer, then re-open.
- [ ] Student: microlearning (intro + question page) → drawer works, embedded navigation preserved.
- [ ] Student: embedded mode (`?embed=true`) on mobile viewport (375px) → drawer full-width, not overlapped by sticky submit button.
- [ ] Student: course without chatbot → `noCourseChatbot` empty state, no broken button.
- [ ] Lecturer: Manage → assistant drawer opens; run one read tool (course list) and one draft proposal; confirm the proposal card requires explicit confirmation and creates a DRAFT question only.
- [ ] Both: keyboard — Escape closes drawer, focus returns to trigger button; tab order inside drawer sane.
- [ ] Expiry: with the drawer open, delete the embed session cookie in devtools, send a message → user sees a recoverable error (fallback link / re-auth), not a silent hang.
- [ ] Kill the mcp-lecturer dev server, send an assistant message in Manage → chat degrades gracefully with a visible error, chat itself keeps working.

### 6. Update the PR

- [ ] `gh pr comment 5109 --body-file <(echo "...")` with the screenshot evidence and smoke results, or edit the PR body's verification section.

### 7. Staging deploy + runtime security checks

- [ ] Merge to `v3-ai`, let CI build `mcp-lecturer`/`mcp-student` stg images; confirm ArgoCD syncs the new manifests (deployment, HPA, PDB, service, configmaps) and pods go Ready.
- [ ] Confirm `mcpLecturer.image.pullPolicy` in the applied values is `IfNotPresent` (immutable tags).
- [ ] Long streaming response through the staging ingress (>60 s) — confirm no proxy timeout/buffering cut-off; if it dies, add SSE-friendly timeout annotations to the chat/MCP ingress.
- [ ] Check staging logs during a tool-heavy chat: no JWTs, no raw tool payloads with PII.
- [ ] Verify deployed CSP: from the staging LMS/OLAT context, the embed loads; from an unrelated origin, framing is blocked.
- [ ] Confirm (or create) the kill switch: how do we disable the assistant per environment if the LLM misbehaves? If the only lever is deleting the deployment, add a values-level enable flag before production.
- [ ] Decide on rate limiting for the MCP endpoints (ingress annotation or app-level) — currently none in app code.

### 8. Production gate

- [ ] All boxes above ticked, staging soak of at least a few days of real usage.
- [ ] Follow-up tickets exist for: F2/F4 refactor, OAuth for external MCP clients (`project/plans_wip/PLAN-external-mcp-oauth.md`), chips/iframe auth rollout (`project/plans_wip/PLAN-chips-iframe-auth-rollout.md`).
- [ ] Get explicit approval from Roland before the production merge/promotion.

## Known deferred work (by design, not blockers)

- External MCP client OAuth (plan committed, not implemented).
- Lecturer tools beyond read/draft (element editing, session assembly).
- Docs: no lecturer-facing documentation for the assistant in `apps/docs` yet — worth a small page before broad announcement.
