# Chatbot Response-Example Capture (K5) — PR #5764 Execution Plan

Date: 2026-09-03 (revised after planner hardening, 12 findings incorporated)
Status: APPROVED — execution active
Pull request: https://github.com/uzh-bf/klicker-uzh/pull/5764
Roadmap: project/2026-08-28-chatbot-test-and-teach-ground-truth-plan.md (package K5)
Execution owner: this Codex session. Terminal condition: PR-ready. Merge, deployment, and live activation remain user decisions.

## Goal

A lecturer testing their own chatbot in owner preview can save the first answer as a reviewable response-example candidate in one click. The candidate carries its citation lineage, lands in the existing Manage review inbox as CANDIDATE, and is corrected and approved there with the existing source-aware editor. Capture never publishes anything and never changes what the live chatbot says.

## Scope

In scope:

1. A discardable transport prototype proving the receipt data-part lifecycle.
2. A signed preview-turn receipt issued by the owner-preview chat route at answer completion.
3. A thin REST capture route plus one canonical GraphQL mutation that verifies and persists.
4. A first-turn-only capture action with explicit unavailable, pending, duplicate, stale, expired, and failure states, plus "Start a new preview".
5. Owner-preview parity for the response-example skill (included role, same as participant chat since K6).
6. Manage deep link confirmation and the docs update. No new Manage components.

Out of scope (unchanged from the roadmap): live-chat runtime serving behavior, ground truth from KB/KG (W8-gated), seeding/evaluation tooling, participant chats, multi-turn capture (future schema change).

## Authority boundaries

- Phase A gate: implementation starts only after PR #5633 (owner preview) merges into v3-ai.
- Phase B gate: the production capture path (receipt claims, capture mutation) is built and unit-tested with synthetic lineage, and may go PR-ready, but the capture action only functions fully once the Doc Query lineage contract (roadmap package U0, separate repository) is merged, and its live proof additionally requires U0 deployed. The roadmap fixes this two-stage dependency; this plan inherits it verbatim.
- Branch: feat/chatbot-response-example-capture from fresh origin/v3-ai after the Phase A gate; this plan and the pending roadmap Progress edit ride the branch as the first commits.
- v3-ai is a consolidation branch, not a stack train; the eventual v3-ai to v3 promotion is separate.
- Authorized terminal steps: push to origin on the named branch and open a draft PR with the v3-ai exact-head final-ai-review status green. Merge/deploy/live remain user decisions. Zero database migrations; the Prisma schema and migrations diff must be empty.

## Current state (verified 2026-09-03, values-free)

- K1/K2 (foundation, review UI) and K6 (included-run skill) are merged into v3-ai.
- PR #5633 (owner preview) merged into v3-ai at `7249e57eb7b95cff83cf13ae7a1849d0045841e7`, clearing the Phase A gate.
- U0 (Doc Query lineage, separate repo, branch feat/response-example-lineage) is not merged; current preview citations do not yet carry canonical source id, chunk id, content hash, and anchor. Nothing may infer lineage from display metadata.
- Verified seams: preview route (owner-scoped, base model, finish metadata), ownerPreviewAuth (scope-checked owner auth), docQueryScopeToken (repo JOSE pattern: ES256, env kid/iss/aud, jti, short TTL), chat-ui-context variant "owner-preview" with showMessageActions false, thread.tsx as the UI insertion point, responseExampleContract (unique set/mode/question, CANDIDATE flow, eligibility loaders), ChatbotResponseExampleReview + dynamic Manage route pages/resources/chatbots/[chatbotId].tsx.

## Design

