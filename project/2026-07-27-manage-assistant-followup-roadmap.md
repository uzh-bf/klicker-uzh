# Manage Assistant — Follow-Up Roadmap (junior-executable)

Status: ACTIVE. Written 2026-07-27, after the X2b eval-extension slice landed
(`c42fa4c54`) and PR #5109 CI went green (except the inherited GitGuardian
finding, see W6).

**Who this is for:** an engineer new to this feature area, picking up the
remaining work without the prior sessions' context. Every work item below is
self-contained: context, exact steps, verification, and done-criteria. Read
the two "before you start" sections first; they prevent the mistakes that
cost the most time so far.

**Parent artifacts (read on demand, not up front):**

- [2026-07-26-pr-5109-verification-and-extension-plan.md](./2026-07-26-pr-5109-verification-and-extension-plan.md)
  — the architect-level plan this roadmap executes. §5.1a explains the two
  substrate constraints behind every authZ decision here; §5.5 is the
  rollout gate every new tool must pass; the Progress sections record what
  already landed and why.
- [docs/auth-model.md](../docs/auth-model.md) — lecturer MCP trust chain,
  injection defense (fencing + sentinel no-disclosure), proposal signing.
- [evaluation/manage-assistant/README.md](../evaluation/manage-assistant/README.md)
  — how to run the eval harness, env vars, seeding, summary semantics.
- [docs/solutions/best-practice/dev-seed-is-not-idempotent-reset-first.md](../docs/solutions/best-practice/dev-seed-is-not-idempotent-reset-first.md)
  — read BEFORE touching the dev database.

## Current state (what is already done — do not redo)

| Item | State | Evidence |
| --- | --- | --- |
| X1 CI MCP integration test | DONE | `test-mcp-lecturer` workflow: unit tests + happy smoke + 11 negative cases |
| X2a eval harness E1/E5/E6 | DONE + live-verified | Full-strength run: E1 1.000 (12/12), E5 1.000 (24/24 trials), E6 1.000 (30/30 trials) |
| X2b judge dims E3/E4/E7 + nightly workflow | DONE (code); live judge run NOT yet executed | `c42fa4c54`; see W1 |
| X3 read-authZ convergence | DECIDED (Option C), not implemented | Plan §5.1 X3 row; tracer = W2 |
| X4 injection defense (fencing + prompt rules) | DONE | incl. sentinel no-disclosure fix `5bace13c6`, measured 0/3 leaks post-fix |
| X5 audit record on confirmed persistence | DONE | plan Progress 2026-07-26 |
| X6 mint-chain least-privilege | DONE | plan Progress 2026-07-26 |

PR **#5109** (head branch `codex/manage-assistant-mcp-v3-ai`) carries all of
it. CI: all green except **GitGuardian**, which is an inherited finding (a
staging JWT in an old `k6.js` commit; the secret is already rotated — it is
NOT caused by new pushes and does not block work, see W6).

## Before you start: environment

Everything runs against the self-contained devcontainer stack. From the
checkout root:

```bash
devrouter ensure .
```

- Run pnpm / prisma / tests **inside the container**
  (`devrouter exec . -- <cmd>`), never on the host. Never `pnpm install` on
  the host in a linked worktree — it breaks `turbo dev` with 502s.
- The eval harness itself (Python/uv) runs **on the host** against the
  stack's routed URLs; its README documents the exact env vars.
- Local login: delegated `lecturer` / `abcd` — never Edu-ID locally.

**Database seeding — order is load-bearing:**

1. Base seed only into a FRESH database (reset first). The base seed is NOT
   idempotent and DELETES `Element` rows (see the solutions doc above).
2. Eval fixtures AFTER the base seed:
   `PYTHONPATH=src uv run python -m manage_assistant_eval.seed --seed`
   (from `evaluation/manage-assistant/`).
3. The harness refuses to run if either layer is missing — trust that error
   message; it tells you the exact command to run.

