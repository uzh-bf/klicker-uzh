# PR #5633 — Chatbot Owner Preview Implementation Plan

## Goal

Give chatbot owners a lecturer-only preview of their chatbot in the chat app: authenticated by their Manage session, authorized by chatbot ownership, stateless server-side, and visually faithful to the participant experience (modes, streaming answers, citations). This is the Test & Teach groundwork; candidate capture is explicitly out of scope and stays parked pending the evidence-lineage ruling (see planner report 2026-08-27-test-teach-planning.md).

**Non-goals:** no participant-data access or reuse; no message/thread persistence server-side (no ChatThread rows — the model requires a Participant); no changes to the participant chat route's behavior; no response-example writes; no runtime skill activation; no knowledge-graph or RAG seam changes.

Provider response-item storage follows the existing chat platform policy because multi-step retrieval may reference prior tool-call items. “Stateless” means that KlickerUZH creates no preview thread or message records and exposes no saved preview history.

## Execution contract

- **Authority (granted):** worktree/branch `trees/chatbot-owner-preview` on `rs/chatbot-owner-preview` (base `origin/v3-ai` at ff97214be); in-scope edits; repo-native checks in the DevPod/devrouter runtime; local commits. **Withheld:** push, PR publication, merge, deployment, staging/production changes, and any live-cluster action — each requires separate authorization. `preview-local` route startup on devrouter is authorized for verification.
- **Terminal condition:** all slices committed on the package branch, full focused verification green, integrated final review passed, browser evidence captured (EN/DE desktop, plus negative participant probe), Progress final. Stops before any external action.
- **Boundary owner:** self (re-enters roadmap Phase 5 for Test & Teach when the capture ruling lands).
- **Pause conditions:** participant route refactor turns out unavoidable; MCP tool wiring cannot be reused without behavior changes; runtime unavailable after recovery attempts.

## Plan identity

