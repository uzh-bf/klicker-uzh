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

### Compatibility follow-up authorized on 2026-09-06

Source review is complete at `488fc4126da469e1558a2c3e40cedd676cc1afe7`: the same final reviewer returns `DONE` with no remaining findings across the complete package, reusing unchanged evidence and reviewing the bounded mode correction. Final managed shutdown succeeds; the exact container reports `exited` and the workspace has zero routes. All predecessor findings are resolved. The reviewed branch is published and the existing PR description is refreshed. Exact-head CI and final AI review remain pending before PR-ready. Merge, deployment, and live activation remain withheld.

#### Historical execution checkpoints on 2026-09-06

The following checkpoints precede the completed source review, shutdown, and publication recorded above. Their pending statements describe those earlier checkpoints, not the current state.

The user approved proceeding after the Devrouter update. The remaining source correction aligns capture, the review mode list, and approval with canonical standard-mode settings. Main owns this coupled validation change and its two focused database regressions. The same final reviewer will assess the bounded correction after verification; the prior pass's medium finding is recorded in `project/_local/reviews/2026-09-06-response-example-capture-correction-final.md`. Publication remains authorized only to the existing [capture PR](https://github.com/uzh-bf/klicker-uzh/pull/5764). No additional upstream integration, merge, deployment, or live activation is authorized.

Fresh remote evidence: local `04faab8ed3` is 40 commits ahead of its tracking branch and 160 ahead/4 behind default `origin/v3`; the PR remains open against `v3-ai` at published head `d0bdd054b4`. The managed stop no longer reports a Compose hash mismatch. It leaves the exact primary container exited and zero workspace routes, but Devsy returns exit status 1. The normal route-free `email` profile resume subsequently succeeds without recreation or drift. No application process or route is started.

The disabled-mode regression reproduces an incorrectly accepted capture before the correction. The first null-prompts attempt times out in fixture initialization, so that attempt is not evidence of its intended failure. After the correction, all 25 tests across the response-example database, authorization, and transition suites pass in 5.08 seconds, including both new regressions. The shared projection uses the existing standard-mode normalizer for all three flags; custom-mode extraction is unchanged. Existing approval coverage now disables Tutor through typed settings. Redis DNS warnings are unchanged under the route-free profile and do not prevent the passing run. Prior browser evidence is reused because no browser interaction or layout changes in this correction.

Type checking initially encounters an OOM kill under shared Docker VM memory pressure. After an interruption, the previous container is absent; the normal managed resume restores workspace `feat-chatbot-response-example-ca` with container `c2a857ffe9e702f487bd65b73f0e52ff92314f254870e3804922c378db850016`, Compose project `default-fe-cc1d0`, and no drift or routes. The bounded type check then identifies missing nullable fields in test fixtures. Adding explicit nulls preserves the normalization exercised by the passing database run. GraphQL `check:ts` passes with command-local `NODE_OPTIONS=--max-old-space-size=2048`; three-file Biome, plan Prettier, and diff checks also pass. No repository memory setting changes. Final runtime release, the same-reviewer follow-up, and publication remain pending.

### Follow-up authorized on 2026-09-05