**Known traps (each cost real debugging time):**

- Running `pnpm run check` (typegen) while the dev stack is up de-registers
  Next.js API routes (chat's `/api/manage/*` starts 404ing). Remedy: touch
  the affected `route.ts` files in-container; do NOT restart the stack.
- `pnpm run check:all` can fail flakily under full parallelism with the dev
  stack running (resource contention). If the composite fails, re-run the
  six sub-checks sequentially (`check`, `check:format`, `check:lint`,
  `check:syncpack`, `check:agents-md`, `check:prisma-sync`) — if each passes
  alone, the code is fine.
- This worktree can silently end up on a **detached HEAD**. Before every
  commit: `git status | head -2`. If detached and HEAD is a descendant of
  the branch, reattach with `git checkout -B <branch>`.
- Pushing: the PR head branch is `codex/manage-assistant-mcp-v3-ai`, which
  does NOT match the local branch name. Always push with an explicit
  refspec: `git push origin HEAD:codex/manage-assistant-mcp-v3-ai`. A bare
  push creates a stray branch that CI never sees. If SSH fails with "agent
  refused operation", push HTTPS with
  `git -c credential.helper='!gh auth git-credential' push https://github.com/uzh-bf/klicker-uzh.git HEAD:codex/manage-assistant-mcp-v3-ai`.

## Before you start: non-negotiable rules

1. **Never weaken an eval gate to make it pass.** E5 and E6 are hard gates
   (0 failures allowed). If a case seems wrong, first verify the environment
   (the harness's readiness probes exist because 7 "model failures" were
   once a half-seeded DB), then raise the case-design question — do not
   lower a threshold, delete a case, or add trials-capping to CI.
2. **Public repo.** Data-hygiene check before every commit
   (`git diff --cached` + open any staged data file): no secrets, no real
   personal data. Secret values never in chat, code, logs, or plan files.
3. **No merge of PR #5109** without explicit authority from Roland.
4. **Parked:** `packages/i18n/messages/de.ts` has an unresolved review
   thread — do not touch that file.
5. Every new MCP tool must pass the plan's §5.5 rollout gate (checklist
   below) before its slice is called done.

---

## Work items

Recommended order: **W1 → W2 → (A1 ruling) → W3 → (A2 ruling) → W4**, with
W5/W6 as fill-in work anytime. W2 is the only item that needs no ruling and
no secrets — it is the best starting point if W1's secrets are not yet
available.

### W1 — First live judge run + nightly secrets (S effort, needs Roland for secrets)

**Goal:** the judge-based dimensions (E3 grounding, E4 proposal-quality
judge, E7 graceful-message) have never scored a live turn. Execute one full
live judged run locally, fix whatever it surfaces, then wire the nightly.

