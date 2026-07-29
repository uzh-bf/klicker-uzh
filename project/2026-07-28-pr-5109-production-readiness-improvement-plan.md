# PR #5109 — Production Readiness Improvement Plan

| Field | Value |
| --- | --- |
| Date | 2026-07-28 |
| Status | BLOCKED — S0-S4 complete locally; S5 automation prepared; live release and publication gates require authority |
| PR | [#5109](https://github.com/uzh-bf/klicker-uzh/pull/5109) |
| Remote branch | `codex/manage-assistant-mcp-v3-ai` → `v3-ai` |
| Local worktree | `.claude/worktrees/finalize-v3-ai-branch-0fa103` |
| Baseline | `60e1d5366fe257d8a9609d5df0e7efc54a73ecea` |

Parent artifacts:

- `project/2026-07-23-pr-5109-assistant-production-readiness-plan.md`
- `project/2026-07-26-pr-5109-verification-and-extension-plan.md`
- `project/2026-07-27-manage-assistant-followup-roadmap.md`
- `project/plans_wip/PLAN-external-mcp-oauth.md`
- `docs/auth-model.md`
- `docs/chat-platform.md`
- `docs/frontend-conventions.md`
- `docs/testing.md`
- `evaluation/manage-assistant/README.md`

This plan supersedes only the readiness disposition from the 2026-07-27
handoff. It does not replace the parent artifacts' implementation history,
accepted security model, eval thresholds, or extension decision gates.

## 1. Outcome

Close the defects and missing evidence found in the senior production-readiness
review, then make the branch honestly:

1. safe against oversized Manage-assistant requests;
2. compliant with the repository's modal-drawer accessibility contract on both
   lecturer and participant surfaces;
3. unable to report an E7 graceful-degradation pass from silence or an
   unvalidated raw HTTP error;
4. covered by automated PWA drawer and route-error tests;
5. live-verified with the configured judge, Firefox, WebKit, and a screen
   reader before production enablement; and
6. documented and reviewable from a current PR description.

The plan also records the next authentication and MCP-extension decisions
without pulling external OAuth or a larger tool surface into the readiness
repair.

## 2. Current Readiness Verdict

As reviewed at `60e1d5366`:

| ID | Severity | Finding | Current effect |
| --- | --- | --- | --- |
| R1 | P1 | `POST /api/manage/chat` parses an effectively unbounded authenticated JSON body. The schema caps messages at 50 but not serialized bytes or part sizes. The public chat ingress allows 256 MB while the production chat pod is limited to 200 MiB. | Production-release blocker |
| R2 | P1 | `CourseChatDrawer` has `role="dialog"` but lacks the repository-required launcher relationships, `aria-modal`, focus entry/trapping, portal, and inert/`aria-hidden` background isolation. | Production-release blocker |
| R3 | P2 | E7 records empty route-level 401/429 results as graceful when the leak scan is clean. Silence, `{}`, or an otherwise unhelpful response can therefore satisfy the graceful sub-gate. | Blocks reliance on the E7 readiness claim |
| R4 | P2 | The new PWA course-chat drawer has no dedicated Playwright flow, and several new controls have no `data-cy` hook. | Regression-evidence gap |
| R5 | Gate | E3/E4/E7 judge dimensions exist but have never completed one fully measured live judged run. | Pre-release evidence missing |
| R6 | Gate | Firefox/WebKit against a production build and a screen-reader pass remain unexecuted manual release gates. | Pre-release evidence missing |
| R7 | Delivery | The PR body still names head `79e70be28` and 133 commits / 217 files; live state is `60e1d5366`, 145 commits / 305 files. | Reviewer-facing evidence is stale |
| R8 | Boundary | Lecturer MCP is internal-only. It has no OAuth discovery, authorization endpoint, client registration, consent, PKCE, resource binding, or external token flow. | Not a blocker for embedded usage; hard blocker before external exposure |

Positive baseline:

- local branch and PR remote head are identical and the worktree is clean;
- 50 live PR checks pass, including all eight Playwright shards, MCP tests,
  GraphQL tests, CodeQL, and Sonar;
- the one failing GitGuardian check is the documented inherited rotated-secret
  finding;
- `evaluation/manage-assistant`: 63 offline tests pass and Ruff is clean;
- delegated local login, assistant launch, iframe rendering, and a harmless
  read-only assistant exchange work in Chromium;
- current lecturer-MCP tools validate issuer, expiry, role, purpose, scope,
  subject, and derived object permissions; confirmed persistence remains bound
  to the lecturer's authenticated session and DRAFT-only proposal contract.

## 3. Scope and Locked Constraints

### In scope for PR readiness

- `apps/chat` Manage-assistant request parsing and error behavior;
- `apps/frontend-pwa` course-chat drawer semantics and test hooks;
- `playwright` coverage for the PWA drawer and Manage route errors;
- `evaluation/manage-assistant` E7 contract, tests, and live judged evidence;
- current wiki pages, eval README, and PR description;
- conditional Firefox/WebKit release-test support.

### Explicit non-goals

- no new MCP tools;
- no external MCP ingress or OAuth implementation;
- no Prisma change, migration, seed redesign, gamification change, or Hatchet
  workflow;
- no autonomous write, publish, edit, or delete capability;
- no weakening of E1-E7 thresholds, hard gates, trial counts, or readiness
  probes;
- no replacement of the existing custom eval collector merely to conform to a
  generic runner shape;
- no change to the parked German `Assistant` CTA thread without a separate
  ruling;
- no cluster rollout, secret mutation, PR merge, or production enablement
  without explicit authority.

### Existing decisions carried forward

1. The lecturer MCP remains an internal backend for the embedded assistant.
2. Writes remain proposal-first, DRAFT-only, and lecturer-confirmed.
3. Current PR scope uses Chromium for iterative browser work; Firefox, WebKit,
   and screen-reader evidence remain a release gate.
4. Model-mediated E7 cases must produce a calm user-facing explanation and
   never fabricate success.
5. Route-level failures are rendered through the chat UI error surface because
   no model turn occurs; their contract must therefore be measured as a
   transport/UI path, not silently credited as model prose.
6. Every behavior change updates the affected wiki page and relevant skill in
   the same change set.

### Decisions not required for Slices 1-6

These stay gated and must not delay the readiness repairs:

| Gate | Decision | Recommendation |
| --- | --- | --- |
| G1 | Can the PR merge before every production-release gate has run? | Hold merge until Slices 1-4 and final reviews pass. If the feature remains disabled, merge may precede S5 only with an explicit ruling; production enablement may not. |
| G2 | Does X3 still use a generic persisted-GraphQL bearer path after the new token-confusion review? | Re-open X3 before roadmap W2. Prefer a dedicated, operation-allowlisted MCP-to-GraphQL path over a token accepted by every role-only persisted query. |
| G3 | Are selected filters/draft form context, `Edit in form`, and practice-quiz list/create part of the first released product promise? | Treat them as post-release extensions unless product explicitly promotes them. Do not present them as shipped in the PR body. |
| G4 | Should an external MCP client be supported? | Keep A5's current answer: no implementation until a concrete consumer, owner, OAuth security review, and rollout environment exist. |

## 4. Domain and Layer Footprint

Canonical terms:

- **Manage assistant**: lecturer-facing chat runtime embedded in
  `frontend-manage`.
- **Lecturer MCP**: internal Streamable HTTP MCP service used by `apps/chat`;
  not a public OAuth resource.
- **Course chat drawer**: participant-facing PWA drawer embedding an existing
  course `Chatbot`.
- **Proposal**: signed, non-persisted candidate for a DRAFT `Element`; it
  becomes persistent only through the authenticated confirmation route.
- **Graceful degradation**: a safe, useful product response in the channel that
  actually handles the failure: assistant text for model-mediated faults,
  visible generic UI state for route-level faults.

Layer footprint:

| Layer | Expected change |
| --- | --- |
| Prisma / migrations / seeds | None. Reuse the existing Playwright and eval fixtures. |
| GraphQL | None for Slices 1-6. |
| `apps/chat` | Bounded request reader, request-shape refinements, safe 413 behavior, E2E route mocks. |
| `apps/frontend-pwa` | Drawer modal parity, stable selectors, function-component convention cleanup. |
| `packages/types` | Only if an existing cross-app protocol type must be extended; avoid otherwise. |
| `playwright` | PWA drawer flow, Manage 401/429 transport-error assertions, optional release browser projects. |
| Eval | E7 channel-aware contract, offline tests, live judged run. |
| i18n | No new strings expected. If wording changes, both EN and DE are mandatory; the parked CTA remains untouched. |
| Wiki / skills | `chat-platform.md`, `frontend-conventions.md`, `testing.md`, `auth-model.md` if auth decisions change, and the relevant Klicker skills. |
| CI / deployment | Conditional release-browser execution only. No cluster apply in this plan. |

## 5. Execution Order

Execute one slice at a time:

`S0 → S1 → S2 → S3 → S4 → S5 → S6`

S7 is a separate post-readiness architecture and extension phase. It must not
be bundled into the repair commits.

For each implementation slice:

1. mark the slice `IN PROGRESS` in this file;
2. implement the smallest complete behavior;
3. run the slice-local checks;
4. update the affected wiki page and skill;
5. inspect staged files for secrets and real personal data;
6. commit with the listed conventional title;
7. run independent standards/spec review plus simplification;
8. run the mandatory security lens where noted;
9. fix accepted findings and re-run checks; and
10. update `Progress` with exact commands and evidence.

Do not push until authorized. Any authorized push uses:

```bash
git push origin HEAD:codex/manage-assistant-mcp-v3-ai
```

## 6. Slices

### S0 — Baseline and plan capture

**Goal:** preserve the reviewed state and make later claims comparable.

**Do:**

1. Add this plan at the reviewed head.
2. Reconfirm immediately before implementation:
   - clean worktree;
   - local head equals `origin/codex/manage-assistant-mcp-v3-ai`;
   - live PR base/head;
   - check and review-thread counts.
3. Record any drift in `Progress`; do not silently rebase or merge the base.

**Done when:**

- the plan is committed on the implementing branch before code;
- no unrelated files are staged;
- the exact review baseline is recorded.

**Commit:** `docs(chat): plan PR 5109 production-readiness improvements`

---

### S1 — Bound the Manage-assistant request envelope

**Goal:** reject oversized or structurally abusive bodies before
`convertToModelMessages` or any model/MCP work, while preserving the largest
currently supported legitimate request.

**Primary files:**

- `apps/chat/src/app/api/manage/chat/route.ts`
- new focused helper under `apps/chat/src/lib/server/`
- focused Chat unit tests
- `docs/chat-platform.md`
- `.agents/skills/klicker-testing-verification/SKILL.md` only if the procedure
  changes

**Design:**

1. Measure serialized bodies produced by the current UI for:
   - 50 normal text messages;
   - the current maximum 5 MiB client-side image plus preview;
   - the largest image/history combination the UI intentionally supports.
2. Set one named app-level byte limit from that evidence:
   - recommended default: 8 MiB;
   - increase only if the measured supported payload needs it;
   - hard ceiling for this PR: 16 MiB.
3. Implement a small `readBoundedJson` helper:
   - reject a numeric `Content-Length` above the limit before reading;
   - stream `request.body` and stop/cancel once accumulated bytes exceed the
     limit, so chunked requests cannot bypass the check;
   - decode and parse once;
   - distinguish `TOO_LARGE` from malformed JSON without exposing internals.
4. Return:
   - `413 { "error": "Request body too large" }` for byte-limit failures;
   - the existing generic 400 for malformed JSON or schema failure.
5. Keep authentication and the existing per-user rate limiter before body
   consumption.
6. Strengthen the request refinement without cloning all AI SDK internals:
   - maximum 50 messages remains;
   - cap aggregate part count;
   - cap aggregate text characters;
   - reject image/data parts whose encoded size defeats the byte contract;
   - do not trust the client-side 5 MiB check.
7. Do not add a dependency or change the shared chat ingress in this slice.
   The application limit is route-specific; lowering the shared ingress could
   regress other chat endpoints.
8. Add an optional production diagnostic counter for 413s if the existing
   telemetry path supports it without logging body content.

**Tests:**

- declared `Content-Length` above the limit → 413 without reading the stream;
- chunked/unknown-length body crossing the limit → 413;
- malformed in-limit JSON → 400;
- structurally invalid in-limit JSON → 400;
- representative maximum supported client payload → accepted by the reader;
- auth failure remains 401 before body parsing;
- per-user rate-limit failure remains 429 before body parsing;
- 413/400 bodies contain no stack, path, token, prompt, or payload data.

**Risk check:**

Run a bounded concurrency probe with synthetic payloads only. If ten concurrent
near-limit requests push the single production-equivalent pod beyond 70% of its
memory limit or restart it, add a small per-pod in-flight guard before parsing
as a separate reviewed adjustment. Do not add that complexity speculatively.

**Verification:**

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/chat check
devrouter exec . -- pnpm --filter @klicker-uzh/chat test:run
```

**Done when:**

- both known-length and chunked oversize paths fail at the app boundary;
- the current supported image workflow still succeeds;
- route error responses are stable enough for S3's deterministic contract;
- Chat checks/tests and the security review pass.

**Commit:** `fix(chat): bound manage assistant request bodies`

---

### S2 — Bring the PWA course-chat drawer to modal parity

**Goal:** make the participant drawer meet the same keyboard and
assistive-technology contract already implemented by the Manage drawer.

**Primary files:**

- `apps/frontend-pwa/src/components/chatbot/CourseChatDrawer.tsx`
- `apps/frontend-pwa/src/pages/course/[courseId]/chatbot/index.tsx`
- `playwright/tests/Y-course-chat-drawer.spec.ts` (new) or the closest existing
  `Y-chat` surface if adding a file creates unnecessary fixture duplication
- `playwright/util/chat.ts`
- `docs/frontend-conventions.md`
- `docs/testing.md`
- `.agents/skills/klicker-frontend-ui/SKILL.md` and
  `.agents/skills/klicker-playwright-e2e/SKILL.md` only if procedure changes

**Do:**

1. Use `ManageAssistantWidget` as the local reference; do not invent a second
   modal contract or extract a premature cross-app abstraction.
2. Give the panel a stable id and connect the launcher with:
   - `aria-controls`;
   - `aria-expanded`;
   - `aria-haspopup="dialog"`.
3. Render a neutral element with `role="dialog"` and `aria-modal="true"`;
   retain the localized accessible name.
4. Portal the open panel to `document.body`.
5. While open:
   - save the exact existing `inert` and `aria-hidden` state of `#__next`;
   - set the page root inert and assistive-technology-hidden;
   - move focus into the panel;
   - trap Tab and Shift+Tab within the panel;
   - close on Escape.
6. On every close/unmount/route transition:
   - restore the page root's exact previous state;
   - restore focus to the launcher when it still exists.
7. Preserve desktop, mobile, and `embedded` geometry.
8. Add stable `data-cy` hooks to the chatbot selector, new-tab link, close
   button, iframe, and course-entry link.
9. Convert `CourseChatbotEntryPage` to a `function` declaration.
10. Do not change user-visible wording unless the browser pass proves it is
    necessary.

**Playwright coverage:**

- launcher exposes the correct closed-state relationships;
- opening announces one modal dialog and moves focus inside;
- page root is inert and `aria-hidden`;
- Tab/Shift+Tab stay inside;
- chatbot selector remains usable when multiple chatbots exist;
- iframe has a stable accessible title and selector;
- Escape and Close restore the background and launcher focus;
- new-tab action remains keyboard reachable;
- embedded/mobile viewport does not obscure the close control;
- missing participation / no-chatbot course entry still uses the localized
  fallback link.

Reuse existing chat fixtures. Only extend the Playwright seed if the current
fixture cannot expose the drawer; do not create a parallel seed path.

**Verification:**

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/frontend-pwa check
devrouter exec . -- pnpm exec tsc --noEmit -p playwright/tsconfig.json
devrouter exec . -- pnpm --filter @klicker-uzh/playwright exec playwright test \
  tests/Y-course-chat-drawer.spec.ts --project=chromium
```

Use `npx agent-browser@0.32.2` against the routed worktree for delegated/test
browser proof. Capture EN and DE desktop plus a mobile viewport.

**Done when:**

- source and live DOM match `docs/frontend-conventions.md`'s modal contract;
- keyboard focus cannot escape to the obscured page;
- cleanup is exact after close and navigation;
- the new Playwright flow passes in Chromium;
- no existing `Y-chat` behavior regresses.

**Commit:** `fix(pwa): make the course chat drawer keyboard-modal`

---

### S3 — Make E7 measure the channel users actually see

**Goal:** eliminate the empty-result false pass without pretending that a
route-level 401/429 contains a model-generated message.

**Primary files:**

- `evaluation/manage-assistant/src/manage_assistant_eval/degradation.py`
- `evaluation/manage-assistant/tests/test_e7_degradation.py`
- `evaluation/manage-assistant/tests/test_scoring_contract_x2b.py`
- E7 case data and model types if a channel discriminator is needed
- `playwright/tests/Y-manage-assistant.spec.ts`
- `playwright/util/manageAssistant.ts`
- `evaluation/manage-assistant/README.md`
- `docs/testing.md`

**Contract:**

Split E7 fault handling into two explicit channels:

1. **Assistant-text channel** — MCP unavailable and tool/backend faults that
   still reach a model turn:
   - keep deterministic no-fabrication and no-leak hard checks;
   - require non-empty text;
   - run the existing DeepEval graceful-message judge.
2. **Transport/UI channel** — expired session and route-level 429 where no model
   turn occurs:
   - require the expected status;
   - validate an exact small public JSON error contract;
   - reject empty objects, unknown shapes, raw exception text, and unexpected
     fields;
   - use Playwright to prove the chat UI renders the generic visible error
     state and does not display the raw response body.

An empty `result.text` may be structurally expected in the transport/UI channel,
but it is never sufficient for a pass by itself.

**Do:**

1. Add an explicit case field or deterministic mapping for
   `assistant_text` versus `transport_ui`; never infer it merely from an empty
   string.
2. Replace the current leak-only route pass with
   `check_safe_transport_error`.
3. Keep route-level no-fabrication and leak checks.
4. Add contract tests:
   - expected 401 body passes;
   - expected 429 body and `Retry-After` pass;
   - `{}`, `null`, HTML, stack text, unknown status, wrong public message, or
     extra internal fields fail;
   - a route case mislabeled as assistant-text fails on silence;
   - a model-mediated case with a calm explanation reaches the judge path.
5. Add Manage Playwright cases for chat-route 401 and 429:
   - visible `chat-assistant-message-error`;
   - no raw `Unauthorized`, `Too many requests`, stack, or JSON dump in the
     transcript;
   - composer recovers according to the existing UI contract.
6. Update E7 documentation and summary labels so reports say
   `assistant message` or `safe transport/UI error`, not a generic graceful
   claim.
7. Keep all thresholds and trial counts unchanged. Do not delete 401/429 cases.
8. Keep the existing custom pytest collector because its three-state
   `PASS/FAIL/INCOMPLETE` summary and hard-gate aggregation are project
   contracts. Qualifying `deepeval test run` is optional follow-up work, not a
   reason to rewrite this slice.

**Verification:**

```bash
cd evaluation/manage-assistant
uv run pytest -m offline -q
uv run ruff check .
uv run ruff format --check .

devrouter exec . -- pnpm --filter @klicker-uzh/playwright exec playwright test \
  tests/Y-manage-assistant.spec.ts --project=chromium
```

**Done when:**

- no route-level case can pass from silence plus a clean leak scan;
- both E7 channels have deterministic failure tests;
- UI-facing 401/429 behavior is proven;
- offline suite, Playwright, and eval-integrity review pass.

**Commit:** `fix(evals): measure manage assistant route degradation truthfully`

---

### S4 — Consolidated automated regression gate

**Goal:** prove S1-S3 together before paid/live or manual release checks.

**Do:**

1. Run slice-local suites again from a clean worktree.
2. Run:

```bash
devrouter exec . -- pnpm run check:all
devrouter exec . -- pnpm run build
devrouter exec . -- pnpm --filter @klicker-uzh/chat test:run
devrouter exec . -- pnpm --filter @klicker-uzh/mcp-lecturer test
devrouter exec . -- pnpm --filter @klicker-uzh/playwright exec playwright test \
  tests/Y-manage-assistant.spec.ts \
  tests/Y-course-chat-drawer.spec.ts \
  --project=chromium

cd evaluation/manage-assistant
uv run pytest -m offline -q
uv run ruff check .
uv run ruff format --check .
```

3. Run the current MCP happy and negative smoke matrix with the worktree's
   namespaced issuer, following the existing README rather than copying secret
   values into the plan.
4. Verify the changed app against the real routed local stack:
   - Manage launcher and read-only turn;
   - proposal card render, without confirmation/persistence unless separately
     authorized;
   - PWA course drawer keyboard and mobile behavior;
   - no unexpected console or network errors.
5. Capture screenshots outside the repository.
6. Update wiki pages and `docs/log.md`; run:

```bash
bash ~/.agents/skills/rs-llm-wiki-okf/scripts/validate.sh docs
pnpm exec prettier --check docs/
```

**Done when:**

- all commands pass at the same commit;
- the worktree is clean after generated-artifact checks;
- evidence paths and exact totals are recorded in `Progress`;
- no secrets, real user data, or eval fixtures containing personal data are
  staged.

**Commit:** normally folded into S1-S3 documentation adjustments; use
`docs(chat): record assistant readiness verification` only if a separate
evidence-only commit is necessary.

---

### S5 — Close live-judge, Firefox/WebKit, and screen-reader gates

**Goal:** produce the evidence that cannot be obtained from offline or Chromium
checks.

#### S5.1 — First fully measured judged eval

1. Obtain a judge route through the approved secret flow; never paste or commit
   credentials. A paid judge run needs explicit spend authority.
2. Prefer the existing OpenAI-compatible gateway/model combination documented
   in the roadmap. If GEval logprobs are unsupported, qualify another approved
   model or record the gateway incompatibility; never skip or weaken the
   metric.
3. Run the full suite against a freshly verified base seed followed by eval
   fixtures.
4. Require:
   - all eight dimensions measured;
   - `OVERALL: PASS`;
   - E5/E6 remain zero-failure hard gates;
   - E7 reports both channels accurately;
   - case-level review of every E3/E4/E7 judge result.
5. Store only sanitized summaries/artifacts. Do not store prompts containing
   secrets or real course data.
6. Record model, gateway, date, case counts, thresholds, cost/latency, and
   logprobs behavior in the eval README and `Progress`.

The nightly workflow cannot be dispatched while its file is absent from the
default branch; the observed GitHub response is 404. Therefore:

- pre-merge requirement: one full local/approved-environment judged run;
- post-merge, pre-production requirement: configure repository secrets through
  the authorized flow and run `workflow_dispatch` once after the workflow is
  present on the eligible default branch;
- scheduled/nightly PASS is operational evidence, not something to fabricate
  on the feature branch.

#### S5.2 — Firefox and WebKit release matrix

Playwright 1.58.2 supports named browser projects. Keep normal PR CI Chromium
only, but make release execution explicit:

1. Add `firefox` and `webkit` projects behind
   `PLAYWRIGHT_RELEASE_MATRIX=true` in `playwright/playwright.config.ts`.
2. The default project list remains Chromium, so ordinary eight-shard CI cost
   does not triple.
3. Run the two targeted assistant specs against production builds of
   `frontend-manage`, `frontend-pwa`, `auth`, and `chat`, not Turbopack dev
   output.
4. Use:

```bash
PLAYWRIGHT_RELEASE_MATRIX=true \
pnpm --filter @klicker-uzh/playwright exec playwright test \
  tests/Y-manage-assistant.spec.ts \
  tests/Y-course-chat-drawer.spec.ts \
  --project=firefox --project=webkit
```

5. If local production processes conflict with the running devcontainer,
   execute this as a dedicated release job/approved CI run rather than
   deleting caches or starting another uncontrolled stack.
6. Record browser versions and screenshots for failures. A Turbopack
   `ChunkLoadError` is an environment failure, not product evidence; production
   builds must be the final gate.

#### S5.3 — Screen-reader pass

Run VoiceOver on macOS against the production-build Manage and PWA surfaces:

- launcher name and expanded state are announced;
- opening announces the dialog once and moves focus inside;
- background content is unavailable while open;
- title, close, new-tab, selector, iframe, composer, proposal, and error state
  have useful names;
- dynamic assistant/error output is discoverable without raw technical detail;
- Escape/Close restores focus and the prior page state;
- desktop and mobile-width layouts remain operable.

Record browser, OS, screen-reader version, steps, and pass/fail notes in
`Progress`. Do not use a screen-reader simulator as the final claim.

**Done when:**

- full judged eval is `OVERALL: PASS`;
- Firefox and WebKit targeted suites pass against production builds;
- the screen-reader checklist passes;
- all limitations are explicit and assigned, not renamed as passes.

**Commit:** `test(chat): add assistant release browser coverage`

---

### S6 — Final branch, security, and PR closeout

**Goal:** make the review surface match the branch and secure an independent
go/no-go.

**Do:**

1. Re-run the S4 gate at final head.
2. Run independent:
   - standards/spec branch review;
   - simplification review;
   - code-level security review focused on request parsing, JWT boundaries,
     postMessage, and error leakage;
   - maintainability review.
3. Fix accepted findings one at a time and re-run the affected checks.
4. Confirm:
   - branch equals the intended remote head;
   - no unrelated worktree changes;
   - no unresolved actionable review thread;
   - the parked German CTA thread is still explicitly owned or resolved by its
     separate workstream.
5. Refresh the PR body from live state:
   - exact head SHA, commit/file/line totals;
   - S1-S5 changes;
   - commands and outcomes;
   - screenshots;
   - live judge summary;
   - current CI and inherited GitGuardian disposition;
   - internal-only auth statement;
   - explicit post-release/non-goal list.
6. Read the published PR body back after any authorized update.
7. Do not mark ready, merge, deploy, or enable the production feature without
   explicit authority and required green checks.

**Done when:**

- no P1/P2 correctness or security finding remains;
- current CI is green apart from an explicitly accepted inherited check;
- release evidence is complete or production remains blocked;
- PR metadata describes the actual branch;
- senior reviewer issues an explicit go/no-go.

**Commit:** `docs(chat): finalize PR 5109 readiness evidence`

---

### S7 — Post-readiness authentication and extension phase

This phase is not part of the readiness repair. It begins only after S6 and the
relevant decision rulings.

#### S7.1 — Re-open X3 before adding the W2 tracer

The existing roadmap selects persisted GraphQL as the shared read-authZ path.
The security review added a constraint: the current generic GraphQL bearer
fallback verifies a shared `APP_SECRET` token without an audience or
MCP-operation allowlist. A stolen five-minute lecturer-MCP token could therefore
attempt role-only persisted reads beyond the MCP tool that caused it to be
minted.

Evaluate:

| Option | Shape | Trade-off |
| --- | --- | --- |
| A — purpose/audience only | Add MCP audience and verify it in MCP/GraphQL. | Prevents some token confusion but does not restrict which persisted operations the token can call. Insufficient alone. |
| B — dedicated MCP GraphQL gateway (recommended) | Accept audience-bound lecturer-MCP tokens only on a small operation-allowlisted path; map every tool to an approved persisted operation and required scope. Generic GraphQL rejects `purpose=lecturer-mcp`. | Strongest least-privilege boundary; extra gateway/allowlist code and tests. |
| C — shared service-layer authZ | Move object authorization into reusable service functions used by GraphQL and MCP. | Clean long-term model but high migration cost and broad regression surface. |
| D — retain direct derived-permission reads | Keep current tools only; do not add W2/W3 reads. | Safe narrow stopgap; blocks roadmap value. |

The final choice is hard to reverse, surprising without context, and a genuine
trade-off. Record it as an ADR only after approval.

Required regardless of option before external exposure:

- token `aud`/resource binding;
- dedicated signing key instead of the broad shared `APP_SECRET`;
- explicit token-purpose separation at every accepting service;
- shared/distributed replay and rate-limit state if replicas exceed one;
- NetworkPolicy and ingress design;
- audit records for external token and tool use;
- negative tests for wrong issuer, audience, purpose, role, scope, operation,
  subject, object permission, replay, and expiry.

Any NetworkPolicy, ingress, secret, or replica change is a **cluster-level
change** and requires a separate chat summary and explicit apply approval.

#### S7.2 — Extension order after X3

1. **W2 tracer:** `live_quiz_running_list`, using the newly approved shared
   read-authZ path.
2. **W3 T1 reads:** course and activity summaries, gated by A1.
3. **Context richness:** selected tags, active filters, and minimal draft-form
   metadata, with explicit privacy/minimization rules.
4. **Practice-quiz reads:** list/get only after the shared path and E1/E3
   selection evidence hold.
5. **W4 proposal writes:** existing-object edits and practice-quiz draft
   creation only after A2, with before/after diff, staleness guard, signed
   proposal, jti replay protection, audit, rate limit, and feature flag.
6. **`Edit in form`:** only after defining a validated cross-frame draft
   transfer contract and navigation/unsaved-change behavior.
7. **External OAuth:** execute `PLAN-external-mcp-oauth.md` only after A5 changes
   and at least one concrete external client is named.

Every new tool repeats the existing rollout gate:

1. non-goals;
2. shared authZ path and owned/shared/foreign/missing/malformed matrix;
3. name/description selectability and E1 ≥ 0.95;
4. E3 read grounding or E4 proposal quality;
5. E5/E6 hard gates;
6. write-only diff/staleness/audit/replay/rate controls;
7. internal feature flag and rollback;
8. first-class tool span;
9. wiki/skill update;
10. live browser verification.

## 7. Verification Matrix

| Requirement | Unit/contract | E2E/browser | Live/manual |
| --- | --- | --- | --- |
| Oversized request rejection | known/chunked/shape/error-body Chat tests | route-level request assertion | bounded concurrency memory probe |
| PWA modal behavior | pure helpers only if extracted | Chromium Playwright | EN/DE desktop/mobile screenshots |
| Manage route 401/429 | E7 transport contract tests | visible generic error, no raw body | authenticated local smoke |
| E7 assistant faults | deterministic no-fabrication/leak | existing stream-error UI | DeepEval judge |
| MCP auth | existing happy + negative smoke | read-only assistant turn | no external-client claim |
| Browser compatibility | targeted specs | Chromium default | Firefox/WebKit production build |
| Assistive technology | source contract | keyboard assertions | VoiceOver |
| Whole branch | targeted suites | eight-shard CI | independent final reviews |

## 8. Rollback and Operations

- S1: revert the route/helper commit if legitimate requests are rejected;
  monitor only aggregate 413 counts. Never log bodies.
- S2: revert the PWA drawer commit; no stored state or migration exists.
- S3: eval/UI tests only change readiness truth; do not revert merely because
  they expose a failure.
- Manage assistant production exposure remains controlled by
  `NEXT_PUBLIC_MANAGE_ASSISTANT_ENABLED`.
- Do not describe feature-flag rollback as proof that unsafe enabled behavior
  is production-ready.
- No database rollback is required.
- Current per-pod rate/replay state is adequate only for the documented
  single-replica deployment. Reassess before scaling.

## 9. Definition of Done

PR #5109 is production-ready only when all are true:

- [x] S1 rejects known-length and chunked oversized bodies and preserves the
      supported client payload.
- [x] S2 PWA drawer meets the repository modal contract and has stable E2E
      coverage.
- [x] S3 has no silence-based E7 pass; 401/429 are measured through the
      transport/UI contract.
- [x] S4 full automated gate passes at one clean commit.
- [ ] One fully measured live judged run reports `OVERALL: PASS`.
- [ ] Firefox and WebKit targeted tests pass against production builds.
- [ ] VoiceOver pass is recorded.
- [x] Wiki, skills, eval README, and plan Progress match the implementation.
- [x] Independent standards, spec, security, simplification, and
      maintainability reviews are clean.
- [ ] PR body and live head/check state agree.
- [ ] No unresolved actionable review thread remains.
- [ ] Merge and production enablement have separate explicit authority.

External OAuth and the S7 tool roadmap are not required to release the embedded
assistant. They remain blocked until their own decisions and security gates are
approved.

## 10. Progress

- 2026-07-28: Senior read-only review completed at `60e1d5366`. Verified live
  PR state (145 commits, 305 files, 50 passing checks, one inherited
  GitGuardian failure), 63 passing offline eval tests, clean Ruff, and an
  authenticated Chromium read-only Manage-assistant turn. Recorded blockers
  R1-R3 and release gaps R4-R8.
- 2026-07-28: Improvement plan created. No implementation, commit, push, PR
  mutation, deploy, secret change, or production action performed.
- 2026-07-28: S0 baseline re-confirmed immediately before execution. Local
  `HEAD` and `origin/codex/manage-assistant-mcp-v3-ai` both equal
  `60e1d5366`; PR #5109 remains open, non-draft, and mergeable against
  `20a953251`; branch scope remains 145 commits / 305 files / +25,197 /
  -766; live checks remain 50 PASS and the one inherited GitGuardian failure.
  S0 implementation work is the plan commit only; no remote or PR mutation.
- 2026-07-28: S0 committed locally as `2971bf532` with
  `docs(chat): plan PR 5109 production-readiness improvements`; the hook's full
  `pnpm run check:all` passed. Nothing was pushed.
- 2026-07-28: S1 measurement found that the shared client permits three 5 MiB
  images and that their serialized request is about 20.194 MiB; two images are
  about 13.528 MiB, while 50 normal text messages are about 0.194 MiB. This
  conflicts with the approved 16 MiB hard ceiling if all three images remain
  supported. Recommended ruling: keep 16 MiB and cap only the Manage assistant
  at two images; the participant chat remains at three. S1 implementation is
  paused pending that product-envelope ruling.
- 2026-07-28: Product ruling approved the recommended S1 envelope: keep the
  16 MiB route ceiling, cap only the Manage assistant at two 5 MiB images, and
  retain the participant-chat limit of three images. S1 implementation resumed
  from clean local head `7465308c8`; no remote or PR mutation was performed.
- 2026-07-28: S1's production-equivalent standalone-server probe exposed and
  fixed Next middleware's default 10 MiB body clone/truncation by excluding only
  `/api/manage/chat` from the matcher. Before the per-pod guard, ten concurrent
  15.5 MiB synthetic requests peaked at 440.2 MiB. A one-request guard now
  returns one `400` plus nine retryable `503` responses before competing bodies
  are read, but the accepted request still peaked at 235.0 MiB. The exact
  supported 13.528 MiB two-image envelope peaked at 198.3 MiB from a settled
  140.6 MiB baseline, leaving only 1.7 MiB beneath the production 200 MiB limit
  and failing the plan's 70% threshold. Recommended ruling: restore the Chat
  pod's chart-default 400 MiB limit in staging and production while retaining
  the approved 16 MiB route ceiling and one-request guard. No deployment,
  remote, or PR mutation was performed.
- 2026-07-29: The 400 MiB Chat limit was approved and restored in the staging
  and production values; no deployment was authorized or performed. The
  production-standalone probe was rerun with ten concurrent 15.5 MiB synthetic
  requests: one request parsed and returned `400`, nine overlapping requests
  returned retryable `503` before body consumption, and the 235.0 MiB peak
  stayed below the 280 MiB risk threshold.
- 2026-07-29: S1 implementation verification passed: Chat tests 227/227, Chat
  typecheck, focused Manage and participant attachment-limit Chromium tests,
  staging and production Helm lint, production Chat build, and authenticated
  manual browser evidence with two accepted images plus the visible rejection
  of the third. The request slot now remains held until the streamed response
  completes or is cancelled. The wiki validator still reports only the two
  inherited `F002` errors in the unrelated seed solution pages; this slice
  introduced no new wiki finding. S1 is ready for its local commit and
  independent review gates.
- 2026-07-29: Independent S1 review found that self-hosted Next does not
  enforce `maxDuration`, busy rejections consumed the lecturer's rate budget,
  the shallow request schema trusted malformed/client-forged message history,
  and image base64 validation accepted empty or mispadded payloads. The
  accepted fixes add a 30-second body deadline and 60-second total abort
  deadline, propagate cancellation through MCP/model/response streams, admit
  work before rate accounting, use the AI SDK structural validator before MCP
  setup, reject client system and invalid file/user parts, remove client-owned
  assistant tool/data/reasoning history before model conversion, and validate
  non-empty padded base64. Focused request/MCP tests and Chat typecheck pass;
  the full Chat suite now has 235 tests and the production Chat build passes
  with `NODE_ENV=production`.
- 2026-07-29: The review also found that staging and production still overrode
  the chart's 200 MiB Chat memory request down to 50 MiB despite a measured
  140.6 MiB idle baseline and 235.0 MiB guarded peak. The user approved
  restoring the 200 MiB chart-default request in both environments while
  retaining the 400 MiB limit. The values are updated in this slice; no
  deployment or cluster action has been performed.
- 2026-07-29: S4 evidence accumulated at the S1 review-fix worktree state:
  full monorepo `check:all` passed under Node 24; the full 23-package production
  build passed before the review fixes and the affected Chat production build
  passed afterward; lecturer MCP unit tests passed 40/40; lecturer MCP happy
  smoke passed 9/9 and the negative/authZ matrix passed 13/13 against the
  namespaced issuer and current Playwright-seeded course; offline eval passed
  91 tests with 53 deselected plus clean Ruff lint/format. The final combined
  Chromium run passed all 23 Manage-assistant and PWA drawer tests against the
  namespaced worktree stack, including the formerly transient 401-recovery
  case. The temporary local database tunnel was stopped. The wiki validator
  still has only the two inherited `F002` solution-page errors and 24 inherited
  hygiene warnings; docs formatting passes. Staging and production Helm lint
  also pass with the approved 200 MiB request / 400 MiB limit.
- 2026-07-29: The final exact-state automated gate passed under the pinned
  Node 24 container: Chat tests 235/235, repository-wide `check:all`, and the
  full 23-task production build. Together with the recorded MCP, eval, Helm,
  wiki, and combined 23/23 Chromium evidence, S1 and S4 now satisfy their
  automated definition of done. No remote, deployment, or cluster action was
  performed.
- 2026-07-29: Exact-commit re-review of `cd07ead7d` found two residual
  trust/cancellation gaps: the pinned MCP SDK overwrote `requestInit.signal`
  with its private transport signal, and reconstructed history still retained
  browser-owned provider metadata. The accepted fixes compose both abort
  signals in the transport's actual custom fetch, rebuild every accepted
  message/part from allowlisted fields, and add regressions proving a hung MCP
  fetch aborts and all client provider metadata is removed. Focused boundary
  tests pass 38/38, the full Chat suite passes 236/236, Chat typecheck passes,
  the production Chat build passes with `NODE_ENV=production`, and the
  repository-wide `check:all` plus 23-task production build pass. The S1/S4
  checkboxes remain subject to the amended exact-head reviewer sign-off.
- 2026-07-29: Exact-head re-review of `91797feb7` is clean across independent
  standards, spec, security/authentication, simplification, and maintainability
  lenses. Reviewers verified the actual custom MCP fetch signal composition,
  strict allowlist reconstruction of browser messages and parts, authentication
  before body consumption, generic public errors, and cleanup on every exit.
  The only residual operational limitation is documented rather than hidden:
  the admission guard and rate limiter are per process, so multi-replica
  fairness/distribution must be revisited before scaling.
- 2026-07-29: S4 was rerun against exact code head `91797feb7`. Lecturer MCP
  tests passed 40/40, happy smoke 9/9, and negative/authZ smoke 13/13 against
  the namespaced issuer. Offline eval passed 91 tests with 53 live cases
  deselected; Ruff lint and format passed. Both staging and production Helm
  lint passed. Docs formatting passed; the wiki validator reproduced only the
  two inherited `F002` solution-page errors and 24 inherited warnings. The
  combined routed Chromium suite passed 23/23 after invalidating a generated
  Next ISR 404 left by the prior production build; PostgreSQL, GraphQL, cookie,
  and route probes established that this was stale generated state rather than
  a product or auth failure. The temporary local database tunnel was stopped.
- 2026-07-29: S5.2 release automation is implemented behind
  `PLAYWRIGHT_RELEASE_MATRIX=true`; the default Playwright project list remains
  Chromium-only. The host has matching Firefox and WebKit downloads, but the
  cached WebKit executable cannot start on the current macOS because the system
  WebKit framework lacks `_OBJC_CLASS_$__WKBrowserContext`. The official
  Playwright 1.58.2 container is not cached locally, and pulling/running it is a
  separately approved resource-consuming release check. No Firefox/WebKit
  production-build pass is claimed. S5.1 is also blocked because no approved
  judge model/key/base URL is configured and no paid-run authority exists;
  S5.3 remains a real VoiceOver human gate, not a simulator claim.
- 2026-07-29: Independent S5.2 spec and
  standards/simplification/maintainability reviews are clean at
  `40124f02f`. The default project list and existing CI remain Chromium-only,
  the exact opt-in exposes Firefox and WebKit, the documented command matches
  the configuration and Playwright 1.58.2, and every unavailable live gate
  remains explicitly unclaimed.
- 2026-07-29: S6 live reconciliation found the clean local branch at
  `40124f02f`, five commits ahead of the published PR head, with 150 commits
  and 315 files changed from live base `20a953251` (+28,416 / -793). PR #5109
  remains open and non-draft at published head `60e1d5366`; 50 checks are
  successful and the documented inherited GitGuardian check still fails. The
  PR body is stale at head `79e70be28` and 133 commits / 217 files. One
  unresolved, non-outdated review thread remains in
  `packages/i18n/messages/de.ts` for the separately parked German CTA. No
  push, PR-body mutation, review-thread resolution, ready-state change, merge,
  deployment, or production enablement is authorized. S6 publication and
  hosted CI therefore remain blocked even though local implementation and
  review gates are clean.
- 2026-07-28: S2 implementation completed. The PWA course-chat drawer now
  portals to `document.body`, exposes the complete launcher/dialog contract,
  traps focus, makes `#__next` inert and assistive-technology-hidden while
  open, closes on route/availability transitions, restores the exact root state
  and launcher focus on close, and exposes stable selectors. Dedicated
  Playwright coverage includes both focus boundaries, route cleanup, keyboard
  new-tab activation, multiple chatbots, iframe targets, desktop and
  embedded-mobile controls, and both entry fallback cases. Verification: PWA
  `check` passed; Playwright TypeScript and discovery passed; the amended
  focused suite passed 6/6 in 13.2 seconds against the exact branch-local
  devcontainer; the existing `Y-chat` suite passed 47/47 with its one
  pre-existing skipped root-edit case. Authenticated Chromium EN desktop,
  DE desktop, and 390x844 mobile checks confirmed live focus/root semantics,
  localized accessible naming, and close-control geometry. Screenshots are
  retained locally under `project/_local/screenshots/`. Independent standards
  and spec review found the route-cleanup gap and weak focus/new-tab assertions;
  all were fixed and reverified. The existing frontend and Playwright skills
  already describe the procedure, so no skill workflow changed. S2 is committed
  as the current local `fix(pwa): make course chat drawer keyboard-modal`
  commit; its review-fix amendment and full 25-check hook passed. Nothing was
  pushed.
- 2026-07-28: S3 implementation completed. Every E7 case now declares either
  `assistant_text` or `transport_ui`. Model-mediated faults require a
  non-empty assistant message before the unchanged 0.90 judge gate; assistant
  text, reasoning, tool outputs, route bodies, and `Retry-After` headers are all
  scanned for leaks, with payload-redacted failure diagnostics. Zero-tool cases additionally
  prove the OTP scope declaration and absence of tool activity, while
  tool-error cases prove the expected call, arguments, and `FORBIDDEN` output.
  Route-level 401/429 faults require their exact public JSON body, no assistant
  prose, and a positive integer `Retry-After` for 429. Silence, `{}`, `null`,
  HTML, stack text, unknown statuses, wrong messages, and extra fields fail
  deterministically. The summary key now states what it measures:
  `E7_assistant_message_or_safe_transport_ui`. Offline verification passed
  91/91 with 53 live cases deselected; Ruff lint and format checks passed. The
  real limiter path returned `429 {"error":"Too many requests"}` with
  `Retry-After: 300` after 30 invalid, authenticated, no-model requests from an
  isolated subject. The existing Chat auth suite passed 20/20 and independently
  proves that OTP sessions cannot mint lecturer MCP credentials. The full
  Manage Playwright suite passed 16/16 against the namespaced local stack,
  including visible generic 401/429 errors, no raw transcript leakage, and
  successful composer recovery. Initial independent standards, spec, and
  security review found that fault reproduction, judge routing, hard leak
  gating, the 429 production path, browser-visible reasoning/tool-output scans,
  and body/header diagnostic redaction needed stronger proof; each finding was
  fixed before amendment. Standards, spec, and security re-review were clean.
  The initial browser run exposed two local setup conditions rather than
  product failures: the shared namespaced cookie domain had to be supplied to
  the host runner, and the linked Next dev server had not registered the
  existing dynamic course route until its file was refreshed. No product or
  test workaround was added for either condition. The existing eval and
  Playwright skills already describe the procedure, so no skill workflow
  changed. Nothing was pushed.