1. Transport prototype first. Before committing to the token transport, a discardable prototype proves four properties on the real preview stack: the receipt data part survives on the assistant message; a later action can read it; the route drops it before messages reach the model; a refresh removes it. If any property fails, K5 pauses and documents one alternative transport before continuing.
2. Receipt issuance. When a preview exchange finishes, the route issues a receipt only for a completed first exchange: the request history contains exactly one prior user message, the answer is non-empty, and the cited sources carry complete canonical lineage. Otherwise no receipt is issued — first-turn eligibility is enforced server-side, not by UI placement. The receipt is a JOSE token (ES256, dedicated issuer, audience, purpose, and claim-set version, kid-selected public key, short TTL) whose claims carry user, chatbot, KB id, mode, question hash, answer hash, and the citation lineage (index, source id, chunk id, content hash, anchor). Strict bounds: citation count cap, claim size caps, values-free failure logging. It travels as a custom data part and is stripped from every subsequent model request.
3. Capture path. The REST route POST /api/manage/chatbots/[chatbotId]/preview/capture stays thin: owner re-authentication via the existing owner-preview auth, request bounds, forwarding. One named canonical GraphQL mutation then performs strict receipt verification (signature, alg allowlist, issuer, audience, purpose, version, expiry, user/chatbot binding, hashes match the submitted raw texts), re-runs the existing current-eligibility checks (chatbot-KB binding, resource membership, active hashes) inside the transaction, and persists: lock or safely upsert the set, create the CANDIDATE example with its evidence references, refresh the set digest — all in one transaction. A uniqueness race returns the existing row unchanged. A stale-evidence check returns a coded conflict without refetching source bodies. The initial response approach follows the roadmap's deterministic map: tutor to Guided questions, explainer to Step-by-step explanation, every other mode to Concise answer.
4. Capture action. In owner preview only, the first completed answer shows "Save as response example" when a receipt is present; later turns never do. Success shows a toast with "Review now", deep-linking to the chatbot details page focused on the new candidate. Unavailable, pending, duplicate, stale, expired, and failure states have explicit UI. "Start a new preview" resets the conversation so each example starts from a fresh first turn. A refresh removes the receipt; nothing is persisted client-side.
5. Owner-preview skill parity. The preview route composes the same included-role response-example skill the participant chat uses since K6, with the same degradation behavior (loading failure continues without examples) and the same zero-persistence guarantee (the route never writes threads or messages).
6. Manage review. No new components. Captured CANDIDATEs render in the existing review inbox with evidence lineage and the Slate editor; docs/chat-platform.md is updated in the same PR per repo policy.

## Slices, dependencies, acceptance checks

S0 — Transport prototype (discardable). Depends on: Phase A gate. Accept: the four lifecycle properties demonstrated on the running local stack, documented in the plan Progress; prototype code removed or hardened into S1.

S1 — Receipt issuance in the preview route. Depends on: S0. Security boundary (token integrity, privacy); slice-reviewer required. Accept: unit tests for issue/no-issue conditions (first turn, completed, source-grounded, lineage complete), claim contents and bounds, tamper/wrong-audience/expired rejection, and a provider-input leakage test proving the receipt never reaches the model request.

S2 — Capture route + canonical GraphQL mutation. Depends on: S1. Security + data-integrity boundary; slice-reviewer required. Accept: unit tests for owner-session enforcement, receipt verification negatives, hash mismatch, eligibility staleness conflict, concurrent-replay idempotency (one row, existing returned unchanged), rollback on partial failure, status invariance (capture never modifies an existing approved example), digest stability, deterministic style mapping, and coded errors throughout.

S3 — Capture action UI + Start a new preview + toast deep link. Depends on: S1, S2. Assigned to one executor; main verifies. Accept: component tests for first-turn-only gating and all six UI states; browser verification on the local stack capturing the changed states with screenshots and accessibility checks (action reachable and labelled).

S4 — Owner-preview skill parity. Depends on: Phase A gate only; can run parallel to S1. Accept: unit tests for included-role composition, degradation without examples, and zero-persistence assertions.

S5 — Manage confirmation + docs. Depends on: S2. Accept: manual browser check that a captured CANDIDATE renders with lineage and the approve/edit/reject flow works; docs/chat-platform.md updated; no component changes unless a real gap appears.

Integration — main session. Depends on: S1-S5. Accept: empty Prisma/migrations diff, focused repo checks (type check, graphql package tests, chat unit suites, lint), then final review.

## Delegation map

- Main session: S0, S1, S2 (security-critical), S5 verification, integration, final proof.
- One executor: S3 (capture UI) with the acceptance checks above.
- Main session verifies every delegated result before accepting.