**Context:** `evaluation/manage-assistant/src/manage_assistant_eval/judge.py`
builds a DeepEval `GPTModel` pointed at any OpenAI-compatible base URL. The
devcontainer's litellm gateway serves `gpt-4.1-mini` (which is also in
DeepEval's `valid_gpt_models` list) — but litellm has **no published host
port**, so a host-run harness cannot reach it directly. Known residual risk
(documented in judge.py's docstring): GEval requests logprobs; a gateway
that does not proxy logprobs faithfully will error on the first live call.

**Steps:**

1. Pick the judge route. Two options, in order of preference:
   a. Publish the litellm port to the host for the run (compose override or
   `docker compose ... port` mapping) and set
   `MANAGE_ASSISTANT_EVAL_JUDGE_API_BASE` to it, model `gpt-4.1-mini`.
   b. Use a direct OpenAI-compatible key via the `rs-infisical-operator`
   flow (ask Roland; never paste key values anywhere).
2. Run the full suite with the judge configured (README "Environment
   variables"). Expect the 18 previously-skipped judge cases to now run.
3. If GEval errors on logprobs: try a model the gateway proxies faithfully,
   or record the incompatibility in judge.py's docstring and the README and
   raise it — do NOT silently disable the metric.
4. Review judge scores case-by-case on first run (they are soft gates at
   0.85/0.90): a systematically low score usually means the rubric text in
   the case files needs tightening, not that the assistant regressed.
5. For nightly CI: ask Roland to configure the repository secrets the
   workflow reads (`MANAGE_ASSISTANT_EVAL_JUDGE_MODEL`, `_JUDGE_API_KEY`,
   `_JUDGE_API_BASE`, `_CHAT_BASE_URL`, `_APP_SECRET`, `_DATABASE_URL`,
   `_LECTURER_SUB`) pointing at a reachable deployment. Without them the
   workflow self-skips cleanly (by design).
6. Trigger `workflow_dispatch` once; verify the job summary and that the
   printed verdict is `OVERALL: PASS` (three-state: PASS requires all eight
   dimensions measured — `INCOMPLETE` means something skipped).

**Done when:** one live judged run has completed with all eight dimensions
measured; any surfaced defects are fixed or filed; nightly ran once green
via dispatch.

### W2 — X3 tracer: `live_quiz_running_list` T1 read tool (M effort, no ruling needed)

**Goal:** implement the decided (Option C) read-authZ convergence pattern
with its tracer tool: a lecturer MCP tool listing the lecturer's currently
running live quizzes.

**Context (read plan §5.1 X3 row + §5.1a first):** most GraphQL service
functions have NO internal permission check — authZ lives in the resolver
layer (`withPermission`). Calling such a function directly from an MCP tool
bypasses authorization entirely. Option C: new read tools go through the
**persisted-GraphQL client** path (as mcp-student already does), which IS
the resolver path. The tracer op `QGetUserRunningLiveQuizzes` is already
persisted, role-only gated, and its backing service function is
self-contained (scoped to `ctx.user.sub`) — the safest possible first case.

**Steps:**

1. Study the mcp-student `PersistedGraphQLClient` usage (that app is the
   working precedent) and mcp-lecturer's existing tool registration
   (`apps/mcp-lecturer/src/`).
2. Add the tool: name/description written for model selectability (plan
   §5.5 item 3 — the E1 eval measures this); payload limited to `id` +
   `name` per the X3 decision. NO pinCode-style fields ever (plan §5.1 X3
   caveats).
3. Extend the X1 CI smoke: happy path + the negative matrix
   (owned/foreign/missing/malformed) for the new tool.
4. Add eval cases: one E1 selection case ("what's currently running?"
   should select the new tool), one E3 grounding case. Run the harness
   locally — E1 must stay ≥ 0.95 with the enlarged tool surface; if it
   drops, the tool description needs work (plan A3: selection reliability
   caps value).
5. Update `docs/auth-model.md` (tool inventory + the persisted-GraphQL read
   path) and `docs/log.md` in the same PR.
6. Walk the §5.5 rollout-gate checklist (below) before calling it done.

**Done when:** tool live-verified via the chat assistant on the dev stack
(ask "which of my live quizzes are running?"), CI smoke covers it, eval
passes at full thresholds, wiki updated, gate checklist all ticked.

### W3 — Remaining T1 reads (M-L effort, GATED on Roland's A1 ruling)

**Do not start until Roland rules A1** (answer-first vs act-first — plan
§5.0). If A1 confirms answer-quality investment, implement in this order,
each as its own slice repeating the W2 recipe (persisted-GraphQL path, CI
negative matrix, E1+E3 cases, wiki, §5.5 gate):

1. `course_summary` (op exists: `getCourseSummary`, resolver-wrapped
   `withPermission(READ)` — MUST ride the persisted-op path, never a direct
   service call).
2. `activity_summary` — one tool with a `type` arg covering live quiz /
   microlearning / practice quiz / group activity summaries (all four
   backing fns are resolver-wrapped `withPermission(READ)`).

Explicitly rejected (do not implement): `course_performance_analytics`
(carries per-participant `username`+`email` — PII; plan §5.2) and
`element_usage_get` (low chat value, ADMIN-gated).

### W4 — T2 proposal-writes on existing objects (L effort, GATED on Roland's A2 ruling)

**Do not start until Roland rules A2** (diff-preview requirement — plan
§5.0/§5.3). This is design-first work: mutations of existing state need a
before/after diff preview in the proposal card and a staleness guard (the
confirm route re-reads current state and rejects if it changed since the
proposal was minted). The signing/confirm substrate already exists
(`signProposalToken`, jti claim, confirm under the lecturer's own session —
plan §5.1a correction). Candidate order when unblocked:
`element_batch_op_proposal` (best-designed backing fn; MUST preview the
exact matched id list), `tag_rename_proposal`, then
`element_update_proposal` (highest hazard — read its §5.3 row carefully).
Every T2 slice needs E4 + E5 + E7 eval cases, an X5 audit record, a feature
flag, and the full §5.5 gate.

### W5 — Small cleanups (S each, no ruling needed, good first tasks)

| # | Task | Detail |
| --- | --- | --- |
| W5.1 | httpx `verify=<str>` DeprecationWarning | `sse_client.py`/`conftest.py` pass a CA-bundle path string; switch to `ssl.create_default_context(cafile=...)`. Offline tests + one live smoke must stay green. |
| W5.2 | Langfuse MCP tool spans | Plan §3.5 / §5.5 item 8: MCP tool calls are currently inferred, not first-class spans. Add explicit spans so each tool call is visible in a trace. |
| W5.3 | P9 i18n remainder | The one open item from the prior hardening plan. NOTE: `packages/i18n/messages/de.ts` is parked under an unresolved review thread — coordinate with Roland before touching anything in that file. |
| W5.4 | Judge-model qualification note | After W1: record which judge model/gateway combo actually worked (logprobs behavior included) in the harness README so nightly configuration is copy-paste. |

### W6 — PR #5109 finish (S effort, mostly Roland)

- The GitGuardian red is inherited (rotated staging JWT in an old k6 script
  commit; the `__ENV` fix ships in a separate PR). It will stay red on every
  push until that PR merges — do not chase it here.
- Keep the PR description in sync with what the branch now contains
  (eval harness + X2b + fence fix) when it next changes.
- Merge decision, timing, and any squash strategy: Roland's call, not
  yours. Your job is keeping CI green and review threads addressed.

---

## Decision gates (Roland only — do not pre-empt)

| Gate | Question | Blocks | Current recommendation on file (plan §5.0) |
| --- | --- | --- | --- |
| A1 | Answer-first vs act-first product direction | W3 | answer-first is under-served → build T1 reads |
| A2 | Is create-card confirm enough for mutations of existing state? | W4 | no — diff preview + staleness guard required |
| A3 | Consolidate vs multiply tools | tool naming/shape in W2/W3 | consolidate; fewer well-named tools |
| A4 | Does T3 (session control/grading/roster) belong in chat at all? | any T3 idea | no — stays in direct UI |
| A5 | External MCP exposure / OAuth | any external-facing work | stay internal until a concrete consumer exists |

## Rollout-gate checklist (copy into every new-tool slice; from plan §5.5)

1. Non-goals stated.
2. AuthZ rides the shared path (X3 pattern); CI negative matrix
   (owned/shared/foreign/missing/malformed) passes.
3. Tool name/description reviewed for selectability; E1 case added, E1 ≥ 0.95.
4. E3 (reads) or E4 (writes) case added and passing.
5. E5 + E6 cases pass (hard gates, full trial counts).
6. Writes only: diff preview, staleness guard, X5 audit record, jti replay
   guard, rate limit.
7. Feature-flagged, internal-only; rollback = flag off.
8. Langfuse span visible for the tool call.

## Progress

- 2026-07-27: Roadmap created. W1-W6 scoped; W2 identified as the
  no-dependency starting point. Nothing below this line has started.
