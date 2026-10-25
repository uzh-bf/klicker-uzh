# PR #5109 Implementation Review — plans vs. code, production readiness, UX

- **PR**: [#5109 — feat(chat): add embedded assistant and MCP workflows](https://github.com/uzh-bf/klicker-uzh/pull/5109)
- **Base**: `v3-ai` · **Head**: `codex/manage-assistant-mcp-v3-ai` @ `fb58d89e2`
- **Scope**: 172 files, +12,582 / −687 vs `origin/v3-ai`
- **Date**: 2026-07-20
- **Method**: five parallel Opus review agents (two plan-coverage, two production-readiness, one UX) orchestrated by a main reviewer; every load-bearing finding re-verified by the main reviewer with grep/diff against the head commit before inclusion.
- **Predecessor**: [`project/2026-07-07-pr-5109-production-readiness-review.md`](2026-07-07-pr-5109-production-readiness-review.md) (findings F1–F9). This review checks which of those landed and adds fresh findings.

## Verdict

The architecture faithfully implements the plans' security design, and the core is genuinely well-built: signed-proposal write safety, JWT scoping, answer-safe student context, solution-leakage stripping, and graceful MCP-outage degradation are all real and correct. The PR is **not production-ready**, and its headline lecturer-facing feature currently **cannot be switched on in staging or production** at all. Five themes dominate:

1. A deployed-environment wiring gap makes the Manage assistant unreachable in stg/prd (N1).
2. The branch's own e2e regressions are red on CI, now root-caused and cheap to fix (N2).
3. The 2026-07-07 review's "fix before merge" items were never applied (F1/F3/F5/F6); only F9 landed.
4. The entire chat UI is hardcoded English in a bilingual product (U1).
5. The decision/plan paper trail is stale — 8 resolved "open decisions" recorded nowhere, 0/33 readiness-checklist boxes ticked, no committed browser/E2E evidence for the Manage assistant.

None of this is a rearchitecture. It is a finish-the-last-mile list.

## 1. Plan coverage

### Lecturer / Manage assistant (`PLAN-manage-embedded-assistant.md`, `PLAN-lecturer-mcp.md`)

Shipped as designed: widget shell + context bridge + dedicated lecturer route, Zod-validated read/draft tools, signed-proposal confirmation model, RBAC with all 5 required test cases, data-minimization caps. Gaps:

- **Tool surface is 9 of 11 planned tools** ([`apps/mcp-lecturer/src/toolPolicy.ts:1-11`](../apps/mcp-lecturer/src/toolPolicy.ts)). Missing: `klicker_lecturer_practice_quiz_list`, `klicker_lecturer_element_update_draft_proposal`, `klicker_lecturer_practice_quiz_create_draft_proposal`. Net effect: the assistant can search/read/draft new questions but cannot browse practice quizzes, propose an edit to an existing question, or assemble a quiz. Not recorded as a scope cut anywhere.
- **Context bridge is partial** ([`apps/frontend-manage/src/components/assistant/manageAssistantContext.ts`](../apps/frontend-manage/src/components/assistant/manageAssistantContext.ts)): route/query-derived ids + surface are captured; the plan's "selected tags, active filters, draft title/content" are not.
- **Proposal card lost the planned "Edit in form" action** ([`apps/chat/src/components/manage-proposal-card.tsx`](../apps/chat/src/components/manage-proposal-card.tsx)) — lecturer can only accept as-is or re-prompt.
- **All 3 open decisions resolved in code, none recorded**: ephemeral threads (commit `2cd7331c6`), globally-available widget, confirm-via-chat-route-GraphQL. No ADR, no plan Progress update, no PR-body callout.

### Student / PWA embedded chat (`pwa-embedded-chat-remainder-plan.md`, `PLAN-mcp-server.md` [superseded], `STUDENT_MCP_CONCEPT.md`)

Implemented nearly clause-for-clause: scoped embed-auth handoff (2-min exchange token → 12-h chat-owned session token, host-only cookie + `_pe` sessionStorage fallback), answer-safe context, solution stripping (tested), complete-stack validation, signed question refs (HMAC-SHA256, `timingSafeEqual`). Gaps:

- **`STUDENT_MCP_CONCEPT.md §10.3` unimplemented — the tutoring feedback loop is missing.** After a student submits a quiz answer in chat, the grading result is rendered client-side only ([`apps/chat/src/components/student-practice-quiz-card.tsx:315`](../apps/chat/src/components/student-practice-quiz-card.tsx)) and never reaches the assistant thread. The tutor cannot react to a wrong answer inside the same turn — the exact loop the concept doc is built around (matches open question §14.6; sibling of F8).
- **No Cypress/Playwright coverage for the new PWA chatbot surfaces** (`grep -rl CourseChatDrawer cypress/` → empty). Slice 6's "Cypress smoke where feasible" was never done.
- **`PLAN-mcp-server.md` deviations are by design** (file self-marks superseded): `apps/mcp-server`→`apps/mcp-student`, Next.js→FastMCP, port 3020→7080, two-layer auth→single participant-JWT. The single-layer choice is reasonable because mcp-student has **no public ingress** (verified: no `ingress-mcp-student.yaml`), but that mitigating fact is written down nowhere.

### Paper trail

Neither active plan has a Progress section reflecting what shipped. The 2026-07-07 review's 33-item checklist is **0/33** ticked at head. Slice-6 browser screenshots were captured to `/private/tmp/…` and lost. No committed browser/E2E evidence exists for the Manage assistant.

## 2. Production readiness

All findings below re-verified by the main reviewer at `fb58d89e2`.

### Prior findings (2026-07-07)

| Finding | Status now | Evidence |
| --- | --- | --- |
| F1 — `MCP_LECTURER_SCHEME`/`MCP_STUDENT_SCHEME` in `turbo.json globalEnv` | **Unfixed** | absent from `turbo.json` |
| F3 — `any`-typed Prisma delegates | **Unfixed** | `apps/mcp-lecturer/src/service.ts:244,248,252` |
| F5 — `query:".*"` returns empty course list | **Unfixed (live bug)** | read schemas `service.ts:39-58` have zero `.describe()`; no `.*`/`*`/`%` guard in `listCourses` (`:684-708`) or `searchElements` (`:794-822`); no unit test |
| F6 — "names and IDs" prompt wording | **Unfixed** | `apps/chat/src/services/manageAssistantRuntime.ts:14` |
| F7 — chat lost on drawer close/navigation | **Unfixed** | `CourseChatDrawer.tsx:194` (`{open && …}` unmount) |
| F8 — no post-submission answer context | **Unfixed** | `packages/types/src/chatContext.ts` (no `studentResponse`/`evaluation`) |
| F2/F4 — MCP dup ~450 LOC / bootstrap-hook dup | **Unfixed** (follow-up, non-blocking) | both apps' `tool*.ts`; `usePwaEmbedTokenBootstrap.ts` |
| F9 — proposal-tool routing | **Fixed** | `manageAssistantRuntime.ts:16` |

### New findings

| # | Sev | Finding | Evidence | Fix |
| --- | --- | --- | --- | --- |
| N1 | High | **Manage assistant unreachable in stg AND prd.** `NEXT_PUBLIC_MANAGE_ASSISTANT_ENABLED` is a build-time Next.js var, absent from both `.env.stg` and `.env.prd` (the files swapped into `.env.production` by the frontend-manage docker workflows). `.env.stg` also lacks `NEXT_PUBLIC_CHAT_URL`, so the widget URL resolves to `null` there regardless. Merging changes nothing user-visible. | `apps/frontend-manage/.env.stg`, `.env.prd`, `Dockerfile:41`, `manageAssistantConfig.ts:6-13` | Add the flag (+ `NEXT_PUBLIC_CHAT_URL` to stg) when rolling out, staging first. This is the de-facto kill switch — keep it unset until ready. |
| N2 | High | **The red Y-chat CI failures are this branch's own regression.** `apps/chat/src/components/thread.tsx` (a) changed welcome copy to `Ask {chatbotName}` while the spec expects 'How can I help you' (`:353`), and (b) moved `data-cy="chat-assistant-message-content"` onto the avatar-only wrapper (`:1270`) instead of the text div wrapping `MessagePrimitive.Unstable_PartsGrouped` — so text assertions on that testid always time out. | `apps/chat/src/components/thread.tsx:353,1270`; `playwright/tests/Y-chat.spec.ts:340,411,527` | Move the `data-cy` to the text div; reconcile welcome copy with the spec. Clears `test-playwright-status`. |
| N3 | High | **Every mcp-student auth failure returns HTTP 500, not 401.** Its error messages (`'MCP token must identify a participant'`, generic `'Invalid token'`) miss the transport's case-sensitive 401-classification substrings (`Authentication`/`Invalid JWT`/`Token`/`Unauthorized`); mcp-lecturer's `Authentication failed:` prefix matches. With 5-min JWTs this fires routinely and pollutes 5xx alerting. | `apps/mcp-student/src/auth.ts:40`; contrast `apps/mcp-lecturer/src/auth.ts:53-71` | Prefix all mcp-student auth throws with `Authentication failed:`. |
| N4 | Med | **Manage chat route streams raw upstream error text to the lecturer** (no `onError` sanitizer, unlike the student route) and never falls back to the `fallback:true` model; `OPENAI_API_KEY` silently defaults to the literal `'no-key'`. | `apps/chat/src/app/api/manage/chat/route.ts:63,119`; `manageAssistantRuntime.ts:35-44` | Add the student route's `onError` sanitizer + a model fallback on call failure. |
| N5 | Med | **No timeout below the SDK 60 s default and no real cancellation on MCP calls.** A hung MCP server stalls every manage turn / tutor lookup for up to a minute; `timeoutMs` races but does not abort the underlying GraphQL request (orphaned in-flight work under backend slowness). | `apps/chat/src/services/lecturerMcp.ts:41-64`, `studentPracticeMcp.ts:222-256`; `apps/mcp-student/src/graphqlClient.ts:59-78` | Short (5–8 s) `AbortSignal.timeout()` tied to `req.signal`; thread an `AbortController` through the GraphQL client. |
| N6 | Med | **Ops hygiene**: mcp-student Dockerfile uses shell-form `CMD` (SIGTERM not forwarded; lecturer uses exec form) — in-flight tool calls cut on rolling deploys. No graceful-shutdown handler in either server. mcp-student error sanitizer falls through to `default: return message` (leaky-by-default) unlike lecturer's allowlist. | `apps/mcp-student/Dockerfile:58`; `apps/*/src/index.ts`; `apps/mcp-student/src/toolErrors.ts:93-116` | Exec-form CMD; `SIGTERM`→`server.stop()`; exhaustive error switch. |
| N7 | Low-Med | **`frame-ancestors` CSP fails open** when `ALLOWED_FRAME_ANCESTORS` is empty (header omitted → any origin can frame). Currently populated in stg/prd values, so not live-exploitable. Confirmed Greptile P1: proposals-confirm route silently falls back to `http://localhost:3000/api/graphql` when `APP_ORIGIN_API` unset. | `apps/chat/src/middleware.ts:11-20`; `apps/chat/src/app/api/manage/proposals/confirm/route.ts:19` | Default to `frame-ancestors 'self'` when empty; fail-fast on missing `APP_ORIGIN_API`. |

**Mitigating facts (verified):** both MCP servers are cluster-internal only (`ClusterIP`, no ingress) — meaningfully reduces the no-rate-limiting exposure; the MCP-configmap env-var cross-check is otherwise complete; chat degrades gracefully (empty toolset, no crash) when an MCP server is down; `imagePullPolicy: Always` matches repo-wide convention (not a regression).

## 3. UX

| Sev | Surface | Finding | Evidence |
| --- | --- | --- | --- |
| High | Chat (all embeds) | **Entire chat UI is hardcoded English**, including the consent disclaimer. `useTranslations` appears in zero files under `apps/chat/src` despite `NextIntlClientProvider` being wired. German users get a mono-lingual assistant. | `apps/chat/src/components/{assistant,disclaimer-modal,manage-proposal-card,tool-fallback,thread}.tsx` |
| High | Chat embed / recovery | **No-login recovery link doesn't escape the iframe.** The promised recovery path renders a plain `Link` with no `target="_top"`, so auth failure inside the drawer sends the user into a full OIDC flow inside the small iframe. | `apps/chat/src/app/noLogin/page.tsx:85-92` |
| Med | Both drawers | No focus trap / modal behavior (`role="dialog"` only, background stays interactive); no loading or error state while the iframe loads (blank box if chat is down). | `CourseChatDrawer.tsx:194-205`; `ManageAssistantWidget.tsx:166-213` |
| Med | Student drawer | Chatbot-list query swallows errors — a backend blip is indistinguishable from "course has no chatbot". F7 & F8 unaddressed. | `CourseChatDrawer.tsx:52-56,155` |
| Med | Manage assistant | Proposal "Preview" dumps raw JSON (`basePoints`, `pointsMultiplier`) at non-technical lecturers; no link to the created draft after confirm. | `manage-proposal-card.tsx:84,186-209` |
| Med | Chat (both) | Token expiry mid-conversation shows a raw, untranslated error with no re-auth action. | `apps/chat/src/hooks/useChatResponse.ts:196-229` |
| Low-Med | Manage assistant | F9 only partially closed — system prompt/skill steer to the proposal tool, but the draft-only tool `description`s still don't cross-reference it. | `apps/mcp-lecturer/src/server.ts:170-205` |
| Low | All | New surfaces hand-roll Tailwind buttons/cards instead of `@uzh-bf/design-system` primitives used elsewhere in the same apps. | `CourseChatDrawer.tsx`, `ManageAssistantWidget.tsx`, `manage-proposal-card.tsx` |

**Genuinely good:** responsive bottom-sheet/popover pattern reused consistently across both apps (with safe-area handling); robust `postMessage`-with-ack context handshake (300/1000/2500 ms retries); signed-proposal confirm flow with proper `aria-live` states; clean flag-off behavior (renders `null`, no dead button).

## 4. Bot-review reconciliation (21 unresolved current threads)

- **Confirmed real:** Greptile P1 (localhost GraphQL fallback, N7); Codex P2 (`store:false` hardcoded at `manageAssistantRuntime.ts:50` while stg/prd set `chat.openai.storeResponses:true` — consistent with the stateless decision but silently ignores deployed config, and that decision is unrecorded); CodeRabbit dialog-a11y; `de.ts` untranslated `Assistant` CTA.
- **Refuted:** CodeRabbit's only "Critical" — `pnpm run build --filter=@klicker-uzh/mcp-lecturer` in the Dockerfiles forwards `--filter` to turbo (root `build` script is `turbo run build`, which supports it); green image builds corroborate.

## 5. Recommended order

1. **Fix N2 (Y-chat)** — `data-cy` move + welcome-copy/spec reconciliation. Clears the CI gate.
2. **Apply prior F1/F3/F5/F6 verbatim** (the 2026-07-07 doc contains exact junior-executable fixes) + N3 (`Authentication failed:` prefix), N6 (exec-form CMD, exhaustive error switch, SIGTERM handler).
3. **N4/N5/N7** — `onError` sanitizer + model fallback on the manage route; short `AbortSignal` timeouts on MCP calls; fail-closed CSP default; fail-fast on missing `APP_ORIGIN_API`/`OPENAI_API_KEY`.
4. **U1 + noLogin iframe escape** — i18n pass over `apps/chat`; `target="_top"`/parent-postMessage on the recovery link. Before any broad rollout.
5. **When intending to roll out (N1):** add `NEXT_PUBLIC_MANAGE_ASSISTANT_ENABLED=true` + `NEXT_PUBLIC_CHAT_URL` to the env files, staging first. Until then it is the kill switch.
6. **Record the decisions and cuts:** ADRs for Prisma-direct RBAC and ephemeral threads; refresh plan Progress sections; ticket the scope cuts (missing quiz/edit tools, §10.3 feedback loop) and F2/F4/F7/F8.

Items 1–3 are merge-blockers for a working feature; 4 is a pre-broad-rollout gate; 5–6 are rollout gating and hygiene.