## Review gates

- S1 and S2: one slice-reviewer pass each (authorization, token integrity, data integrity).
- Simplifier on the committed implementation range.
- One final-reviewer pass after integration; exact-head CI and the v3-ai final-ai-review commit status green before PR-ready.

## Verification strategy

Unit suites cover all receipt, endpoint, and transaction logic without a running app. Browser verification (S3, S5) runs chat and manage locally via the existing devrouter setup and captures only changed states. Test data is synthetic only; no real user content in tests or fixtures.

## Sequencing and artifact handling

After PR #5633 merges and is fetched: revalidate merged seams, create the fresh non-stacked branch, move the modified roadmap file and this plan into the new worktree, commit the roadmap Progress update and the reviewed plan first, then implement slices in dependency order with a commit per slice.

## Progress

- Current status: S0-S5, the approved one-time `origin/v3-ai` integration, and integrated final review are complete. Draft PR #5764 targets `v3-ai`; exact-head CI and final AI review are pending. The exact target `ecf12398dc` was merged at `9844387186`; the final-review correction is committed at `6ec99227f`.
- [x] Gate: PR #5633 (owner preview) merged into `v3-ai` at `7249e57eb7`.
- [x] Branch cut from `origin/v3-ai@7249e57eb7`; roadmap Progress and this plan are the first commit.
- [x] S0 transport prototype: the receipt data part survives on the completed assistant message, the later action can read it, model-input conversion drops data parts, and refresh has no client persistence to restore.
- [x] S1 receipt issuance: dedicated ES256 receipt, strict claim bounds, ten-minute expiry, first-exchange and complete-lineage gates, and tamper/audience/expiry tests. The security review found no blocking issue.
- [x] S2 capture route and mutation: owner lock, receipt revalidation, one enabled knowledge base and mode, current source-hash checks, transactional candidate creation, idempotent duplicate handling, and digest refresh. The security review found no issue; the simplifier findings were dispositioned without weakening the canonical server boundary.
- [x] S3 capture UI: explicit available, unavailable, pending, created, duplicate, stale, expired, and failure states plus fresh-preview recovery. The simplifier removed redundant client validation and first-answer scanning while retaining the server-issued boundary. Agent-browser verified the accessible capture action, exact synthetic question/answer/receipt POST, success confirmation, and Review now link.
- [x] S4 preview skill parity: the included response-example skill is composed for owner preview with graceful load failure and no conversation persistence. The simplifier's dead guard was removed.
- [x] S5 Manage confirmation and docs: the canonical query-based review link opens Advanced settings, scrolls and focuses the candidate, exposes eligible source lineage, and leaves Approve, Edit and approve, and Reject enabled. Agent-browser verified the synthetic local flow and screenshots; Chat, Manage, Playwright type checks and 35 focused Chat tests pass. The Playwright scenario is present for hosted execution because this host has no installed Playwright Chromium.
- [x] Integration checks: 100 focused Chat tests, 12 util tests, 22 GraphQL tests, changed-package type/schema checks, and focused Chat/Manage lint pass. The repository-wide `check:all` run reached an unrelated analytics environment failure because pandas 2.2.2 had no wheel for the container-selected Python 3.14 and the image has no C compiler; no changed package failed its focused check.
- [x] Final review: the configured final-reviewer route failed before review because its encrypted task payload was unreadable by the routed provider. Native GPT-5.6 Sol at xhigh effort completed the continuity fallback and found one medium UX gap: missing lineage or signing configuration suppressed the unavailable state. Commit `6ec99227f` now emits a values-free unavailable data part for eligible first answers; 29 focused Chat tests, the Chat package check, Biome, and `git diff --check` pass. The same reviewer returned `DONE` on the correction range with no remaining finding. The gitignored report is `project/_local/reviews/2026-09-04-chatbot-response-example-capture-final.md`.
- [ ] PR ready (terminal)
- Next action: push this PR-bound plan rename, update the draft description, and monitor exact-head CI and final AI review to the terminal condition.