- Plan: `project/2026-08-27-pr-5633-chatbot-owner-preview-plan.md` (this file, first committed on the branch under its pre-PR filename)
- Branch: `rs/chatbot-owner-preview` · Target: `v3-ai` · PR: [#5633](https://github.com/uzh-bf/klicker-uzh/pull/5633) (draft)
- History: `project/2026-08-21-chatbot-response-example-design.md` (roadmap), `project/2026-08-26-pr-5474-response-example-review-corrections-plan.md` (Test & Teach boundary), `project/_local/reviews/2026-08-27-test-teach-planning.md` (planner findings; gitignored, local)

## Research summary (verified seams)

- Manage-session auth exists in the chat app: `getAuthenticatedManageUser` (apps/chat/src/lib/server/manageAuth.ts) verifies the lecturer JWT cookie, exposes role USER/ADMIN, `UserLoginScope`, Catalyst flag. Participant and manage sessions are distinct cookies; participant tokens never satisfy the manage check.
- The `/manage` assistant page (apps/chat/src/app/manage/page.tsx) is the in-repo pattern for a manage-session-gated chat surface; the manage-assistant API route shows the auth+rate-limit+timeout pattern for server routes.
- The participant chat route (apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts, ~2,000 lines) authenticates participants via `withChatbotAuth` and owns persistence, credits, attachments, and error classification. Ownership of threads requires a Participant row (ChatThread, chat.prisma ~L111) — confirming the planner's no-persistence decision for preview.
- Reusable services for a lean preview path: `mcpClients`/`mcpScope` (doc_query tools), `systemPromptCompiler`, `citationInstructions`, chat model registry/config, `useMessageSources`/`normalizeSources` (citation rendering), `RuntimeProvider` (mode metadata). No canonical chunk lineage is produced in-repo; preview therefore never claims evidence eligibility.
- Planner findings accepted: owner surface in apps/chat beside the assistant action bar; postMessage/origin checks never confer authority; all authorization server-side; explicit responseStyle only matters later (capture) and is out of scope here.

## Primitive impact

| Primitive | Disposition | Notes |
| --- | --- | --- |
| Chat runtime (participant) | reuse, untouched | Preview composes the same services; participant route is read-only for this package |
| Owner resources (chatbots) | extend | Manage gains an owner-preview entry point (link/button on chatbot detail) |
| Lecturer preview surface | create | New owner-scoped, stateless preview route + page in apps/chat |

No public participant-facing contract changes. No API contract outside the new owner-preview endpoint.

## ADR gate

No ADR: the preview is a scoped internal surface with no reversal cost and no semantic change to examples or approval. Re-arm the ADR gate if capture is added (evidence provenance), preview state becomes persistent, or the participant runtime is refactored.

## Test portfolio

| Risk / behavior | Obligation | Seam | Slice |
| --- | --- | --- | --- |
| Only owners (scope FULL_ACCESS/ACCOUNT_OWNER) reach preview API/UI; participants and other lecturers fail closed | extend existing guard patterns with focused tests | owner-preview route unit tests | P1 |
| Preview never writes ChatThread/ChatMessage or participant data | add new | route test asserting zero DB writes (mock prisma) | P1 |
| Streaming answer + citation chips render as in participant chat | extend existing source normalization coverage | chat app component test | P2 |
| Manage entry point only for owner-usable chatbots; deep link lands on login gracefully when session expired | add new | manage component test + chat page SSR test | P3 |

## Delegation map

| Slice | Owner | Depends on | Acceptance boundary |
| --- | --- | --- | --- |
| P1 Owner-preview server seam (auth guard `withOwnerPreviewAuth`: manage session + ownership + scope; stateless preview chat route composing existing services) | executor (native) | — | Focused unit tests: owner pass, participant/non-owner/scope denials, zero-persistence assertion; route returns streamed response |
| P2 Preview UI page in chat app (`/preview/[chatbotId]`, manage-embed aware; mode selector; streaming thread; citations via existing sources components) | executor (native) | P1 | Component tests for action gating + citation rendering; lint/type green |
| P3 Manage entry point + i18n (EN/DE) on chatbot detail; URL builder mirroring buildChatbotUrl | executor (native) | P2 | Component test; translations complete; knip/syncpack green |
| P4 Integration, browser verification (EN/DE via devrouter `preview-local`), negative participant probe, final review dispatch | main | P1–P3 | Screenshots + probe evidence; final-reviewer report; Progress final |

Execution-tier note: P1–P3 are bounded, settled-behavior slices suited to the execution tier; the ownership guard design and the participant-route non-touch invariant stay main-session owned.

## Slices

### P1 — Owner-preview server seam

- **Do:** add `withOwnerPreviewAuth` (manage-session JWT via `getAuthenticatedManageUser` pattern + fresh `Chatbot.ownerId` lookup + scope check FULL_ACCESS/ACCOUNT_OWNER; admins satisfy by lattice) and a stateless `POST /api/manage/chatbots/[chatbotId]/preview/chat` route: validates bounded body (messages, chatMode), composes systemPromptCompiler + mcpClients (doc_query) + model registry for one streaming response; no DB writes; participant tokens/cookies never authorize.
- **Check:** focused vitest on the guard + route (owner pass; participant/non-owner/wrong-scope 401/403; prisma write mocks untouched; stream emits).
- **Commit:** `feat(chat): owner-preview auth and stateless preview route` (exact type re-checked at commit time).

### P2 — Preview UI page

- **Do:** `/preview/[chatbotId]` page (manage-embed aware via existing embed-param pattern): chat mode selector, streaming assistant answers, citation chips/sources via `useMessageSources` components, in-memory-only history; no ratings, credits, attachments, or thread sidebar.
- **Check:** component tests (UI hidden/denied states; citation rendering); `pnpm` lint+type for touched packages.
- **Commit:** `feat(chat): owner preview page`.

### P3 — Manage entry point + copy

- **Do:** “Open preview” action on chatbot detail (owner-visible), URL builder with manage embed params; EN/DE translations.
- **Check:** component test + i18n completeness check.
- **Commit:** `feat(manage): chatbot owner preview entry`.

### P4 — Verification and review

- **Do:** devrouter `preview-local` runtime; EN/DE desktop screenshots of preview + manage entry; negative probe (participant session cannot open preview URL); package checks; integrated final review (correctness, security, architecture lenses; code-bearing).
- **Check:** evidence in `project/_local/` + chat report; final review passed.

## Assumptions and open questions (non-blocking)

- Preview is not additionally gated by the AI-beta flag (chatbots are already a gated product area); flag in review if evidence contradicts.
- Stateless multi-turn: the client sends conversation history per request; nothing is stored server-side. If history-size limits bind, trim to the last N turns server-side.

## Progress

- Status: P1–P4 are complete in draft PR [#5633](https://github.com/uzh-bf/klicker-uzh/pull/5633). The approved one-time integration of `origin/v3-ai` is committed, and the combined owner-preview and Manage-assistant behavior passes local verification. The post-integration final review and PR publication refresh remain.
- Completed: research, planner review, P0 blocker ruling, P1 owner authorization and stateless preview route, P2 owner-preview page, P3 Manage entry point, both simplifier passes, both slice reviews, their corrections, the same-reviewer correction passes, and the P4 browser gate.
- Verification: the full Chat suite passes (83 files and 728 tests passed; 13 integration tests skipped by their existing environment gate). Chat and Manage type checks pass; package lint has no errors; repository formatting and `git diff --check` pass. The focused Manage access-scope assertion also passes through the installed TypeScript runner. Review corrections constrain preview tools to `doc_query`, add executable route coverage, disable attachment drops, preserve run-status announcements, keep the signed-out preview recoverable, and hide the Manage action from `READ_ONLY` and `SESSION_EXEC` scopes.
- Browser evidence: the exact namespaced runtime captured the owner-visible Manage entry point, authenticated English and German previews, and denial for a signed-in synthetic participant. The final preview and denial reloads produced no browser-console errors. Reviewable captures are in `project/screenshots/chatbot-owner-preview-*.png`. The local runtime has no upstream model key and the seeded chatbot has no enabled knowledge-base binding, so provider-backed answer generation is not local evidence; route and component tests cover the streaming and citation contracts.
- Runtime: local proof used the verified-free Azurite port `11003` and scoped `chat,manage` then `chat,pwa` profiles. The exact DevPod is stopped, and the worktree owns zero devrouter routes.
- Remaining boundary: run the post-integration final review, publish the merge and screenshot commits, refresh the PR description, mark the PR ready if the published head remains green, and collect exact-head CI evidence. Merge, deployment, staging/production mutation, and live activation remain withheld.
- Delivery: achieved layer is an integrated, locally verified draft PR package. The next package action is the final review and ready-for-review publication pass.
