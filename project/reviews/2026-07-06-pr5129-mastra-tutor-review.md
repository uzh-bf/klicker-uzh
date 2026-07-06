# Review: PR #5129 — Mastra tutor architecture + TutorBench evaluation

- **Date:** 2026-07-06
- **Reviewer:** Claude (Fable 5), on behalf of Roland Schlaefli
- **Scope:** `packages/chat-engine/src/tutor/*`, tutor wiring in `apps/chat-api`, the `TutorEvent` Prisma migration, the memory privacy gate, the MathTutorBench/Generic-TutorBench harnesses under `scripts/eval` + `project/evals`, CI/dep changes, and the research/plan docs.
- **Stacking:** base = `codex/mastra-chat-openrouter-smoke` (PR #5126). Treat as WIP until #5126 is re-scoped and merged; do not merge out of order. The review of #5126 lives at `project/reviews/2026-07-06-pr5126-mastra-chat-api-review.md` on that branch.
- **Verdict:** The research→code translation is genuinely good — explicit pedagogical move policy, hidden turn-state planning, event telemetry, a deny-by-default memory gate with an ADR. What actually executes, however, is a **telemetry + prompt-shaping MVP**: the named Mastra workflow never runs, the "verifier" only logs after the answer has already streamed, and the eval scores are regex/keyword heuristics. All of that is a defensible phase 1 — but the naming and PR framing oversell it, and the rollout-gate metrics cannot be trusted until the heuristics get false-positive tests. Ordered roadmap at the end.

## How this review was produced

- Full trace of the live request path in `apps/chat-api/src/index.ts` (tutor branch) against every `tutor/*` module; wired-vs-dormant table below.
- Deep review of `scripts/eval/run_generic_tutorbench.ts`, `chat_api_openai_proxy.ts`, `run_mathtutorbench.ts` (reproducibility, scoring, dry-run semantics, error handling, docs-vs-CLI).
- Migration SQL, `TutorEvent` payload sources, seed diff, `.syncpackrc.mjs`/lockfile/workflow diffs read directly.
- Local verification in a fresh worktree of this branch:
  - `pnpm --filter @klicker-uzh/chat-engine test` → **11/11 pass** (`tests/tutorPolicy.test.ts`).
  - `pnpm --filter @klicker-uzh/chat-engine build` → OK.
  - `pnpm --dir apps/chat-api exec tsx ../../scripts/eval/run_generic_tutorbench.ts --dry-run --run-id review-dry --max-cases 3` → runs, deterministic summary (0.25/case), `dryRun: true` in summary.
  - `pnpm --filter @klicker-uzh/chat-api check` → fails in a fresh worktree until dep packages are built (turbo `^build` handles it; the PR-body commands assume a built repo).

## Wired vs dormant (what actually runs on a live tutor request)

| Module | Live? | Evidence |
| --- | --- | --- |
| `tutorState.ts` planner (`planTutorTurnState`) | **wired** | called per tutor-mode request, `apps/chat-api/src/index.ts:~740` |
| `policy.ts` move policy | **wired** | via `composeTutorInstructionsSuffix` → prompt suffix |
| `verifier.ts` preflight | **wired, advisory** | folded into the prompt, never blocks |
| `verifier.ts` post-hoc (`verifyTutorOutputText`) | **wired, log-only** | runs after the stream finished; failures → `console.warn` + `TutorEvent` |
| `tutorEvents.ts` logging | **wired** | ~7 call sites, best-effort try/catch |
| `memoryGate.ts` + `mastraMemory.ts` | **wired but off** | requires 5 env flags, all default false (per ADR — correct) |
| `observability.ts` attributes | **wired** | feeds console/event payload, not real OTel spans |
| `workflow.ts` `tutorTurnWorkflow` | **fully dormant** | only reference outside its own file is its test (`chat-engine/src/index.ts:68` export, `tests/tutorPolicy.test.ts:24,183`) |

## Findings

Severity: P0 = blocks merge/production, P1 = fix before any pilot/gate decision, P2 = should fix, P3 = nit.

### Architecture

- **T1 (P1) — the named architecture doesn't execute.** `packages/chat-engine/src/tutor/workflow.ts` (the 5-step Mastra `createWorkflow` pipeline: collect_context → retrieve_evidence → select_move → verify_candidate → persist_and_log) is exported and tested but never imported by the request handler — `apps/chat-api` re-implements the same steps as flat sequential calls. Two parallel implementations of "the pipeline" will diverge.
  **Do:** delete `workflow.ts` (recommended for now — the flat path is what's proven) or wire it as the actual execution path. Do not keep both. If deleting: remove the export from `chat-engine/src/index.ts:65-69` and the workflow assertions in `tests/tutorPolicy.test.ts`, run `pnpm --filter @klicker-uzh/chat-engine test`.
- **T2 (P1) — "verifier" is telemetry, not a safety control.** `verifyTutorOutputText` runs **after** the full answer streamed to the student; failures are logged to `TutorEvent`, nothing is blocked or redacted. `project/rollout/tutor-rollout.md` correctly lists blocking mode as a non-goal — consistent — but the PR title/body language ("verifier checks") reads like a control.
  **Do:** rename in docs/PR body to "post-hoc output checks (log-only, phase 1)". Keep blocking mode as an explicit phase-2 item in the rollout doc.
- **T3 (P1) — leakage/citation heuristics have no false-positive tests, but rollout gates depend on their rates.** `verifier.ts:104` (`asksForFinalAnswer`) and the `hasAnswerLeakageLikeText`/`hasCitationLikeText` regexes trip on legitimate tutoring language ("let's check the final step of the solution") and on any page number/URL mention with zero retrieval. `tests/tutorPolicy.test.ts` covers true positives only. If false positives inflate `answer_leakage`/`unsupported_citation` counts, the pilot gate "no increase in leakage failures" is meaningless.
  **Do (junior task, ~half a day):** add a negative test block to `tutorPolicy.test.ts` — ≥10 realistic math/finance assistant answers containing "solve/final/solution/Lösung", worked steps, page references *with* retrieval present — assert no failure flags. Tune regexes until green. Only then use failure rates in dashboards.
- **T4 (P2) — "citation fidelity" doesn't check fidelity.** `verifier.ts:157` flags citation-like text only when `retrievedEvidenceIds.length === 0`. A model citing `chunk-999` when only `chunk-1` was retrieved passes. Rename the failure to `citation_without_retrieval`, and add ID-matching when structured retrieval traces exist (see T10).
- **T5 (P1, privacy) — the planner call inherits the Responses-API `store` flag.** `apps/chat-api/src/index.ts:~750` passes `getOpenAIResponsesStore()` into the tutor-state planner call. With `CHAT_OPENAI_STORE_RESPONSES=true` (shared Azure backends), the hidden pedagogical state (misconception labels, hint depth) is retained provider-side — outside the ADR's privacy story, which only covers `TutorEvent` and Mastra memory.
  **Do:** hardcode `store: false` for the planner call (it never needs tool-call continuation), or document the exposure in the ADR explicitly.
- **T6 (P3) — heuristic duplication.** Four near-copies of the "does this ask for the final answer" regexes across `tutorState.ts`, `tutorEvents.ts`, `verifier.ts`. Consolidate into one exported helper so tuning (T3) happens once.

### Prisma / privacy

- **T7 (P1) — participant deletion leaves TutorEvent payloads behind.** Migration is clean and additive (good indexes, `payload JSONB`), but `participantId` is `ON DELETE SET NULL`: deleting a Participant orphans the rows instead of removing them, and payloads include summaries of student messages (`summarizeTutorUserMessage`). The ADR (`project/adr/2026-06-17-tutor-memory-privacy-gate.md`) promises 180-day retention — nothing enforces it; no hatchet job exists.
  **Do:** (a) add a hatchet cron task deleting `TutorEvent` rows older than 180 days; (b) on participant deletion either cascade-delete tutor events or scrub `payload` — pick one and record it in the ADR. Verify with a seeded participant: delete, then query `TutorEvent` remnants.
- **Positive:** memory gate is deny-by-default behind 5 env flags (all off), Mastra memory fully dormant, `TutorEvent` writes are genuinely append-only (no update path). The ADR is the right artifact — it just needs the retention enforcement to exist.

### Evaluation harness

- **T8 (P1, framing) — scores are structural, not pedagogical.** `run_generic_tutorbench.ts` scores entirely via regex/keyword heuristics (`scoreRubric`, keyword `.includes()` coverage) — no LLM judge anywhere. Keyword coverage is gameable by stuffing terms. The `averageNormalizedScore=0.5833` in the PR body is a plumbing signal, not a quality claim (the `tutor-generic` README already says so — good; the PR body should too). MathTutorBench mode is faithful (it shells to upstream `main.py`), the Generic adaptation is an honest from-scratch proxy.
  **Do:** mark semantic criteria (`pedagogical_move`, `scaffolding_quality`) as `manual_review` like the others, or add an LLM-judge scorer; until then, never gate a rollout decision on `averageNormalizedScore`.
- **T9 (P2) — harness robustness.** Three concrete defects: (a) dry-run scores an empty string through the real rubric and writes real-shaped numbers into `cases.jsonl` (only `summary.json` carries `dryRun: true`) — write `score: null` per case instead; (b) no per-case try/catch — one timeout/malformed chunk kills the whole batch and loses all prior results — wrap the per-case `callChatApi`, record the failure, continue; (c) default model `local-e2e-model` doesn't exist — require an explicit model for non-dry runs. No seed/temperature enforcement in the generic runner; record both in `manifest.json`.
- **T10 (P2) — retrieval evidence is aspirational.** `retrievalTraceStatus` is hardcoded `'unavailable'` in the runner while `project/evals/tutor-rag/retrieval-contract.md` describes a `fixture`/`real` lifecycle. Self-acknowledged; the "Next Slice" in the PR body (upgrade the local MCP stub to finance fixtures, mark runs `fixture`) is exactly right — do that before any grounding-quality claims.
- **T11 (P2) — case volume is plumbing-scale.** 3 rag cases, 3 generic, 7 local structural. Case *quality* is high (realistic WACC/CAPM misconceptions, gold diagnosis + gold next-move + rubric per case — a good schema). But no gate decision or prompt-variant comparison is statistically meaningful at n=3.
  **Do:** grow to ≥20 per domain before comparing prompt variants; source from real course questions (the Mat Vorkurs / BF course pools) rather than inventing more.
- **Positive:** the new `tutor-structural-evals.yml` workflow is path-filtered, **blocking** (no `continue-on-error`), and cheap — this is the model the #5126 smoke should follow. `.gitignore` of `project/evals/results/*` is correct hygiene.

### Dependencies / CI

- **T12 (P2) — zod v3/v4 split is pragmatic but the syncpack ignore is too broad.** `chat-engine` moves to zod `4.3.6` while `chat-api` and the rest stay on `3.25.76`; `.syncpackrc.mjs` now ignores **all** zod version mismatches repo-wide, so syncpack will never flag a future accidental drift in unrelated packages.
  **Do:** scope the ignore to the packages that legitimately differ (syncpack supports `packages: [...]` on version groups), and check that `chat-engine`'s public API exports no zod v4 schema types that a v3 consumer would `instanceof`-check (quick grep: `grep -rn "z\." packages/chat-engine/src/index.ts`).
- **T13 (P3) — `check-types.yml` grows another hand-ordered build step.** `cd ../chat-engine && pnpm run build` appended to a manual dependency chain — third entry now. Symptom of not using turbo for the CI typecheck. Fine for this PR; file a follow-up to replace the manual list with `pnpm turbo run check`.
- **T14 (P2) — `--no-verify` commits.** The PR body admits hooks were skipped due to unrelated noise. Acceptable during development, but before merge run the full local gate once (`pnpm run check:all && pnpm run build`) and paste the result into the PR.
- **Positive:** new deps exact-pinned (`@mastra/memory 1.20.5`, `@mastra/pg 1.12.1`, `zod 4.3.6`), lockfile delta modest (+188 lines), no unpinned ranges introduced.

### Docs / repo hygiene

- **T15 (P3) — plan sprawl.** 13 chat/tutor/mastra plan documents now sit in `project/plans_wip` on this branch (five of them mastra/tutor-specific, two dating from the prototype phase and superseded). `docs/llm-tutoring-research` itself is fine (18 files, 224K — reasonable to keep in-repo).
  **Do:** move superseded plans (`PLAN-chat-mastra-prototype.md`, `2026-06-14-mastra-prototype-A2-findings.md`, and any plan fully absorbed into `2026-06-17-mastra-tutor-implementation-plan.md`) to `project/plans_archive/` with a one-line "superseded by X" header.

## Production-readiness roadmap (ordered)

Do these in order; each has its own verification. Steps 1–4 are prerequisites for any pilot; 5–8 are prerequisites for trusting the metrics the pilot produces.

1. **Land the base first.** #5126 must be re-scoped and merged (see its review file) before this PR's diff is reviewable in final form. Keep this PR stacked and rebased.
2. **Kill the dormant workflow** — T1. Verify: `grep -rn tutorTurnWorkflow` returns nothing; chat-engine tests green.
3. **Privacy fixes** — T5 (planner `store: false`), T7 (retention job + deletion behavior). Verify: provider request logs show `store:false` on planner calls; deleting a seeded participant leaves no readable tutor payloads; hatchet cron visible in the worker registry.
4. **Honest labeling** — T2, T8. Update PR body + rollout doc wording ("log-only checks", "structural scores"). Verify: no doc claims blocking verification or measured teaching quality.
5. **Heuristic trust** — T3, T4, T6. Verify: new negative-case test block green; consolidated helper is the single regex source.
6. **Harness robustness** — T9. Verify: a live 3-case run with one forced timeout still writes 2 scored cases + 1 failure record; dry-run rows carry `score: null`.
7. **Fixture-backed retrieval slice** — T10, exactly as scoped in `project/evals/tutor-rag/retrieval-contract.md` (finance fixtures in the MCP stub, `retrievalTraceStatus: "fixture"`, 3-case smoke against real `apps/chat-api`). Verify: run artifacts show `fixture` status, forbidden-citation count 0. Do **not** provision LightRAG/Milvus from this branch.
8. **Scale the datasets** — T11 (≥20 cases/domain from real course material), then a first prompt-variant comparison (baseline vs `tutor-skills-v1` vs ZPD) with manual review of semantic criteria.
9. **Deps/CI cleanup** — T12, T13, T14, T15. Verify: syncpack scoped, one full `check:all` pass recorded in the PR.
10. **Pilot gate.** Only after 1–8: enable tutor mode for one course in staging, dashboards on `TutorEvent` rates (now trustworthy), 2-week observation, then decide on verifier blocking mode as phase 2.

## What is good (keep it this way)

- The wired pipeline (plan → policy suffix → post-hoc checks → events), with everything risky behind env flags that default off, is the right phase-1 shape — observation before intervention.
- The memory-gate ADR, the retrieval-contract-first approach, and the explicit "don't claim live grounding quality from fixtures" boundary in the PR body show unusual epistemic discipline; the roadmap above mostly asks the code and the labels to catch up to that discipline.
- The eval case schema (gold diagnosis / gold next-move / rubric / allowedDisclosure) is a solid foundation — the problem is volume and scorer semantics, not design.
- `tutor-structural-evals.yml` is a model CI gate: path-filtered, blocking, no live-API dependency.
