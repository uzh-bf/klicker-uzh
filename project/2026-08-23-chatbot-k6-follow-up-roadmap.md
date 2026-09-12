# Chatbot k6 live-proof follow-up roadmap

## Identity

- Date: 2026-08-23
- Parent package: [PR #5478 k6 load-test plan](2026-08-23-pr-5478-chatbot-k6-load-test-plan.md)
- Parent suite merge: `8503c1424` (PR #5478); current remote `v3`: `2c225da0` (observed with `git ls-remote` during reconciliation; the local tracking ref remains `35142c81` because this worktree cannot write `.git/worktrees/chatbot-k6-load-test/FETCH_HEAD`)
- Scope: the two approved lecturer-demo chatbots only; this roadmap does not own Doc Query W5e, provisioner work, or reingestion
- Owner: the planning task; W1 and W2 execution completed in this task

## Goal and terminal condition

Establish values-free live proof for the merged chatbot HTTP and authenticated-turn suite, STG first and PRD second. The package is complete when both environments have an accepted bounded result, or when a documented environment-specific blocker is handed back. This roadmap does not send lecturer communications or perform deployment, merge, cluster, database, configuration, secret, or cleanup actions.

## Baseline

The suite is already published on `v3` and its static checks and final review are complete in the parent plan. The load-test paths are unchanged from the parent merge. The parent plan deliberately withheld live login, chatbot/provider traffic, and production activity. No k6-owned roadmap or active orchestrator was found before this follow-up. The current task worktree has a user-owned `AGENTS.md` modification and a stale local tracking ref; authoritative source delivery remains the merged remote revision, not this dirty checkout.

## Non-negotiable evidence contract

- Keep only request status, pass/fail booleans, counts needed for thresholds, and timings. Do not retain answer text, question text, response bodies, tokens, credentials, or provider payloads.
- Use the merged scripts and their built-in safety guards. The user confirmed no direct participant token exists in Infisical and approved normal login with `KLICKER_TESTSTUDENT_USERNAME`/`KLICKER_TESTSTUDENT_PASSWORD` injected through the approved operator profile. Normal login performs one `lastLoginAt` write; never print or commit credential or cookie values.
- Run the merged full anonymous smoke/steady/burst profile, whose configured cap is 98 requests, with its existing latency and error thresholds. Do not substitute the eight-request smoke scenario silently.
- The runtime handoff must provide exactly two environment-specific chatbot IDs, the selected model ID, and the token source. Do not discover missing inputs through database or cluster access, lecturer communication, or guessing.
- Bind `MAX_TURNS=1`. Run chatbot one, require its checks to pass, wait 15 seconds, then run chatbot two once. Never start the second turn after an authentication, provider, or data-boundary error.
- The Tutor turns are intentional side effects: normal thread/message persistence and provider cost are allowed only for this bounded run. Do not add turns or run cleanup.
- STG and PRD are separate evidence records. PRD requires the script's explicit production opt-in and a fresh approval for that live run.

## Work items

### W1 — Bounded STG canary and one-turn proof

**Depends on:** the merged `v3` revision and an authenticated participant session or approved Infisical token source.

**Run:** verify the exact merged revision and the two handoff-supplied chatbot IDs, then use normal login through the approved Infisical injection for the authenticated preflight and one `MAX_TURNS=1` Tutor turn for each chatbot. Run chatbot one first, wait 15 seconds after its successful completion, then run chatbot two. Use no retries and stop at the first defined error.

**Acceptance:** all configured HTTP checks pass; timings remain within the suite thresholds; both chatbot turns return success booleans; no answer content or credential value is retained; the run has no unapproved external action.

**Authority gate:** explicit approval exists for live STG traffic, the two allowlisted teststudent reads from `klicker-dev`, the acknowledged login write, normal persisted chat rows, and provider cost for this bounded run.

### W2 — Bounded PRD canary and one-turn proof

**Depends on:** accepted W1 evidence and an explicit PRD live-run approval.

**Run:** repeat W1 against the two handoff-supplied PRD chatbot IDs with the production guard enabled. Keep `MAX_TURNS=1`, the full 98-request anonymous cap, one-turn-per-chatbot limit, 15-second spacing, stop conditions, and values-free evidence contract.

**Acceptance:** the PRD result is independently readable as status, boolean, count, and timing evidence; no response content, credentials, or tokens are retained; no deployment, configuration, or lecturer communication occurs.

**Authority gate:** the named execution owner must receive explicit approval for PRD traffic, one value-suppressed direct-token read from the approved Infisical environment, provider cost, and persisted chat rows. These are separate production actions and remain withheld until this gate is granted.

## Delegation map

| Workstream | Work item | Owner | Dependency and acceptance |
| --- | --- | --- | --- |
| STG live proof | W1 — bounded STG canary | Current task | Approved: STG traffic, teststudent credential injection, login write, persisted rows, and provider cost; anonymous thresholds already met by existing evidence |
| PRD live proof | W2 — bounded PRD canary | Separate execution task (proposed) | Accepted W1 plus separate PRD approval; the same success criteria must be met independently |

W1 failure stops W2. Without PRD approval, W2 remains `delivery_pending` and is not an accepted result.

## Current runtime handoff evidence

| Environment | Chatbot | Identifier | Read-only state |
| --- | --- | --- | --- |
| STG | Informatik und Wirtschaft | `bd9ef6ed-27cd-47d1-bb65-b2b852f54fa1` | Authenticated preflight passed and one Tutor turn was verified persisted; bounded anonymous result was 98/98 with zero dropped iterations |
| STG | RadioSurfVet | `66390140-2f5c-46e1-a8f4-cd466b7b4d86` | Later approved provisioning added the chatbot; read-only verification found course, disclaimer, enabled Tutor/Explainer MCP bindings, and auto-only model selection |
| PRD | Informatik und Wirtschaft | `fd497bb5-a261-5045-b77f-7038ee7e3d32` | Bounded anonymous checks passed; one Tutor turn passed all three checks after one disclaimer acceptance |
| PRD | RadioSurfVet | `b80da3f7-b958-5a80-9c2f-7f254b7b3ecc` | One focused reachability check passed; one Tutor turn passed all three checks after one disclaimer acceptance |

The approved `klicker-dev` operator profile authenticated successfully. It has no direct participant-token secret, so the user approved normal-login mode with the already-allowlisted teststudent credentials. The browser session cannot substitute for scripted authentication because cookies and session stores are out of scope.

## Reconciliation

- W1 (STG) is `live_proven` for Informatik und Wirtschaft: its anonymous plus authenticated evidence passed. RadioSurfVet was provisioned later and has readiness-only verification without new traffic in this roadmap.
- W2 (PRD) is `live_proven`: both approved chatbots passed their bounded anonymous checks and one authenticated Tutor turn each, with the required disclaimer acceptance and 15-second spacing.
- Delivery state: the parent k6 suite and this follow-up's documentation, login guidance, disclaimer helper, and roadmap are merged to `v3` through PR [#5506](https://github.com/uzh-bf/klicker-uzh/pull/5506). The obsolete temporary bridge scripts were removed before publication.
- Next W-item: none. This roadmap is closed. Any new STG RadioSurfVet provisioning, sustained load, quality evaluation, reingestion, or lecturer-facing example collection requires a new roadmap and its own approval gates.

## Explicitly not selected

A sustained or higher-volume load campaign, model-quality evaluation, reingestion, and lecturer-facing example collection are separate packages. They require their own scope, thresholds, data-retention decision, and approval; this roadmap does not expand into them.

## Progress

- 2026-08-23: parent package merged as PR #5478; static and final review complete.
- 2026-08-23: planner review required `MAX_TURNS=1`, direct-token gates, complete runtime inputs, and an explicit delegation map; those corrections are recorded here.
- 2026-08-23: current `origin/v3` is `35142c81`, the STG promotion of the merged suite; the parent load-test paths are unchanged.
- 2026-08-23: existing coordinator evidence covers the bounded anonymous checks; no duplicate anonymous traffic was sent in this continuation.
- 2026-08-23: read-only browser and operator preflight found an authenticated STG session, no STG RadioSurfVet identifier, and no allowlisted direct participant-token secret. No Tutor request, provider call, database write, secret read, deployment, merge, cluster action, or cleanup was performed.
- 2026-08-23: user confirmed Infisical holds only participant credentials (no participant token), approved normal-login mode, and activated this roadmap as a goal. W1 execution may now start within its bounded contract.
- 2026-08-23: STG Informatik und Wirtschaft authenticated preflight passed 2/2 checks (p95 199 ms, p99 202 ms) using the Infisical-injected teststudent normal login. The single bounded Tutor turn (MAX_TURNS=1, selected model auto) was launched, but its console output was lost to an interrupted turn. Completion was then verified read-only: no k6 process remains, and the teststudent STG thread list shows a Tutor-mode conversation whose title matches the script's default question string exactly. Only statuses, booleans, counts, and timings were retained; the browser auto-review denial of opening the thread itself was respected without workaround.
- 2026-08-23: dedicated search found no recorded STG RadioSurfVet course PIN in any handoff, plan, worktree, memory summary, or rollout summary (values-free policy records PIN presence booleans only). W1 remains open solely on that user-supplied input; the logged-in STG tab sits on the join page.
- 2026-08-23: user authorized one values-free DB read of the STG PIN. Read-only Prisma query against the STG backend-graphql pod returned zero chatbots matching RadioSurfVet/Radio/Surf/Vet; only Informatik und Wirtschaft exists among demo chatbots. The STG RadioSurfVet chatbot does not exist in this database. W1 is therefore complete with Informatik und Wirtschaft as the sole available demo chatbot; the missing-chatbot finding replaces the PIN blocker. No writes, deployments, or cluster mutations occurred.
- 2026-08-23: user approved the PRD live run (W2). First IuW Tutor attempt returned HTTP 404; source inspection traced this to a missing disclaimer acceptance row for the teststudent. A values-free disclaimer-acceptance helper was added and used once per chatbot before retrying. After acceptance, both Tutor turns passed all three checks (IuW 11.62 s, RSV 11.72 s) with 15-second spacing, no retries, no extra turns. All evidence values-free.
- 2026-08-23: Phase 5 reconciliation completed. Remote `v3` currently resolves to `2c225da0` via `git ls-remote`; the worktree fetch was blocked by an unwritable `.git/worktrees/chatbot-k6-load-test/FETCH_HEAD`, so the local tracking ref was not treated as current. W1 and W2 are both `live_proven`; the parent suite remains delivered through its existing merge/promotion path. The roadmap and three auxiliary scripts remain local and uncommitted; no push, merge, deployment, or cleanup occurred. No next W-item is named; the roadmap is closed.
- 2026-08-24: post-publication reconciliation completed after PR #5506 merged. Remote `v3` resolves to `b02c0c43` via `git ls-remote`. Read-only STG Prisma verification found both demo chatbots ready: Informatik und Wirtschaft and later-provisioned RadioSurfVet each have an active course, disclaimer, enabled Tutor and Explainer MCP bindings, and auto-only model selection. This closes the earlier missing-STG-chatbot finding without new traffic.