- The pinned integration and compatibility corrections are committed at `04faab8ed3a2055446096a5102c49567260e3c3b`. The same final reviewer is running its single correction pass over all 44 feature paths against `5c8ee4b6a034c22da8e85159214c629f371d0f3d`. Runtime release is blocked: managed stop, including the original blob-port setting, returns `Managed Compose configuration changed for service 'app'.` Fresh inspection still finds the exact task container running and 11 routes. The installed manager rejects a recorded-versus-current Compose hash mismatch; no raw Docker mutation, configuration rewrite, or runtime deletion was attempted. Source verification passes, but shutdown and review/publication are not complete.
- The unchanged-source Chromium retry passes both scenarios in 23.8 seconds: first-answer capture/review link and persisted review/edit with stale-draft preservation. The previous run reached preview compilation without a terminal page error; the retry resolves the observed navigation failure, but does not establish its root cause. The 145 Chat, 23 GraphQL, five util tests and four package type checks below remain valid. Capture transport is mocked in the browser; database tests separately prove persistence. Finish the pinned integration commit and same-reviewer correction before publishing. The reviewer must also assess legacy mode-key extraction in capture/review against the newly integrated standard-mode settings; do not silently broaden the mode contract.
- Latest integrated verification: 145 focused Chat tests, 23 GraphQL database tests, five util receipt tests, Chat/GraphQL/Manage/Playwright type checks, and changed-Chat Biome checks pass. GraphQL tests emitted Redis DNS warnings under the route-free profile but completed successfully. The isolated schema sync and eight-task dependency build pass. Chromium review/edit passes; capture times out during initial preview navigation before capture assertions. The diagnostic log read and its allowed retry both fail before execution because the automatic approval service times out. The approved integration and compatibility edits remain uncommitted; no push or correction review has run. Resume the bounded preview-startup diagnosis, then finish browser proof, shutdown, commit, and same-reviewer correction before publication.
- The user approved one additional integration of `v3-ai@5c8ee4b6a034c22da8e85159214c629f371d0f3d`, preview compatibility corrections, verification, and publication to the existing PR. The merge has no textual conflicts. Preview now reads the typed standard-mode configuration for its initial mode options, route eligibility, and prompt compilation. Main owns this small, coupled correction and its focused verification; the existing final reviewer owns the correction pass. No further integration, PR merge, deployment, or activation is authorized.
- Integrated final review at `a672f81757` returned three findings: exact-one-live-KB receipt eligibility, redundant capture-phase identity tests, and a semantic interaction with newer target standard-mode settings. The first two are corrected independently; 24 focused Chat tests, Chat type checking, and changed-file Biome checks pass. The third is also present in the newer target's preview route; adapting to that contract requires approval for one additional integration of `v3-ai@5c8ee4b6a034c22da8e85159214c629f371d0f3d`. Publication is paused until the complete correction set is verified and the same reviewer completes its correction pass. No PR merge, deployment, or activation is authorized.
- Runtime shutdown is verified: the exact-workspace stop returned success, its route count is zero, and the owned primary container reports `exited`. Integrated final review and publication remain pending. The following entries preserve the verification sequence; later passing evidence supersedes the earlier startup failures.
- Focused verification is complete: GraphQL and Manage type checks, Playwright type checking, changed-Chat Biome checks, and browser-spec/solution-note Prettier checks pass. The first GraphQL type-check attempt was killed with exit 137 while all apps ran; the container recorded OOM kills. It passes after switching to the route-free capability profile. Runtime shutdown and integrated review are next. The shared-build diagnosis required no build-source changes.
- Browser verification now passes both Chromium scenarios (44.5s) through the canonical host launcher: first-answer capture and review link; seeded source-aware review/edit/approve with stale-draft preservation. The starter interaction establishes a working composer before editing and sending. Capture transport remains mocked in that scenario; separate database-backed tests prove candidate persistence, concurrent replay, unchanged approved rows, stale-evidence rejection, and transaction rollback. All 23 focused GraphQL tests and five receipt-contract tests pass. The first database run encountered browser-seed residue; its normal cleanup restored the required empty baseline before the passing rerun.
- Subsequent verification: isolated GraphQL `build:ts` exits 0 and reports 71 seconds, with compiler warnings; the dependency-inclusive prebuild exceeds its 240-second bound. Two full-profile browser starts fail before tests when Auth's 90-second readiness deadline interrupts GraphQL compilation, then roll back to the route-free `email` profile. The environment-matched prebuild subsequently passes: eight successful tasks, seven cached, 1m47s. It sources only the inspected environment-initialization prefix (lines 1-98) of `.devcontainer/post-start.sh` before running the bounded GraphQL Turbo build through `devrouter exec`. No readiness timeout or build-source setting was changed. The next canonical host-launcher retry is waiting for the shared provider lock.
- Published-head CI inspection still finds head `d0bdd054b46d8f20df636a76adbf0eca43eb2e51` on PR #5764. Its browser shard failure is the account-usage feature-flag visibility test, not the response-example scenario. This does not prove that either failure is resolved on the unpublished local head. Final review and publication remain pending.
- Current recovery evidence: the user-approved runtime deletion completed, and recreation with the route-free `email` profile and command-local `KB_GRAPH_BLOB_HOST_PORT=10004` succeeded. The new Compose project is `default-fe-cc1d0`. Isolated `timeout 30s pnpm --filter @klicker-uzh/grading build` and the equivalent knowledge-graph build both exit 0 (bundle times 13.7s and 10.9s). The old hang is not reproducible in this recreated runtime; no speculative build-source fix is warranted. Browser verification is resuming. The user also authorized bounded shared-build repair if reproduction establishes a need.
- The user authorized one fresh `v3-ai` integration, conflict resolution, implementation review and simplification, and end-to-end testing. Publication to the existing feature branch remains covered by the approved delivery contract; merge of the PR, deployment, and live activation remain withheld.
- Route: main for conflict resolution and verification because the work shares one runtime and working tree; native simplifier for the immutable implementation; final reviewer after verification. Acceptance: generated schema, Helm validation, focused Chat/GraphQL/util checks, browser capture and review flow, and reviewed committed outcome.
- Integrated `v3-ai@de2c5eb449940b25c373d17bbaa2976dcca98eee` in `03f733f0e4`. Both additive conflicts preserve receipt configuration and the new beta-enrollment configuration/schema. GraphQL generation, Helm lint, staged secret scanning, and diff checks pass. No feature migration is introduced.
- Simplifier: done — `project/_local/reviews/2026-09-05-capture-simplification.md`. Removed unused browser expiry metadata; JWT expiry remains authoritative. Six focused Chat suites pass 102 tests; Chat type checking passes.
- Browser failure resolved in the test: interact with a starter and assert its populated composer before editing and sending. Production composer behavior is unchanged. The capture browser fixture mocks the preview stream and capture endpoint, so it is not proof of live source retrieval or production activation.
- Full container `check:all` fails in the unrelated analytics environment while building pandas 2.2.2 without a compiler; its cancellation interrupts remaining broad checks. Targeted verification continues. Git hooks are run through their container equivalents, with host Git retained for commits.
- Remaining: complete integrated final review, publish the updated branch, and settle CI. No readiness claim yet.
- Resume checkpoint: permission-approved browser startup fails before tests because Devsy cannot retrieve `node:24.16.0-bookworm-slim` from Docker Hub (`connect: bad file descriptor`). Exact-workspace status reports missing primary container and services, with stale routes. The composer test change is still diagnostic, not a verified fix. The resumed branch is 29 commits ahead of its tracking branch, 151 ahead/2 behind remote default `v3`, and 16 ahead/7 behind target `v3-ai`; no second integration is authorized or performed. Final review and publication remain pending.
- One startup retry was cancelled after over ten minutes queued behind another live workspace operation; only this task's exact retry process was terminated. Browser assertions now check nonempty accessibility labels, visible feedback, approval availability, and persisted status/question instead of UI wording. These test edits remain unverified while runtime startup is blocked. `git diff --check` passes; no new commit or push in this resume.

- Latest runtime evidence: the queued stop completed and freed all 11 routes. Host Docker Hub connectivity succeeds. Fresh startup then exposed an Azurite collision on port 10003; the supported command-local `KB_GRAPH_BLOB_HOST_PORT=10004` override clears that collision without altering another workspace. Container initialization succeeds, but both readiness passes fail before Auth listens. `/tmp/dev.log` and process inspection show `grading` and `knowledge-graph` Rollup builds reporting output completion yet remaining alive for over five minutes, preventing downstream startup. No browser tests ran on this resume. Shared build repair is the next proposed scope extension; do not force successful process exits or claim readiness.

### Earlier implementation checkpoint (superseded by the follow-up above)

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
