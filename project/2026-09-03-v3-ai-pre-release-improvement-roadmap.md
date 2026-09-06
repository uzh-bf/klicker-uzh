# v3-ai pre-release improvement roadmap (G2 execution breakdown)

Device-transfer checkpoint (2026-09-06): publish the current roadmap and its
historical generation proposal artifacts on the existing roadmap branch as a
draft. The user explicitly requested pushed draft PRs to continue on another
device. Source qualification, current-owner reconciliation and release gates
remain open; no merge, integration or deployment is authorized. The active
generation execution contract is on PR #5777, not the archived proposal copies.

Review status (2026-09-04): taken back into the main consolidation task.
The source and instruction corrections below supersede the 2026-09-03
snapshot where stated. Existing product decisions remain binding. Individual
implementation packages still require a current owner/base check and their
normal plan review; this document does not certify release readiness.

## 1. Identity

- Date: 2026-09-03
- Author: v3-ai consolidation orchestrator session (expert tier), on custody
  branch `rs/v3-ai-production-readiness`
  ([PR #5663](https://github.com/uzh-bf/klicker-uzh/pull/5663), targets
  `v3-ai`)
- Parent plan:
  [2026-08-29 production-readiness roadmap v4](./2026-08-29-v3-ai-production-readiness-roadmap-v4.md)
  ("v4" below). This document is the detailed, junior-executable breakdown of
  v4 §7 (G2 normalization stack N1–N6) plus the DRY, design, and repository
  hygiene candidates assessed alongside it. The orchestration contract below
  distinguishes release requirements from optional cleanup for the 3.4.0 AI
  release. It references v4, the
  [2026-08-28 roadmap](./2026-08-28-v3-ai-production-readiness-roadmap.md)
  ("v3 roadmap" below, for the target migration chain and proofs), ADRs in
  [docs/adr/](../docs/adr/README.md), and `docs/solutions/`. It never
  restates their decisions.
- Scope of the review behind it: `origin/v3-ai` at `fa7e707bdf` versus
  `origin/v3` at `5906ef19c4` (merge-base `de7138715f`; `v3-ai` 117 commits
  ahead, `v3` 10 ahead). Six read-only review passes: data model and
  migrations, backend services and workers, chat and MCP apps, frontend and
  e2e, repository hygiene and merge readiness, prior art. Every claim in §3
  was re-verified by the author against the tree.

> Audience: a junior agent or developer picking up one W-item without any
> session context. Read [CONTEXT.md](../CONTEXT.md),
> [docs/domain-model.md](../docs/domain-model.md), and
> [docs/async-and-workers.md](../docs/async-and-workers.md) first. Every
> W-item has Do/Check steps, a working context, and an authority line. When a
> W-item and v4 disagree, v4 wins; when v4 and this file both point at an ADR,
> the ADR wins unless §7 records that the ADR is being amended.

### Orchestration contract

| Field | Content |
| --- | --- |
| Goal and terminal | Prepare the existing `v3-ai` work for the first AI release into stable `v3`. The required normalization packages are W4 — lifecycle services, W5 — KB revisions, W6 — graph/generation normalization, W7 — response-example normalization, W9 — selected usage envelope, W8 — participant practice, then W11 — migration-tail rewrite and proofs. W1 — repository hygiene and W2 — backend consolidation block that path only for a demonstrated safety issue or a named prerequisite. Broad W1–W3 cleanup is not automatically a release gate; W3 — app consolidation and W10 — MCP shared core require explicit inclusion or a demonstrated release blocker. A draft or `pr_ready` PR alone does not satisfy normalization. The overall release continues through v4 §§9–14: integrated core, cutoff, qualified RC, reviewed merge into `v3`, and the release equality proof. |
| Mode and boundary owner | The main consolidation task owns Phase 5 review and §10 Progress. The `rs-roadmap-orchestrator` references below describe that responsibility, not a required installed skill or a separate owner. Executors return evidence to this task. |
| Question channel | Orchestrator by default. A junior that hits an unlisted decision stops, writes the question into its execution plan's Progress, and returns `NEEDS_CONTEXT`; it does not interview the user directly. |
| Authority layers | Granted to juniors: worktree creation under `trees/`, in-scope edits, in-container checks, local commits, pushing their own task branch, opening or updating their own draft PR against `v3-ai`. Withheld from juniors and from the orchestrator (user only): merging any PR, writing `STG_PROMOTION_PAUSED`, rulesets, tags, any `v3`↔`v3-ai` merge or rebase, ArgoCD or staging actions, destructive resets, changes to secrets or Infisical, edits inside other tasks' worktrees. |
| Writer budget | At most three writers only after exact path ownership proves independence. W2 — backend consolidation and W3 — app consolidation both touch shared packages; their broad directory lists do not prove disjointness. W4 — lifecycle services overlaps backend services and workers and must follow the relevant backend changes. Serialize schema changes in W5–W9 and W11 — migration-tail rewrite. W10 — MCP shared core is schema-free and remains separately gated. |

## 2. How to work on this

Repository: `uzh-bf/klicker-uzh`. Base for every W-item: the **current
`origin/v3-ai` head at the moment the worktree is created**, never a
hard-coded SHA. Record the exact base SHA in the W-item's execution plan and
in the boundary candidate. Never use `v3` as a base or a PR head.

Before setup, audit `git worktree list --porcelain` and reuse the existing
owner's branch or worktree. For a genuinely new package, record a
purpose-based `rs/<slug>` branch, its exact base, and a repo-local worktree
path. The W-number paths below are historical suggestions, not reservations.
Use the current repository worktree and runtime instructions rather than
assuming a branch-to-hostname transformation.

Start a runtime only when the package needs one. Documentation and source
inventory do not require an application stack. When runtime verification is
needed, use `$rs-local-runtime-lifecycle` and the current `devrouter` skill
to start or reuse the exact worktree and the smallest applicable profile.
Do not reinstall dependencies when the existing environment already satisfies
the pinned toolchain.

Run builds, unit tests, Prisma, and type checks **inside the container**
through `devrouter exec <checkout> -- <command>`. Run Playwright on the
host with `pnpm playwright:host -- <args>` against that container's routed
apps. Git and `gh` remain host tools. Select checks from the changed seam;
the following are available checks, not a mandatory full-suite loop for
every documentation or mechanical change:

```bash
devrouter exec trees/<branch> -- pnpm --filter @klicker-uzh/graphql generate
devrouter exec trees/<branch> -- pnpm run check
devrouter exec trees/<branch> -- pnpm run format:check
devrouter exec trees/<branch> -- pnpm run lint
devrouter exec trees/<branch> -- pnpm run test:run
```

Schema-changing items additionally run, in this order (all inside the
container, where the database URL is already injected; the non-`:raw` prisma
scripts wrap Infisical and do not work there):
`pnpm --filter @klicker-uzh/prisma run prisma:migrate:raw -- --name <name>`
with the migration name the W-item prescribes (this runs `prisma migrate dev`
and regenerates the client), `pnpm run prisma:sync`, `pnpm --filter
@klicker-uzh/graphql generate`, then the loop above. Rebuild dependents before
browser checks.

Browser verification for anything touching `apps/frontend-manage`,
`apps/frontend-pwa`, or `apps/chat` uses `agent-browser` against the linked
worktree URLs `https://<app>.klicker.<workspace>.localhost` with the seeded
`lecturer`/`abcd` delegated login (see `.agents/skills/agent-browser/SKILL.md`).
Prove hydration first (§5).

Branch and PR conventions: purpose-based branch `rs/<slug>`; conventional-commit
messages with the smallest accurate type (`refactor`, `docs`, `chore`, `feat`
only for new behavior); draft PR targeting `v3-ai`; PR body written with
`$rs-mr-description-writer` covering the whole branch. Commits made with
`--no-verify` must be disclosed in the PR body. No attribution lines in
commits or PR bodies. Public repository: no secret values, no personal data,
no internal hostnames or tenant identifiers, ever.

Each W-item is executed as one `$rs-sliced-development-workflow` plan written
by the junior in the same `project/` directory
(`project/YYYY-MM-DD-<w-item-slug>-plan.md`), with its own Progress section.
Schema-changing items cross the data-integrity risk boundary and therefore
get a `slice-reviewer` pass per committed slice and a `final-reviewer` pass
before `pr_ready`.

## 3. Historical baseline (verified 2026-09-03)

This table records the original review baseline. Use §3.1 and fresh source
reads for execution; line numbers, owner status, and PR titles can change.

| Item | State | Evidence |
| --- | --- | --- |
| Custody receipt | committed locally, not pushed | `b61ea7509a` on `rs/v3-ai-production-readiness`, 1 ahead of `origin` |
| `v3`→`v3-ai` merge readiness | 11 conflicting files | `git merge-tree --write-tree origin/v3 origin/v3-ai`: `.agents/skills/klicker-frontend-ui/SKILL.md`, `.agents/skills/klicker-graphql-api/SKILL.md`, `.agents/skills/klicker-testing-verification/SKILL.md`, `docs/async-and-workers.md`, `docs/domain-model.md`, `docs/frontend-conventions.md`, `docs/graphql-api-layer.md`, `package.json`, `packages/graphql/src/public/schema.graphql`, `packages/graphql/test/helpers.ts`, `packages/hatchet/src/index.ts`. Clean: `deploy/`, `.github/`, `docs/adr/`, `turbo.json`, `pnpm-lock.yaml`. |
| Migrations on `v3-ai` absent from prod tag `v3.4.0-alpha.73` | 10 directories, in three classes | Computed with `git diff --name-only v3.4.0-alpha.73 origin/v3-ai -- packages/prisma/src/prisma/schema/migrations/`. **v3-ai-only (W11 squashes these, 7):** `20260726184305_assistant_proposal_audit`, `20260822090256_response_examples_foundation`, `20260823120459_ai_features_enabled`, `20260825190000_kb_management_foundation`, `20260826140000_kb_graph_generation_bundle`, `20260826190000_element_generation_cost_accounting`, `20260831165143_kb_resource_material_type`. **Already on `origin/v3`, not yet released (W11 must leave these untouched, 2):** `20260822075407_chat_account_usage`, `20260826012006_chat_turn_lifecycle_claim`. **On `origin/v3` but not yet on `v3-ai` (arrives with the A2 sync, stays as-is, 1):** `20260902100000_course_deletion_request`. Hand-written SQL that generation will not reproduce: partial unique index in `kb_management_foundation` (:236–239), CHECK constraints in `kb_graph_generation_bundle` (:85, :87, :89, :135–139, :152) and `element_generation_cost_accounting` (:35, :37), `gen_random_uuid()` default (`element_generation_cost_accounting:17`); `assistant_proposal_audit` has none. W11 must re-verify these line numbers against the tree it squashes. |
| ADR numbering | two collisions | Custody HEAD tracks both `docs/adr/0028-one-response-example-set-has-run-scoped-roles.md` (from `v3-ai`) and `docs/adr/0028-short-lived-qualified-rc-branch-for-ai-releases.md` (added by PR #5663). `0003` is doubled on `v3` itself (`0003-chat-framework-upgrade.md`, `0003-promote-stg-via-release-annotation-write-back.md`). Highest number on both remotes: `0042`. |
| ADR index | incomplete | `docs/adr/README.md` on `v3-ai` lacks entries for 0010–0015, 0017, 0028–0036, 0038 (files exist). |
| ADR-0026 / ADR-0027 | not on any remote | v4 §6 cites `PersonalElement` per ADR-0026 and the generation contract per ADR-0027 for N5. Neither file exists on `origin/v3` or `origin/v3-ai`; they exist only as untracked files in the primary checkout of another session (branch `docs/chatbot-hitl-config-roadmap`). |
| Response-example `digest` | has runtime consumers | v4 D2 calls it consumerless. It is written in `packages/graphql/src/services/responseExamples.ts:116` and `apps/chat/src/lib/server/responseExampleRuntime.ts:193`, read at `responseExampleRuntime.ts:377,383` as `setDigest`, and consumed by the chat route at `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts:1166`. ADR-0028 (response examples) requires each evaluation run to capture the set content "and its digest". |
| `KBResource.materialType` | on `v3-ai` | Landed on `v3-ai` as commit `a0e32ade05` ("enhance: add bulk ingestion and material categories (#5710)", 2026-09-03). PR #5710 was merged into the #5709 branch `rs/question-generation-review-inbox`, and that commit was then brought onto `v3-ai` directly; #5709 itself is still open against `v3`, so its remaining content is not on `v3-ai`. Schema `knowledge.prisma:131`, migration `20260831165143_kb_resource_material_type`. N2 absorbs it; no separate normalize-in needed. |
| Data model duplication | present | `knowledge.prisma`: `KBGraphBuild` holds status, artifacts, and inline cost fields; `ElementGenerationSpend` duplicates the cost shape; `KBGraphQuota` is a general quota misnamed by domain; `KBResource` denormalizes `KBIngestionRun` state; `ElementGenerationBuild` has 8 `Json?` artifact columns plus both `status` and `stage`; mixed id strategies; three difficulty notions. `chat.prisma`: `ResponseExampleSet` 1:1 wrapper with `digest` (:234); `ResponseExample.reviewedById` without a relation. |
| Backend duplication | present | Five near-identical advisory-lock helpers in `packages/graphql/src/services/knowledge.ts` (:437, :456, :475, :493, :514). In-flight status literal sets re-derived in `knowledge.ts:1173,1240,1743` and `kbIngestion.ts:185,229,385,474`; terminal sets in `kbMaintenance.ts:55-64`. Hatchet task retries inconsistent in `packages/hatchet/src/index.ts` (`retries: 3` at :132, :161, :189; none on cron tasks :426, :437, :454). Eleven separate Azure blob-client construction sites across `packages/graphql`, `packages/kb-management`, `apps/chat`. `apps/mcp-lecturer/src/jwt.ts` duplicates `packages/util/src/jwt.ts`; MCP auth literals triplicated with `apps/chat/src/lib/server/mcpAuthMint.ts:9-21`. Duck typing `'startFlashcards' in runtime` in `flashcardGenerationRuntime.ts:9-15`. |
| App duplication | present | `apps/chat/src/hooks/useEmbeddedChatContext.ts:8-9` and `apps/frontend-pwa/src/components/chatbot/CourseChatDrawer.tsx:31-32` both declare the `klicker:chat-context` message-type literals; `packages/types/src/chatContext.ts:29,35` has them only as type literals (contrast the exported constants in `packages/types/src/manageAssistant.ts:1-32`). Status-color Tailwind maps repeated in `GeneratedElementReview.tsx`, `ChatbotResponseExampleReview.tsx`, `ChatbotDetails.tsx`. AI-gate markup copy-pasted in four manage pages (`pages/resources/knowledgeBases.tsx`, `knowledgeBases/[id].tsx`, `resources/chatbots.tsx`, `elements/generate.tsx`). Chat route file is 2109 lines; duplicate helpers `isRecord` (3×), `parseJsonObject`, `getModeDescription`, `formatToolName`, `asRecord`, `noLoginRedirect` (2× each). Three `Processing` i18n keys (`en.ts:1719,1774,1849`); en/de parity holds (577 keys each). |
| Tests | partial | `packages/kb-management` has zero tests. Frontend has no component tests; flows are covered by eight `Y-*`/`B-*` Playwright specs. `GenerationStatusProvider.tsx` second timer is a deliberate timeout clock (:170), not duplication. |
| `project/` hygiene | mostly fine | 120 added files on `v3-ai`, none is private PM material. Self-superseded without marker: `2026-08-21-chatbot-response-example-design.md`, `2026-08-21-chatbot-response-examples-implementation-plan.md`, `plans_wip/PLAN-mcp-server.md`. `2026-08-22-v3-ai-reintegration-plan.md:314` names an internal feature-flag host and a saved-group identifier. 76 files under `project/screenshots/` not yet reviewed for personal data. |
| Open AI PRs | reconciled in v4 §16 and the gitignored manifest | Relevant here: #5481→#5482→#5483 (N5 source, #5483 CONFLICTING), #5668 (system-prompt version catalog, targets `v3`, open), #5709 (question-generation review inbox, targets `v3`, open). |

### 3.1 Takeover verification — 2026-09-04

Fetched refs: `origin/v3@468f05b91503b133670dda235be9a4b38bba2155`
and `origin/v3-ai@1765a2d6394fc9a3f18bddd330dda70438510e23`.
At this snapshot, `v3` has 13 exclusive commits and `v3-ai` has 131.
The existing integration PR [#5092](https://github.com/uzh-bf/klicker-uzh/pull/5092)
targets `v3` and GitHub reports conflicts. These are baseline facts, not
authority to perform a second sync. The active task **Merge latest v3 into
v3-ai** already owns the current integration; consume its resulting source
and verification before cutting dependent normalization packages.

| Area | Verified change since the original review | Consequence |
| --- | --- | --- |
| Roadmap custody | Local `7b25747b71688d890497ad9c0edf22ee76bc9d92` is three commits ahead of published PR #5663 at `283031d9f3`. The September 3 roadmap and ADR renumbering are local. | Preserve those commits and the three unrelated deleted transactional HTML outputs. This review changes only roadmap text. |
| Participant design provenance | `origin/v3` contains ADR-0026 and ADR-0027 through commit `795568a4a1155991d4f2909c5903cd15735e23b4`; the recorded `v3-ai` head does not yet contain them. | A3 — participant ADR provenance no longer needs someone to author or publish these decisions. Verify their arrival with the owned sync and reconcile existing participant PRs. |
| Resource replacement | [#5756](https://github.com/uzh-bf/klicker-uzh/pull/5756) is open at `f1e00acf830daf5792c376bb6cdbfeaf9349f1fc`, with replacement UI, version fencing, retained AI-serving identity, and one upload-ticket migration. | W5 — resource normalization must reuse this feature and its tests. Its active-serving guarantee is distinct from retaining the previous uploaded source until successful ingestion; that stronger revision contract remains to reconcile. |
| Cost controls | [#5771](https://github.com/uzh-bf/klicker-uzh/pull/5771) is open at `a1a9d4ee20899e3839c3ee14f14f08f4a7fdde57`. It covers quota feedback, account-usage freshness, and participant credit-policy authoring without a migration. | Reuse it in app/accounting work. It does not implement the neutral usage ledger or replace the accounting decision. |
| Response-example capture | [#5764](https://github.com/uzh-bf/klicker-uzh/pull/5764) is open at `d0bdd054b46d8f20df636a76adbf0eca43eb2e51`, touching capture, review UI, receipts, and response-example services. | Reconcile its consumer contract before W3 — app consolidation or W7 — response-example normalization touches the same paths. |
| Other release lanes | #5668 — system-prompt catalog and #5709 — scoped Doc Query activation remain open against `v3`; the latter's old review-inbox title is stale. **Reduce Argo staging commit churn** owns an active deployment-related task. | Read their evidence; preserve their ownership. A source branch or PR title alone does not establish what is already included. |
| Review policy | Current `origin/v3:.github/scripts/final-ai-review.js` explicitly includes `v3-ai` as an individual-review consolidation base. | The old non-default-base blocker is obsolete. Ordinary eligible PRs can use `/final-review`; native stack topology remains independently verified. |

## 4. Non-negotiables

- **Every v4 §4 decision (D1–D14) and §7 target model is binding. Do not
  re-litigate.** The only amendments this file records are in §7 (A-items)
  and are premise corrections, not reopenings.
- **No G2 schema change merges into `v3-ai` before the staging-promotion
  pause is proven** (v4 §10.1, `STG_PROMOTION_PAUSED=true`). Authoring and
  draft PRs may start earlier; merging is the user's action.
- **Merge shape:** `v3`→`v3-ai` and RC→`v3-ai` integrations follow v4 §5.1
  only (throwaway `sync/v3-<date>` branch cut from `v3`, PR into `v3-ai`,
  conflicts resolved there). Never open a PR with `v3` as head. Juniors never
  perform these integrations.
- **Schema discipline:** the smallest necessary model change; one generated
  migration per PR unless execution genuinely needs an ordered pair; generate
  with `prisma migrate dev`, never hand-write a whole migration; keep only
  unavoidable manual SQL and explain each such statement in a schema comment
  the cold reader can follow. W4 (N1) is schema-free; N2–N5 add migrations normally; **only W11 (N6)
  rewrites the tail** into the v3 roadmap's final chain.
- **Terms:** use `CONTEXT.md` and glossary terms verbatim (Catalyst, Feature
  entitlement, AI usage authorization, Publication approval, Usage class
  `BASE`/`ADVANCED`, Monthly usage budget, Usage lane, Participant usage
  credits, Auto model, Class exhaustion, Generated element draft). Never coin
  a synonym.
- **Public repository.** No secret values, personal data, internal
  hostnames, tenant or saved-group identifiers, or business material in any
  committed file, including plans and this roadmap.
- **No new dependencies, no new abstractions beyond what a W-item names.**
  A DRY item consolidates existing code; it does not introduce a framework.
- **`no new test` is a valid outcome.** Add a test only for an invariant,
  contract, or regression that existing evidence does not protect. Playwright
  `Y-*` specs are the flow coverage; do not add component tests as a
  W-item.
- **Do not touch** `GenerationStatusProvider.tsx` polling logic, the
  `evaluation/manage-assistant` harness, `deploy/`, `.github/workflows/`, or
  any file inside another task's worktree.

### Data-model and existing-business acceptance

The following requirements apply to every proposed normalization package.
They implement the user's 2026-09-04 requirement to keep the data model and
backend well formed without harming existing business logic. Each package
must show the relevant evidence before acceptance; this is not authority to
change additional domains or perform production reads or writes.

| Boundary | Required evidence |
| --- | --- |
| Canonical ownership | Map the existing and proposed owner of each changed fact, identity, relation, and state transition. Specify cardinality, uniqueness, null semantics, deletion behavior, and immutable provenance. Retain justified serving snapshots and audit records; fewer columns alone is not normalization. Reuse an existing target model or service when it already satisfies the contract. |
| One Element domain | User ruling, 2026-09-05: questions and flashcards are Element types, not separate product primitives. Generation, review and saving must compose the same Element lifecycle and business services. Keep content validation and provider-result conversion type-specific where necessary. A common module containing duplicated lifecycle or transaction implementations does not satisfy consolidation. Preserve current provider/state compatibility until a separately reviewed change replaces it; adding another supported type must not require copying the shared lifecycle. This does not authorize new supported types or changes to public behavior. |
| Backend behavior | Inventory all affected writers and consumers, including workers, maintenance, retries, imports, and administrative paths. Preserve authorization predicates, lock order, transaction boundaries, idempotency, and external-effect fencing. Separate unused reservations, settled spend, and uncertain-outcome holds. A smaller helper count or an empty grep is not acceptance evidence. |
| Existing product behavior | Trace effects on manual Element authoring, derived permissions and sharing, activity instances, course access/deletion, invitations and assessment, points and XP, and chat budgets. AI entitlement supplements ordinary access rules. `Participation.isActive` stays a leaderboard opt-in flag. Preserve the explicit instance-update operation; ordinary draft/source edits must not silently rewrite activity snapshots. |
| Schema and supported data | Use generated migrations with the minimum necessary count, preserve required custom SQL, prove Prisma/Analytics equivalence and clean public SDL generation, and check supported-data backfills for lost or orphaned links. Stable and production-applied migration bytes remain immutable. Prove the old serving application works with the new schema because migrations run before application replacement. An ordered expand/contract sequence takes precedence over a nominal one-migration target when compatibility requires it. |
| Regression and integration proof | Reuse existing tests at their actual seams; add only missing consequential checks. Compare baseline and candidate, distinguish inherited failures from new regressions, and include real database concurrency/rollback proof for changed transactional contracts. Use isolated disposable fixtures, not other tasks' databases. Record tested source and environment; local checks do not replace exact-candidate CI or RC runtime qualification. |

## 5. Known traps

- **Host/container toolchain split.** Run the configured hook-equivalent
  checks in the container when host hooks cannot use its toolchain. Inspect
  the actual hooks before bypassing them; retain the staged secret scan and
  disclose any bypass and its equivalent checks. Historical host-store
  problems do not prove that every current hook installs dependencies.
- **Linked-worktree apps look dead.** Symptom: every page renders but nothing
  hydrates. Cause: Next `allowedDevOrigins` glob misses the namespaced host.
  Remedy: prove hydration on one page before diagnosing any feature; the
  glob must be `**.localhost`.
- **Typegen 404s routes while the dev stack is up.** Symptom: after `pnpm run
  check`, an app's API routes return 404. Remedy: `touch` the affected
  `route.ts`/page files inside the container; do not restart the stack.
- **Database tests and browser fixtures.** Inspect the current test database
  routing and use isolated synthetic fixtures. A reset is not an automatic
  post-test step: confirm the exact disposable database and existing reset
  authority before destructive reseeding. Preserve any shared or owner data.
- **Stale `*.tsbuildinfo` makes rollup fail on raw TS.** Symptom:
  `Expected ',', got 'X'` from a package build after any host build. Remedy:
  `find . -name "*.tsbuildinfo" -not -path "*/node_modules/*" -delete` inside
  the container.
- **Hatchet workers under `tsx --watch` lose workflows.** Symptom: `workflow
  not found` after a file save. Remedy: run workers without `--watch` when
  testing worker behavior.
- **Historical final-review blocker.** The September 2 non-default-target
  failure no longer describes current policy: `v3-ai` is an allowed
  individual-review base. After ordinary feedback and CI settle, use the
  standing-authorized `/final-review` on eligible PRs. `/final-review-stack`
  remains limited to the top of a verified native stack; it is not a way to
  manufacture eligibility for an arbitrary base.
- **`schema.graphql` and `packages/graphql/test/helpers.ts` conflict on
  every `v3` sync.** Cause: both branches regenerate/extend them. Remedy:
  regenerate `schema.graphql` after resolving source conflicts instead of
  merging it by hand; resolve `helpers.ts` by keeping both helper sets.
- **Merge-tree evidence goes stale.** The §3 conflict list is a snapshot;
  rerun `git merge-tree --write-tree origin/v3 origin/v3-ai` before relying
  on it.
- **Sandbox quirks for agents on this host:** `git fetch` and `gh` need the
  sandbox disabled; process substitution is blocked (write to `$TMPDIR`);
  use `git -c core.fsmonitor=false` in worktrees; the shell cwd resets to the
  primary checkout after each command.

**Primitive impact:** none new. Product-primitive decisions for this scope are
owned by the v4 roadmap §4 and §6; every W-item here reshapes storage, code
structure, or migrations behind those primitives and introduces no new
primitive or user-facing contract change.

## 6. Work items

Execution follows dependencies, not numeric labels: W9 — selected usage
envelope precedes W8 — participant practice. W1 — hygiene, W2 — backend consolidation, and
W3 — app consolidation are schema-free; parallel execution requires exact
disjoint paths. W4 — lifecycle services follows the backend changes it
uses and cannot share their write paths concurrently. W5–W9 are the
schema-changing packages; serialize them with W11 — migration-tail rewrite.
W10 — MCP shared core is separately gated and schema-free.
Priority: P1 must ship in the RC; P2 should; P3 may slip to the first
post-RC train.

### W1 — repository hygiene and merge-readiness prep

- **Problem:** ADR index and numbering are inconsistent, three plans are
  silently superseded, one plan leaks an internal identifier, and 76
  screenshots are unreviewed for personal data. All of it is cheap, schema-free,
  and validates the junior pipeline end to end.
- **Do:**
  1. Regenerate `docs/adr/README.md` so every `docs/adr/NNNN-*.md` on the
     branch has exactly one index line in numeric order, title taken from the
     file's H1. Keep existing descriptions where they exist. Leave the doubled
     `0003` alone but add a one-line note under the index that both `0003`
     files are historical and intentionally kept.
  2. Do **not** rename `0028-one-response-example-set-has-run-scoped-roles.md`.
     The colliding RC-branch ADR is renumbered on the custody branch by its
     owner (§10, 2026-09-03 entry).
  3. Add a `> Superseded by …` first line to
     `project/2026-08-21-chatbot-response-example-design.md`,
     `project/2026-08-21-chatbot-response-examples-implementation-plan.md`,
     and `project/plans_wip/PLAN-mcp-server.md`, pointing at the newest plan
     that replaced each (find it by grepping `project/` for the same topic;
     judgment expected). Do not delete files.
  4. In `project/2026-08-22-v3-ai-reintegration-plan.md` around line 314,
     replace the internal feature-flag host and saved-group identifier with
     neutral placeholders (`<feature-flag-host>`, `<saved-group-id>`). Do not
     copy the removed values anywhere, including the PR body.
  5. Review every file under `project/screenshots/` for real names, emails,
     student identifiers, or course rosters. Screenshots of seeded local data
     (`lecturer`, `testuserNN`, "Testkurs") are fine. Anything real: remove
     the file and list it by path in the PR body without describing its
     content. Note that git history is permanent; removal still reduces
     exposure and is the expected action.
  6. Verify `.gitleaks.toml` allowlist for `.devcontainer/docker-compose.yml`
     covers only the well-known Azurite development key; if the file no
     longer contains it, drop the allowlist entry.
- **Check:** `pnpm run format:check` green; a script or one-liner that lists
  ADR files without an index line returns empty; `gitleaks detect` on the
  branch is clean; PR body lists removed screenshots by path (or states
  none).
- **Working context:** worktree `trees/rs/w1-repo-hygiene`, branch
  `rs/w1-repo-hygiene` from current `origin/v3-ai`, draft PR → `v3-ai`.
  Owned seams: `docs/adr/README.md`, the three plan headers, the one
  reintegration-plan line, `project/screenshots/`, `.gitleaks.toml`. Single
  writer.
- **Authority and terminal:** local commits, push own branch, draft PR;
  terminal `pr_ready`. Merge withheld (user).
- **Boundary owner:** `rs-roadmap-orchestrator`.
- **Release-note impact:** none.
- **Depends on:** nothing. **Priority:** P1 (cheap, and it is the pipeline
  validation).

### W2 — backend DRY consolidation (services, workers, MCP)

- **Problem:** Repeated status sets and infrastructure helpers can drift,
  but similar syntax does not prove equivalent behavior. The five SQL
  helpers are row locks with different authorization and lock targets;
  blob-client and JWT helpers also require a contract comparison.
- **Do:**
  1. Map the callers and contracts of the row-lock helpers in
     `packages/graphql/src/services/knowledge.ts`. Preserve ownership,
     soft-delete and KB-membership predicates, error behavior, transaction
     scope, lock order, and the exact `FOR UPDATE` target. These are not
     advisory locks and have no interchangeable namespace/key contract.
     Consolidate only demonstrated equivalent fragments; retaining separate
     helpers is a valid outcome. Verify unauthorized, concurrent, and
     deleted-resource cases before accepting a lock-related refactor.
  2. Create one module exporting the ingestion, graph-build, and
     generation-build status sets (`IN_FLIGHT`, `TERMINAL`, and per-domain
     `SUCCESS`/`FAILURE`) as `as const` arrays derived from the Prisma enums,
     and use it in `packages/graphql/src/services/knowledge.ts`,
     `packages/hatchet/src/kbIngestion.ts`,
     `packages/hatchet/src/kbMaintenance.ts`, and
     any other literal-set site a grep for the enum members finds. Place it in
     `packages/graphql/src/services/` next to its consumers unless the Hatchet
     package also needs it, in which case `packages/types`. Judgment
     expected on the file name. Do **not** merge `KBIngestionStatus` and
     `KBGraphBuildStatus` enums (ruling, §7 A-log).
  3. Compare blob-client construction sites for runtime, credential-source,
     endpoint, container, and error semantics. Share only equivalent setup
     at the smallest existing server-side seam. Preserve each caller's
     credential resolution and keep server SDKs out of browser bundles.
  4. Compare `apps/mcp-lecturer/src/jwt.ts` with
     `packages/util/src/jwt.ts` before reuse. They differ in optional
     subject typing, zero-valued expiration handling, and error logging.
     Preserve issuer, algorithm, expiry, subject, and logging contracts and
     prove rejected tokens remain rejected. Share MCP auth literals only
     after checking their semantics at each consumer. This is a bounded
     authentication review, not automatic file deletion.
  5. `flashcardGenerationRuntime.ts:9-15`: replace the `'startFlashcards' in
     runtime` duck typing with an explicit discriminant or a shared interface;
     judgment expected on which.
  6. After A2 — owned upstream sync, inspect Hatchet retry and cron
     concurrency semantics. Preserve existing behavior during this cleanup.
     Any retry change needs a demonstrated failure and replay/idempotency
     checks in the applicable lifecycle package; absence of an explicit
     retry field does not prove a bug. Do not move worker behavior changes
     into W11 — migration-tail rewrite.
- **Check:** relevant type checks, lint, existing service tests, and MCP build
  pass in-container. Tests cover the lock and token contracts actually
  touched; replay checks cover any separately justified retry change. A
  smaller helper count or a deliberately broken import is not correctness
  evidence. Record intentionally retained duplicates and their distinct
  contracts.
- **Working context:** worktree `trees/rs/w2-backend-dry`, branch
  `rs/w2-backend-dry` from current `origin/v3-ai`, draft PR → `v3-ai`. Owned
  seams: `packages/graphql/src/services/knowledge.ts`,
  `packages/graphql/src/services/flashcardGenerationRuntime.ts`,
  `packages/hatchet/src/{kbIngestion,kbGraphIngestion,kbMaintenance}.ts`,
  the selected server helpers in `packages/util` and `packages/types`,
  `apps/mcp-lecturer/src`, `apps/chat/src/lib/server/mcpAuthMint.ts`, and
  step 6 only after its gate. Single writer.
- **Authority and terminal:** local commits, push, draft PR; `pr_ready`.
  `simplifier` pass required to assess net simplification without removing
  distinct contracts.
- **Risk review:** one `slice-reviewer` covers any touched authentication,
  concurrency, or external-effect seam; `final-reviewer` covers the
  integrated package. Net reduction is a design aim, not permission to
  remove a distinct contract.
- **Boundary owner:** `rs-roadmap-orchestrator`.
- **Release-note impact:** none.
- **Depends on:** current owner/base reconciliation; W1 — repository hygiene
  only for a demonstrated blocking safety issue, not pipeline ceremony.
  Step 6 GATED on A2 — owned upstream sync. **Priority:** P2 (P1 for the
  lock-contract and status prerequisites used by lifecycle services).

### W3 — app-layer DRY (manage, PWA, chat)

- **Problem:** Duplicated message-type literals, status-color maps, AI-gate
  markup, chat helpers, and i18n keys across three apps.
- **Do:**
  1. Export `CHAT_CONTEXT_MESSAGE_TYPE` and `CHAT_CONTEXT_ACK_MESSAGE_TYPE`
     as runtime constants from `packages/types/src/chatContext.ts` (pattern:
     `packages/types/src/manageAssistant.ts:1-32`); import them in
     `apps/chat/src/hooks/useEmbeddedChatContext.ts` and
     `apps/frontend-pwa/src/components/chatbot/CourseChatDrawer.tsx`.
  2. One status-badge helper in `apps/frontend-manage/src/lib/` mapping a
     status enum member to its Tailwind classes and i18n label; use it in
     `GeneratedElementReview.tsx`, `ChatbotResponseExampleReview.tsx`,
     `ChatbotDetails.tsx`, and extend the existing `chatbotStatus.ts` rather
     than creating a parallel file if it fits. Judgment expected.
  3. One `AiFeatureGate` wrapper component replacing the copy-pasted gate in
     the four manage pages listed in §3; it must use
     `lib/hooks/useAiFeaturesEnabled.ts` only. Do not change the enablement
     semantics (feature flag AND entitlement), only the markup duplication.
     Preserve loading, temporarily unavailable, and cached-authoritative
     entitlement states. A transient fetch failure must not become an
     authoritative denial or grant; preserve the existing hook contract.
  4. `apps/chat`: move `isRecord`, `asRecord`, `parseJsonObject`,
     `getModeDescription`, `formatToolName`, `noLoginRedirect` to one shared
     module each side (server/client) and delete the copies. Do **not** split
     the 2109-line chat route beyond what removing these helpers implies; the
     route split is out of scope (A5).
  5. i18n: collapse the three `Processing` keys (`en.ts:1719,1774,1849` and
     their `de.ts` counterparts) into one shared key only if all three render
     the same word in both languages; otherwise leave them and record why in
     the PR body.
- **Check:** in-container `check`, `lint`, `format:check` green; en/de key
  parity still holds (same key count); `agent-browser` before/after
  screenshots of: one gated manage page while gated and ungated, the response
  example review inbox with each status badge, the course chat drawer sending
  context to the embedded chat (both light and dark color schemes for the
  badges). Playwright `Y-course-chat-drawer`, `Y-response-examples`,
  `Y-question-generation-review`, `Y-ai-beta-management-gate` green
  (host-run against the worktree URLs). Verify loading, temporary-unavailable,
  cached-authoritative allow/deny, and resolved allow/deny states against
  the existing hook contract, including transitions without a page reload.
- **Working context:** worktree `trees/rs/w3-app-dry`, branch `rs/w3-app-dry`
  from current `origin/v3-ai`, draft PR → `v3-ai`. Owned seams:
  `packages/types/src/chatContext.ts`, `apps/frontend-manage/src`,
  `apps/frontend-pwa/src/components/chatbot`, `apps/chat/src` (excluding
  `mcpAuthMint.ts`, owned by W2), `packages/i18n`. Single writer.
- **Authority and terminal:** local commits, push, draft PR; `pr_ready`.
  `simplifier` pass required.
- **Boundary owner:** `rs-roadmap-orchestrator`.
- **Release-note impact:** none.
- **Depends on:** current owner/base reconciliation. Parallel work with
  W2 — backend consolidation requires disjoint write paths. **Priority:** P2;
  optional unless a specific release blocker requires the change.

### W4 — N1 lifecycle services and invariant tests

- **Problem:** v4 N1. Status transitions for KB resources, ingestion runs,
  graph builds, and generation builds are written directly by resolvers,
  workers, and maintenance code, so the invariants N2–N4 depend on (one
  active revision, correctly reconciled terminal accounting, no orphaned
  external state) need a verified shared enforcement contract. Existing
  GraphQL generation/accounting and Hatchet ingestion/maintenance suites
  already cover parts of this behavior; map and extend them before adding
  tests or replacing implementations.
- **Do:**
  1. One lifecycle service module per aggregate (KB resource, ingestion run,
     graph build, generation build) at an existing server-side dependency
     seam selected by the package plan. `packages/kb-management` is a React
     UI package, not the database service owner. The workers live in
     `packages/hatchet/src/{kbIngestion,kbGraphIngestion,kbMaintenance}.ts`;
     GraphQL has the request-side services. Preserve the dependency direction
     and avoid a GraphQL/Hatchet cycle. Each exposes named transitions (`start`, `succeed`, `fail`,
     `cancel`, `expire`…) that validate the domain-specific from-state and
     perform only the side effects that transition owns (accounting
     reconciliation, active-pointer move, cleanup enqueue). Reuse shared
     status sets only when their contracts are equivalent; generation
     polling and review gates intentionally have different predicates.
  2. Route every direct `status`/`stage` write in `packages/graphql`,
     `packages/kb-management`, `packages/hatchet`, and `apps/chat` server code
     through those services. Inventory model `update`/`updateMany`, raw SQL,
     aliases, callbacks, and maintenance writes; `status:` grep alone is
     not exhaustive. List and classify the sites before changing them.
  3. Reuse the existing GraphQL and Hatchet Vitest suites; add coverage only
     for unprotected invariants: illegal transition rejected; every
     terminal transition preserves the correct settlement, ordinary release,
     or human-review hold. `knowledgeGraphAccounting.ts` releases only
     `RESERVED` graph costs; uncertain accepted provider work and already
     settled generation spend must not be released merely because a build
     failed. The later cancel/expire contract for a review-gate wait must
     distinguish outstanding reservations from settled spend and release
     graph pins according to the accepted lifecycle (v4 §7.3). Adding that
     behavior requires its own verified transition contract, not a generic
     terminal hook. Worker-restart behavior for the two durable
     waits gets a test only if it can run without live Hatchet; otherwise
     record it as a §13.1 proof for the RC qualification, not here.
  4. No schema change in this item. Implement and test transitions against
     existing storage and real effects. If an invariant needs a future
     column, retain the working current path and record the missing proof
     under the owning schema package. A no-op release, cleanup, or pointer
     update cannot satisfy a lifecycle invariant. Keep workflow tracking in
     the plan, not placeholder code comments.
- **Check:** focused package checks and existing database-backed suites pass;
  new tests cover consequential gaps only. Account for each relevant direct
  writer, its domain owner, predicates, transaction and side effects. A grep
  with no matches or a deliberately broken helper is not sufficient proof.
- **Working context:** worktree `trees/rs/w4-n1-lifecycle-services`, branch
  `rs/w4-n1-lifecycle-services` from current `origin/v3-ai` after W2 has
  merged (or stacked on W2 via `$rs-stacked-change` if W2 is still open).
  Draft PR → `v3-ai`. Owned seams: the selected server modules, their
  callers, `packages/graphql/test`, and `packages/hatchet/test`. Resolve
  exact paths in the reviewed package plan. Single writer.
- **Authority and terminal:** local commits, push, draft PR; `pr_ready`.
  `slice-reviewer` per slice (architecture seam), `final-reviewer` before
  `pr_ready`.
- **Boundary owner:** `rs-roadmap-orchestrator`.
- **Release-note impact:** none.
- **Current decomposition (2026-09-04):** the active **Klicker KB KG** task
  already owns webhook/polling reducer consolidation, processed-document
  serving fields and graph readiness. Consume its reviewed result; do not
  author a competing reducer. The consolidation task plans a separate,
  schema-free generation lease and business-regression package first.
  Its approved execution completed at reviewed local commits on 2026-09-05;
  the authoritative plan is now in `trees/rs/generation-lifecycle-contracts/project/2026-09-04-pr-5777-generation-lifecycle-contracts-plan.md`.
  [PR #5777 — generation synchronization leases](https://github.com/uzh-bf/klicker-uzh/pull/5777)
  is published as draft after separate user approval; hosted qualification and
  merge remain open. Reuse that branch; do not create another implementation.
  Completing that package leaves W4 — lifecycle normalization partial;
  graph settlement, maintenance, review-wait expiry and remaining state
  ownership still require explicit evidence and disposition.
- **Depends on:** W2 — backend consolidation steps 1–2: verified lock
  contracts and shared status definitions where actually consumed. The
  bounded generation lease package needs neither a global status-set rewrite
  nor a generic lock helper; it preserves the current five claim contracts.
  Separate lock helpers may remain. **Priority:** P1.

### W5 — N2 KB resource revisions, operations, binding, deletion

- **Problem:** v4 §7.1 and v3 roadmap "Canonical state ownership"
  (KB resources bullet, line 230): `KBResource` duplicates mutable ingestion
  state; replacement is not atomic; chatbot–KB binding is dual-written (v4
  D6).
- **Do:**
  1. Add `KBResourceRevision` and `KBResourceOperation` per the v3 roadmap
     bullet (immutable revisions; an operation either atomically moves the
     active pointer or leaves the previous active revision untouched; cleanup
     operations survive owner-facing hiding). `materialType` stays on
     `KBResource` (already on `v3-ai`).
     First map the current resource-replacement and ingestion PRs to this
     contract. Reuse their upload fencing, serving behavior, cleanup, and
     tests; implement only the remaining revision/operation gap.
  2. Replace the dual-written chatbot–KB binding with the association table
     and unique active binding per v4 §6 row "Chatbot–KB binding"; remove the
     dual write.
  3. Move the denormalized ingestion state off `KBResource` onto the revision
     or the operation, whichever the transition in W4's service owns. Read
     paths that today read `KBResource.status` read through the service.
  4. Deletion and retention per v4 §7.6: no owner cascade that erases
     external-cleanup correlation; `SetNull` on audit relations.
  5. One generated migration, `kb_resource_revisions_and_operations`.
     Explicitly classify existing data before choosing a backfill or a
     disposable-data reset. A Git tag does not prove what production has
     applied. Preserve supported data and ownership/correlation relationships;
     destructive staging work stays behind its separate approval.
  6. Update GraphQL types/resolvers, regenerate, `prisma:sync`, and update
     `docs/domain-model.md` plus the `klicker-data-model` skill in the same
     PR.
- **Check:** migration count in the PR is exactly one and generated
  (`prisma migrate dev`); `prisma migrate diff` from schema to migration
  reports no drift; W4 invariant suite still green; new tests: failed
  replacement leaves the active revision, successful operation moves the
  pointer atomically, a chatbot cannot hold two active bindings.
  `Y-kb-management-ux` Playwright green; `agent-browser` screenshots of the
  KB resource list after a replace and after a failed replace.
- **Working context:** worktree `trees/rs/w5-n2-kb-resources`, branch
  `rs/w5-n2-kb-resources`, base current `origin/v3-ai` after W4 merged (or
  stacked on W4). Draft PR → `v3-ai`. Owned seams: `knowledge.prisma`, the
  KB services, KB GraphQL types, `docs/domain-model.md`. Single writer; **no
  other schema writer active**.
- **Authority and terminal:** local commits, push, draft PR; `pr_ready`.
  Merge withheld until the pause guard is proven (v4 §10.1). `slice-reviewer`
  and `final-reviewer` required (data integrity).
- **Boundary owner:** `rs-roadmap-orchestrator`.
- **Release-note impact:** internal; the lecturer-visible claim "replacing a
  document never loses the previous version until the new one is ready"
  becomes true at `live_proven`.
- **Depends on:** W4. **Priority:** P1.

### W6 — N3a graph-build and generated-element normalization

- **Problem:** v4 §7.2 and §7.3. `KBGraphBuild` mixes build status,
  publication, artifacts, and inline cost; `ElementGenerationBuild` carries
  eight untyped JSON artifact columns and a redundant `stage` mirror; AI
  origin is not recorded on the saved `Element`.
- **Do:**
  1. Graph model: separate build from publication and give artifacts an
     identity per v4 §7.2 (reference, do not restate). Leave inline cost
     fields in place; W9 (N4) removes them.
  2. Generated-element model per v4 §7.3, binding list: drop `stage`; fold
     incomplete-publication statuses into the coarse enum; consolidate the
     eight artifact JSON columns into the D7 typed, versioned manifest (one
     `Json` column with a `manifestVersion` and a zod or equivalent existing
     validator in `packages/types`; no new dependency); reuse the existing
     `GeneratedElementDraft` model (already present on the 2026-09-04
     baseline; v4 §6, glossary "Generated element draft"); record AI origin
     on `Element` itself when a draft is saved
     (`docs/solutions/best-practice/generated-element-keep-is-one-transaction.md`
     governs the save transaction). Gate lifecycle rule (Restrict FK to the
     source graph build, gate expiry auto-cancel) is implemented through the
     W4 services.
  3. Keep database constraints that enforce generatable element types and
     relational invariants until an equivalent database constraint is
     demonstrated. Reuse existing enums/constants for runtime validation;
     Prisma schema enums cannot import a TypeScript constant. Application
     validation alone is not equivalent protection for direct database writes.
     W11 — migration-tail rewrite retains every required custom constraint.
  4. Unify the three difficulty notions to one enum used by generation input,
     draft, and saved element; record the mapping in the PR body. Prove
     existing values, manual authoring, scoring, and API consumers preserve
     their meaning. If a lossless mapping cannot be established, stop for
     the semantic decision instead of silently coercing stored values.
  5. One generated migration, `graph_builds_and_generated_elements`.
  6. Update `docs/domain-model.md`, `docs/async-and-workers.md`, GraphQL
     types, codegen, `prisma:sync`.
- **Check:** one generated migration, no drift; W4 invariant suite green plus
  new tests: manifest validator rejects an unknown version; saving a draft
  writes AI origin on the element in the same transaction (the negative:
  failing the element insert leaves no origin row). `Y-question-generation-
  review` Playwright green; `agent-browser` screenshots of the review inbox
  before and after a partial-failure build.
- **Working context:** worktree `trees/rs/w6-n3a-graph-generation`, branch
  `rs/w6-n3a-graph-generation`, base after W5 merged (or stacked). Draft PR →
  `v3-ai`. Owned seams: `knowledge.prisma`, generation services, generation
  GraphQL, `packages/types` manifest. Single schema writer.
- **Authority and terminal:** as W5.
- **Boundary owner:** `rs-roadmap-orchestrator`.
- **Release-note impact:** internal; "generated questions keep a record of
  their AI origin" becomes claimable at `live_proven`.
- **Depends on:** W5. **Priority:** P1.

### W7 — N3b response-example normalize-lite

- **Problem:** v4 §7.4 / D2: `ResponseExampleSet` is a 1:1 wrapper; the
  `digest` premise in D2 is wrong (§3: it has runtime consumers), and
  `ResponseExample.reviewedById` has no relation.
- **Do:**
  1. `ResponseExample` gains `chatbotId` (FK, indexed); drop
     `ResponseExampleSet`; keep the review lifecycle and evidence references
     untouched.
  2. **GATED on A4 — digest compatibility for the whole package.** The
     existing hash in `packages/util/src/responseExampleDigest.ts` includes
     set IDs, example IDs, statuses, and evidence identities and eligibility.
     Dropping the set and hashing only approved content is not value-equivalent.
     Inventory runtime projections, caches, receipts, and evaluation artifacts
     before changing storage. Reconcile PR #5764 — preview-answer capture.
     Specify either a compatibility representation or an explicit new digest
     version with invalidation rules; retain historical captured evidence.
     Compute-on-load remains a proposal until that contract is accepted.
  3. Add the `reviewedBy` relation (`SetNull` on user deletion, per v4 §7.6).
  4. Amend the response-example ADR only after A4 — digest compatibility
     is resolved. Record the selected digest version/compatibility contract
     and preserve its captured-evidence requirements.
  5. One generated migration, `response_examples_direct_chatbot`. The
     `chatbotId` backfill (copy it from the set before dropping the column)
     is a manual `UPDATE` inserted into the generated migration; mark it with
     a SQL comment saying so. Verify the supported data baseline and retain
     historical evidence. W11 — migration-tail rewrite may replace this
     migration only when its explicit rewrite allowlist includes it.
- **Check:** one migration; locate and run the existing digest and runtime
  suites at the chosen base. Prove deterministic hashing, the accepted
  compatibility or invalidation rule, and changes for relevant approval,
  content, and evidence-eligibility transitions. Use a pre-migration fixture
  to prove historical run digests and captured evidence remain verifiable
  after migration; invalidating current caches does not satisfy this proof;
  `Y-response-examples` Playwright green; `agent-browser` screenshot of the
  review inbox and of a chat turn that used examples (source card present).
- **Working context:** worktree `trees/rs/w7-n3b-response-examples`, branch
  `rs/w7-n3b-response-examples`, base after W6 merged (or stacked). Draft PR →
  `v3-ai`. Owned seams: `chat.prisma`, `responseExamples.ts`,
  `responseExampleRuntime.ts`, the chat route's digest line, ADR-0028.
- **Authority and terminal:** as W5.
- **Boundary owner:** `rs-roadmap-orchestrator`.
- **Release-note impact:** none.
- **Depends on:** W6; the entire package is GATED on A4 — digest compatibility.
  **Priority:** P1.

### W8 — N5 participant practice and student generation re-cut

- **Problem:** v4 N5 / D13: PRs #5481→#5482→#5483 carry the participant
  practice and student-generation work on an old base; #5483 is conflicting.
  `PersonalElement` (ADR-0026) and the plan-first generation contract
  (ADR-0027) are the target. Those ADRs now exist on `origin/v3`; their
  inclusion in the chosen implementation base remains to verify (§3.1).
- **Do:**
  1. Verify ADR-0026 and ADR-0027 from `origin/v3` have reached the selected
     base through the existing sync. A3 — ADR provenance is resolved at the
     source layer (§3.1); reconcile the current participant-stack owners and
     latest heads before implementation.
  2. Re-cut the three PRs' content onto current `v3-ai` as a fresh stack
     (`$rs-stacked-change`, ≤3 packages): model (`PersonalElement`,
     participant-owned, never a lecturer content model), generation contract,
     UI. Prefer the existing owner branches and completed implementation.
     A fresh stack is used only when the reviewed topology explicitly
     requires it; conflict count alone does not justify reimplementation.
     Cherry-pick/rebase integration and closing old PRs retain their explicit
     authority boundaries.
  3. Usage accounting for student generation writes through whichever
     envelope A1 — usage-envelope decision selected and W9 — usage
     accounting implemented. Reuse existing accounting code while preparing
     the package, but do not complete integration before that dependency.
     Do not ship placeholder accounting or claim a future budget cap works.
  4. One generated migration, `personal_elements_and_student_generation`.
- **Check:** one migration; invariant tests: a participant cannot read
  another participant's `PersonalElement`; deleting a participant follows v4
  §7.6 (no cascade that erases cleanup correlation). `agent-browser` PWA
  screenshots of the practice flow as `testuser1`.
- **Working context:** worktree `trees/rs/w8-n5-participant-practice`, base
  after W9 — selected usage envelope merged. Draft PR stack → `v3-ai`.
- **Authority and terminal:** as W5.
- **Boundary owner:** `rs-roadmap-orchestrator`.
- **Release-note impact:** "students can generate their own practice
  questions" is claimable only at `live_proven` and only if the entitlement
  defaults allow it (v4 §3).
- **Depends on:** W9 — selected usage envelope, following W7 — response-example
  normalization; published participant ADRs on the selected base.
  **Priority:** required RC scope under v4 D13 — student generation. The
  earlier P2 label does not authorize parking it; changing release scope
  requires a user ruling, not a calendar-triggered fallback.

### W9 — N4 neutral AI usage ledger (or the fallback)

- **Problem:** v4 §7.5 / D8. Cost and quota live in three inconsistent
  shapes (`KBGraphBuild` inline fields, `ElementGenerationSpend`,
  `KBGraphQuota`), and chat enforces balances separately.
- **Do (ledger branch, primary):**
  1. **GATED on A1 (Sep 6 checkpoint) — do not start before the ruling.**
  2. Add `AIUsageBudget`, `AIUsageReservation`, `AIUsageEvent` per v4 §7.5
     (one operation identity, attribution, estimate/reservation/actual/settled
     state, idempotent events, pricing-version provenance). Ingestion, graph,
     and generation write natively through the W4 services; chat keeps its
     enforcement and additionally emits events (additive dual-write).
  3. Remove `ElementGenerationSpend` and the inline cost fields on
     `KBGraphBuild`; rename or fold `KBGraphQuota` into `AIUsageBudget`.
     Keep `ChatUsageCredits`/`ChatAccountUsage` untouched.
  4. One generated migration, `ai_usage_ledger`.
- **Do (fallback branch):** keep per-domain quota/spend tables but give them
  identical field names and semantics (one shared embedded shape), rename
  `KBGraphQuota` to what it is, and leave the ledger as the first post-RC
  train. One generated migration, `usage_tables_consistent_semantics`.
- **Check:** one migration; tests: each terminal transition preserves the
  correct settlement, ordinary release, or uncertain-outcome hold (the
  W4 — lifecycle accounting contract, now against the selected real tables);
  already settled spend is not refunded by a later workflow failure;
  idempotent event
  replay does not double-count; guest chat turn draws from the owner's
  budget (v4 §7.5, keyed on chatbot owner). `docs/domain-model.md` and
  `CONTEXT.md` usage terms unchanged in meaning.
- **Working context:** worktree `trees/rs/w9-n4-usage-ledger`, base after
  W7 — response-example normalization. Draft PR → `v3-ai`.
- **Authority and terminal:** as W5.
- **Boundary owner:** `rs-roadmap-orchestrator`.
- **Release-note impact:** none user-facing; the G1 manifest records which
  envelope shipped.
- **Depends on:** W4 — lifecycle services, W6 — graph/generation normalization,
  and W7 — response-example normalization for the serial schema baseline;
  GATED on A1 — usage-envelope decision. **Priority:** P1 (one of the two
  branches must ship; D5 requires an enforceable cap on every paid
  capability).

### W10 — MCP shared core (deferred by default)

- **Problem:** `apps/mcp-lecturer` and `apps/mcp-student` duplicate server
  bootstrap, auth, and tool plumbing beyond what W2 step 4 removes.
- **Do:** **GATED on A5 — do not start unless ruled in.** Extract a
  `packages/mcp-core` with the shared bootstrap and auth; both apps import
  it; no behavior change; env variable names unchanged (and
  `MCP_STUDENT_QUESTION_REF_SECRET` added to `.devcontainer/devcontainer.env`
  with a dev-only value so local runs do not depend on host env).
- **Check:** both apps build and their tests pass; the deploy workflows in
  `.github/workflows/v3_mcp-*-stg.yml` are untouched.
- **Working context:** `trees/rs/w10-mcp-core`, base current `origin/v3-ai`,
  draft PR → `v3-ai`.
- **Authority and terminal:** as W2; `pr_ready`.
- **Boundary owner:** `rs-roadmap-orchestrator`.
- **Release-note impact:** none.
- **Depends on:** W2. GATED on A5. **Priority:** P3.

### W11 — N6 migration-tail rewrite, schema mirror, and proofs

- **Problem:** v4 N6 / §8 and the v3 roadmap "Final migration chain" and
  "Required migration proofs" sections (lines 244–272). After W5–W9 the tail
  includes the AI-only baseline plus later approved changes. Re-inventory
  instead of assuming a fixed count or production state. Every migration
  belonging to `v3`, including the `chat_*` and `course_deletion_request`
  migrations, stays byte-identical. The approved AI tail follows the parent
  roadmap's chain, subject to the verified immutable boundary.
- **Do:**
  1. **GATED on all required normalization packages merged:** W5 — KB
     revisions, W6 — graph/generation normalization, W7 — response-example
     normalization, W9 — selected usage envelope, and W8 — participant
     practice. Rerun the
     migration inventory against the merged tree; do not trust §3 line
     numbers.
  2. Read production `_prisma_migrations` first (v3 roadmap proof 1; the
     user provides read access or the list; the junior never connects to
     production itself). Every migration present there stays byte-identical.
  3. Build an explicit rewrite allowlist. Exclude every migration already
     belonging to stable `v3`, every production-applied migration, and every
     migration frozen by accepted RC qualification; preserve their bytes and
     checksums. Being absent from production is necessary but not sufficient
     permission to delete a file. Rewrite only the approved AI-only tail and
     regenerate the chain with `prisma migrate dev` into the named directories of the v3
     roadmap (`ai_platform_core`, `chatbot_authoring_and_examples`,
     `knowledge_base_resources_and_operations`,
     `knowledge_graph_builds_and_artifacts`, `element_generation`, plus the
     usage-envelope migration from W9). Split points follow the v3 roadmap;
     do not invent new ones.
  4. Inventory and preserve every necessary custom SQL operation, including
     partial unique indexes, CHECK constraints, defaults, and required data
     transformations. Prove any removal has an equivalent replacement.
     Each retained constraint gets a schema comment (`/// …` on the
     model) saying what it enforces and why generation cannot.
  5. Run the eight proofs from the v3 roadmap "Required migration proofs"
     (fresh database and an isolated production-baseline upgrade both match
     the final schema; staging reset is a separate approved path, not proof
     of an in-place upgrade through deleted historical migrations;
     forward-only recovery and actual production-image compatibility per v4 §8;
     `prisma:sync` mirror equality in `apps/analytics`; codegen clean; full
     rebuild). Record each proof's command and output hash in the PR body.
  6. Update `docs/domain-model.md` migration section and the
     `klicker-data-model` skill; update the gitignored G1 manifest through
     the orchestrator (the junior lists what changed; the orchestrator writes
     the manifest).
- **Check:** migration-to-schema diff using the installed Prisma version's
  supported flags is empty; `prisma migrate deploy` on a fresh database succeeds and a second
  run is a no-op; all eight proofs recorded; `pnpm run build` green; `pnpm
  run test:run` green; Playwright full suite green on the staging-shaped
  local stack. Classify every failure; a successful retry records flakiness
  and does not erase the original failure or waive a release regression.
- **Working context:** `trees/rs/w11-n6-migration-tail`, base current
  `origin/v3-ai` with all schema items merged. Draft PR → `v3-ai`. Single
  writer; **no other schema writer may be active**.
- **Authority and terminal:** local commits, push, draft PR; `pr_ready`.
  Merge, tag, RC cut withheld (user). `final-reviewer` must explicitly verify
  migration count, generated provenance, schema equivalence, retained custom
  SQL, and absence of avoidable model changes.
- **Boundary owner:** `rs-roadmap-orchestrator`.
- **Release-note impact:** none user-facing; it is the release-schema
  deliverable.
- **Depends on:** W5–W9. **Priority:** P1.

### Out of scope (do not do inside any W-item)

- Splitting the 2109-line chat route or re-architecting `apps/chat` (A5
  records it as a post-RC candidate).
- Merging `KBIngestionStatus` and `KBGraphBuildStatus` into one enum
  (ruled: keep two; share the literal sets in code).
- Any change to `GenerationStatusProvider.tsx` timers.
- Component tests for React components; `packages/kb-management` gets tests
  only through W4's invariant suite.
- Deployment values, `KB_*` wiring in `deploy/env-uzh-*`, ArgoCD, staging.
- Feature-flag provider changes (`packages/feature-flags`,
  `PLAN-growthbook-feature-flags-implementation.md`).
- Anything in `evaluation/manage-assistant` or its nightly workflow.
- The Catalyst repository split (`plans_wip/PLAN-catalyst-repo-split.md`).

## 7. Decision gates

Rulings already made by the author (routine judgment; the user may veto in
§10): keep two status enums; keep the GenerationStatusProvider timer;
lock-related refactors preserve row targets, authorization predicates and
transaction/lock order; superseded plans are
marked, never deleted; the RC-branch ADR (not the response-example ADR) is
the one renumbered; N1 is schema-free, N2–N5 add migrations normally and only N6 rewrites.

| ID | Question | Options | Recommendation | Gates |
| --- | --- | --- | --- | --- |
| A1 — usage envelope for the RC | At the Sep 6 checkpoint (v4 §7.5): does the neutral AI usage ledger ship in the RC, or the per-domain fallback? | (a) ledger; (b) fallback, ledger first post-RC train | (a) only if W4 and W5 are `pr_ready` by Sep 6 and W6 has started; otherwise (b). D5 holds either way. | W9 (which branch), W8 step 3 |
| A2 — owned `v3`→`v3-ai` sync | The dedicated **Merge latest v3 into v3-ai** task is active. | Reuse its resulting commit and checks; request another integration only if later material drift requires it. | Do not create competing sync work. The September 3 conflict list is historical. | Base refresh for W2 — backend consolidation through W11 — migration-tail rewrite |
| A3 — participant ADR provenance | Resolved at source on 2026-09-04: ADR-0026 and ADR-0027 are committed on `origin/v3` through `795568a4a1`. | Verify inclusion after the owned sync. | Reuse the published decisions and existing participant implementation; no replacement ADR or missing-author approval is needed. | W8 — participant practice base verification |
| A4 — response-example digest compatibility | The existing digest hashes set IDs, example IDs, statuses, and evidence fields. How should flattening preserve historical run identity and invalidate current projections? | (a) version the computed digest and define compatibility/invalidation; (b) retain a compatible representation while removing the wrapper | Prefer (a) if consumer inventory confirms a version transition can preserve captured evidence; otherwise (b). Approval must cover the algorithm and consumers, not just where a string is stored. No claim of identical values is currently proven. | Entire W7 — response-example normalization package |
| A5 — MCP shared core now or later | Extract `packages/mcp-core` before the RC, or only do W2's JWT/literal reuse now? | (a) now (W10); (b) post-RC | (b). No release risk is reduced by it; W2 removes the risky duplication (auth literals). Also records the chat route split as post-RC. | W10 |
| A6 — placement of PR #5668 | The system-prompt version catalog (#5668, targets `v3`, open) adds schema. Merge to `v3` before the RC and sync in, hold for the RC, or post-RC? | (a) `v3` before sync (then part of A2); (b) retarget into the N-stack; (c) post-RC | (a) if it is merge-ready this week, so W11 sees it in the production baseline; otherwise (c). Carried from the 2026-09-02 takeover table, still unruled. | W11 baseline, A2 timing |

## 8. External dependencies to watch

- **Current feature owners:** PR #5756 — resource replacement,
  PR #5771 — cost controls, and PR #5764 — preview-answer capture supply
  reusable code and overlapping contracts. Refresh their heads and delivery
  before assigning the corresponding normalization paths.
- **Stable-branch integration:** the owned sync carries current `v3` and
  published participant ADRs into the chosen base. PR #5709 — scoped Doc
  Query activation and PR #5668 — prompt catalog remain independently owned.
- **Staging pause guard** (`STG_PROMOTION_PAUSED=true`, v4 §10.1, user
  action). Awaited before the first W5 merge.
- **Production `_prisma_migrations` listing** for W11 proof 1 (user-provided,
  read-only).

## 9. Review and evidence expectations

At every W-item boundary the junior returns, in its execution plan's
Progress and as the boundary candidate:

- PR link (draft, targeting `v3-ai`), exact head SHA, exact base SHA.
- The in-container check loop output (check, lint, format:check, test:run)
  and, for schema items, `prisma migrate diff` output and migration
  directory listing.
- Named screenshots for every browser state the W-item's Check lists, both
  color schemes where badges or gates are involved.
- The `simplifier`, `slice-reviewer`, and `final-reviewer` reports named in
  the W-item, with dispositions.
- A one-paragraph list of anything the junior decided that this roadmap did
  not specify.

The orchestrator grades against the W-item's Check only, appends to §10, and
selects the next dependency-ordered item. Any new scope becomes a new W-item
or A-item; it is never folded into the in-flight one.

## 10. Progress

- **2026-09-03** — Roadmap written from six verified review passes over
  `origin/v3-ai@fa7e707bdf` vs `origin/v3@5906ef19c4`. Custody-branch
  drive-by in the same session: the RC-branch ADR is renumbered from `0028`
  to `0043` (next free number on both remotes) and the ADR index updated, so
  W1 leaves the response-example ADR-0028 untouched. No W-item started. A1–A6
  unruled. Pause guard not yet proven; no schema item may merge.

- **2026-09-04 — takeover and roadmap review.** The main consolidation task
  resumed ownership on the existing custody branch. Remote refs, PR bases,
  the active sync task, and overlapping feature PRs were checked read-only.
  The earlier expert task has no active turn. The September 3 roadmap and
  its three local commits are preserved. Only this roadmap is edited;
  unrelated deleted transactional outputs remain untouched.
- **2026-09-04 — verified recipe corrections.** The row-lock helpers are
  distinct authorization/concurrency contracts, not advisory locks; JWT
  helpers differ; retry counts are runtime behavior; lifecycle effects
  cannot be stubbed; digest identity includes the wrapper being removed;
  stable-branch migrations remain immutable even before production applies
  them. The relevant work-item instructions now preserve those contracts.
  Current repository runtime and individual final-review rules replace stale
  recipes. ADR provenance is resolved at source; the owned sync supplies it
  to the future implementation base.
- **2026-09-04 — scope and next delivery.** The existing release decisions
  remain unchanged: normalize the current feature implementation, retain
  required AI scope, then qualify a fixed RC from that tree for stable `v3`.
  W11 — migration-tail rewrite is the normalization milestone, not the
  release finish. The next implementation plan must identify reusable owner
  code, exact write paths, real invariant checks, and its review boundary.
  Digest compatibility and the usage-envelope choice remain later package
  decisions. No implementation package, merge, upstream integration,
  publication, runtime, or deployment is claimed by this review.
- **2026-09-04 — independent planner review disposition.** The native
  planner returned `DONE_WITH_CONCERNS`. All five residual findings were
  accepted: remove the generic-lock prerequisite; implement the usage
  envelope before participant integration; cover transient entitlement
  states; prove historical digest/evidence verification; distinguish required
  normalization from optional broad cleanup. This local correction pass
  addresses them without reopening product decisions. The corrected diff
  still needs each implementation package's own planning and verification;
  the planner did not certify a source implementation or release candidate.
- **2026-09-04 — execution-plan research.** A live parallel-owner check found
  the multilingual processed-document package already owns the proposed
  ingestion reducer. Reuse that implementation. The first independent
  normalization candidate is the repeated generation synchronization lease
  in question and flashcard services, with real-database concurrency and
  ordinary Element regression checks. Terminal accounting is not a blanket
  release rule; preserve metered settlement and uncertain-outcome holds.
  The plan will retain explicit model/consumer/migration proof obligations
  for later schema packages. No new implementation or publication authorized.

- **2026-09-04 — reviewed first implementation plan.** The
  [generation lifecycle contracts plan](./2026-09-04-generation-lifecycle-contracts-plan.md)
  passed native planner review after corrections to instance-update semantics,
  test reuse, and disposable-database isolation. It consolidates five existing
  question/flashcard lease sites without changing schema or business policies,
  and adds only missing real-database concurrency and rollback evidence.
  Existing UI, permissions, accounting, and activity tests remain the primary
  evidence for their own contracts. The cross-provider review could not run
  because its OAuth login expired; no cross-provider result is claimed.
  The roadmap now explicitly requires canonical ownership, consumer coverage,
  rolling schema compatibility, and existing-business regression evidence.
  `GeneratedElementDraft` already exists and must be reused; terminal
  accounting preserves settlement and uncertain-outcome holds. Planning only:
  no implementation, runtime, commits, PR publication, integration, or release
  readiness is claimed. Next: user approval of local implementation, then
  verify the published result of the owned upstream sync before branch setup.

- **2026-09-04 — local execution approved and isolated.** The user approved
  the generation lifecycle package, a goal, and executor/reviewer delegation.
  The owned sync is published at `208e97d38e6abfd13d997d48200077febc8c1445`;
  generation source, relevant tests and Prisma schema match the researched
  baseline. Execution now lives in `trees/rs/generation-lifecycle-contracts`
  on `rs/generation-lifecycle-contracts`; only the approved plan was copied,
  not the custody branch history. That worktree's plan is the execution record.
  A new task-owned synthetic database/runtime is bootstrapping. A Blob emulator
  port collision was isolated with port 10043 without changing another owner.
  No application source edit, passing test, source review, publication or
  release readiness is claimed yet. W4 — lifecycle normalization remains partial.

- **2026-09-05 — first lifecycle source slice committed locally.** Execution
  branch `rs/generation-lifecycle-contracts` now contains plan commit
  `1e01a11619` and lease-refactor commit `5c334a959a`. Five existing acquisition
  and release sites share one implementation while retaining their distinct
  status predicates and failure paths. Six focused suites passed 62 tests;
  the corrected typed fixture passed its five PostgreSQL lease tests again,
  and GraphQL type/schema checks and scoped format/lint passed. Schema,
  migrations, public SDL, accounting and provider-dispatch contracts are
  unchanged. Independent slice reviews are running. Repository-wide checks
  still report inherited generated-type failures; real Element integration,
  broader regression checks, browser proof and final review remain open.
  No publication, upstream integration, merge or release qualification is
  claimed. W4 — lifecycle normalization remains partial; other tasks retain
  their existing feature and ingestion scopes.

- 2026-09-05 execution checkpoint: W4 — lifecycle normalization remains partial.
  The lease commit `5c334a959a` passed its independent slice review with no
  findings; optional simplifier suggestions were dispositioned without changes.
  The existing branch now also has five passing, uncommitted real PostgreSQL
  persistence tests covering duplicate/conflicting keeps, final-link rollback,
  foreign ownership, and disabled AI entitlement with manual authoring intact.
  Existing business sentinels passed 106 tests, grading passed ten, the isolated
  serial root check passed all 40 tasks, and the full build passed 26 tasks.
  The ordinary parallel/shared-cache check remains a baseline limitation.
  No schema, migration, dependency, public API or existing business-service
  change is part of this slice. Test-slice commit/review, browser proof, final
  review and final documentation qualification remain open.
  Host permission approval timed out twice for formatting and twice for the
  exact task-runtime stop, before command launch. The execution plan records
  recovery details. The task runtime was last verified running; its stop is
  unverified, with no keep-running approval. All children are closed. Resume
  the same package after host access is restored; do not duplicate its work.
  No push, PR publication, upstream integration, merge or release qualification
  occurred. The 3.4.0 RC target and all parallel ownership boundaries remain.

- **2026-09-05 — generation lifecycle package reviewed locally.** This
  supersedes the preceding execution checkpoint: host access recovered,
  persistence tests were committed and reviewed, browser proof passed,
  and final shutdown is verified. The complete range
  `208e97d38e6abfd13d997d48200077febc8c1445..620ab16d0b286e99318d3f7c166146a3f8ff2a87`
  passed native integrated final review with no reportable findings. Lease
  and persistence slices each passed their independent reviews; all children
  are closed. The execution plan records the final Progress-only closeout.
  Five acquisition/release sites now share the existing contract, and ten
  new real PostgreSQL tests protect contention and Element persistence.
  Focused lifecycle/accounting/lease checks passed 62 tests, the new persistence
  file passed five, existing business sentinels passed 106, and grading passed
  ten. The isolated root check passed 40 tasks; full build passed 26. The
  standard parallel/shared-cache check remains a disclosed baseline limitation.
  The existing generation-review Playwright journey passed, with separate
  agent-browser visual evidence. No schema, migration, dependency, public API,
  provider or ordinary Element service changed. The exact Devsy workspace
  `rs-generation-lifecycle-contract` is Stopped with zero devrouter routes;
  the browser is closed and review fixtures were removed. Runtime data and
  Git worktree remain preserved. The execution branch is
  `rs/generation-lifecycle-contracts`, based on unchanged published `v3-ai`;
  no upstream integration occurred. Required local delivery is achieved;
  publication is `delivery_pending`, not `pr_ready`. The next external action
  is approval to push this branch and open one draft PR targeting `v3-ai`.
  W4 — lifecycle normalization remains partial: broader transition ownership,
  graph settlement, maintenance and review-wait expiry still need disposition.
  Existing ingestion/graph work stays with its parallel owner. This package
  neither completes data-model normalization nor qualifies the 3.4.0 RC for
  stable `v3`. No push, PR publication, merge or deployment occurred.

- **2026-09-05 — generation lifecycle draft published.** The user approved
  pushing `rs/generation-lifecycle-contracts` to origin and opening one draft
  PR targeting `v3-ai`, without merging.
  [PR #5777 — generation synchronization leases](https://github.com/uzh-bf/klicker-uzh/pull/5777)
  now carries the reviewed implementation and renamed execution plan.
  Published head: `5e984643c6a63f800e4402736fa5d3370a980ae8`.
  Source and tests are unchanged from the integrated final review; the two
  later commits contain only Progress and PR identity. Substantive diff:
  795 additions and 90 deletions, excluding project-artifact documentation.
  Hosted checks and final AI review remain pending. This supersedes the
  preceding publication-pending checkpoint, not the remaining normalization
  work. W4 — lifecycle normalization remains partial. No ready-state change,
  upstream integration, merge, deployment or runtime restart occurred.

- **2026-09-05 — exact-head hosted evidence and continued ownership.**
  [PR #5777 — generation synchronization leases](https://github.com/uzh-bf/klicker-uzh/pull/5777)
  remains draft at `5e984643c6a63f800e4402736fa5d3370a980ae8`.
  [GraphQL CI](https://github.com/uzh-bf/klicker-uzh/actions/runs/33947736851)
  passed all 74 test files, including the new lease-concurrency and real
  Element-persistence suites.
  [Codebase checks](https://github.com/uzh-bf/klicker-uzh/actions/runs/33947736888),
  secret checks and frontend builds passed. The
  [Playwright run](https://github.com/uzh-bf/klicker-uzh/actions/runs/33947736931)
  remains in progress after its build passed. Hosted OpenCodeReview failed
  with HTTP 403 authentication errors before producing a usable review;
  zero tokens and comments are not review acceptance. Repairing credentials
  or shared review configuration is outside this package's authority.
  Final AI review has not started. The PR body now records these distinctions.
  Local source and reviews remain unchanged; runtime stays stopped.
  W4 — lifecycle normalization is still partial, not accepted or merge-ready.
  The active consolidation goal continues bounded generation-transition
  mapping and next-step planning while CI runs. The active **Klicker KB KG**
  task retains processed-document schema, graph serving-state, accounting,
  webhook and ingestion ownership. No competing implementation or peer-task
  instruction was issued. The first AI release remains 3.4.0 RC; existing
  business behavior and the schema acceptance table remain mandatory.

- 2026-09-05 — Generation lifecycle qualification and next-step proposal:
  PR #5777 remains draft at `5e984643c6a63f800e4402736fa5d3370a980ae8`,
  six commits ahead of unchanged `v3-ai@208e97d38e6abfd13d997d48200077febc8c1445`.
  GraphQL passed 74 files and codebase checks passed. Playwright is now
  terminally failed, not pending: shard 8 reported the hidden chat-account
  usage and unavailable-analytics tests in `B-feature-access.spec.ts`, and
  the small-desktop activity-choice test in `W4-activity-wizard-safety.spec.ts`.
  The same three tests failed on the exact base in
  [baseline run 33918795985](https://github.com/uzh-bf/klicker-uzh/actions/runs/33918795985/job/101174293550);
  [candidate run 33947736931](https://github.com/uzh-bf/klicker-uzh/actions/runs/33947736931)
  passed the other seven shards. Both specs and frontend-manage are unchanged.
  These inherited failures remain qualification blockers; their causes and
  fixes are outside this backend package. No blind retry or unrelated UI edit.
  Hosted OpenCodeReview remains blocked by HTTP 403 authentication; no final
  AI review or merge-readiness claim. The PR body records the exact evidence.
  The [atomic generated-draft completion proposal](2026-09-05-generation-completion-extension-proposal.md)
  passed native planner review on round 2. It would extend this same draft
  PR with one completion owner and real transaction rollback/takeover tests
  for questions and flashcards, preserving distinct status and cardinality
  rules. It is a proposal awaiting user approval, not an accepted scope change.
  No new PR, branch, source edit, schema change or runtime start occurred.
  The active KB owner remains untouched. W4 — lifecycle normalization remains
  partial; subsequent data-model, business-regression and 3.4.0 RC gates remain
  unchanged. Existing execution-plan sections will be updated only after
  extension approval; this proposal is not a second execution authority.
  PR monitoring continues through thread heartbeat
  `monitor-generation-lifecycle-pr-5777`, initially every 15 minutes, with
  a watch deadline of 2026-09-05 09:43:58 UTC. No CLI watcher remains.
  A global handoff checkpoint could not be saved: writing under
  `~/.handoffs/klicker-uzh/` failed both normally and with host escalation.
  No handoff or index entry was created. The roadmap, reviewed proposal,
  local review reports and updated PR remain the durable continuation record.

- 2026-09-05 — One Element-generation approach: the user clarified that
  flashcards and questions are Element types, not separate product primitives.
  The acceptance table now binds every normalization package to shared
  lifecycle and business services with justified type/provider conversion.
  The existing completion-extension proposal was revised in place: both
  callers must use one real completion transaction, not two bodies behind
  one module. The changed architecture passed native planner review on
  round 2. Accepted checks cover crossed Element types, existing-row re-entry
  without overwriting payloads, the current source-state/result compatibility
  matrix and transaction rollback after lease takeover. Existing draft PR
  [#5777](https://github.com/uzh-bf/klicker-uzh/pull/5777) remains the package;
  no duplicate PR, source/schema edit, runtime start or peer change occurred.
  Implementation and own-branch publication of the extension still await
  user approval. The wider lifecycle and model-normalization gates remain
  open; the common completion operation alone does not finish them.

- 2026-09-05 — Shared Element completion execution approved: the user agreed
  to the revised proposal. Its contract is integrated into the existing
  execution plan, committed as `ea717d68601151998e7d7f7405c63a0a70cafad7`.
  [PR #5777 — generation lifecycle contracts](https://github.com/uzh-bf/klicker-uzh/pull/5777)
  remains the same draft package, targeting unchanged `v3-ai`.
  Characterization tests precede the common completion implementation.
  The exact task runtime resumed with the manage profile; the newly created
  `generation_completion_20260905` database contains only this extension's
  synthetic tests. Existing databases, schemas, migrations and peer work
  remain untouched. Own-branch publication is approved after local gates;
  merge, upstream integration and deployment remain withheld.
  The previous PR heartbeat is paused because its 09:43:58 UTC deadline
  elapsed. Hosted UI failures and review authentication remain parked.
  The parallel Klicker KB KG task still owns ingestion and graph work; its
  latest checkpoint awaits a compatible ingestion-worker image for end-to-end
  proof. This completion slice neither duplicates nor resolves that work.

- 2026-09-05 — Completion characterization accepted locally: commit
  `f2fd5aed02b1da147f4ef9a31d6878f87d0d8f41` adds 26 passing PostgreSQL
  cases against the original completion helpers. Both the simplifier and
  data-integrity review are complete, with no required changes. Existing
  generation tests passed 67 cases; business sentinels passed 106 and grading
  passed ten. Root serial typechecks passed 40 tasks; remaining native checks
  passed. The common completion implementation is now in progress on the
  same draft branch. This evidence is a local baseline, not publication,
  hosted-CI qualification, staging acceptance or readiness for stable v3.

- 2026-09-05 — Shared Element completion implemented locally in
  `f901f7f16ca39029ff18bb59e30d658e0e4e731f` on the existing
  [PR #5777 — generation lifecycle contracts](https://github.com/uzh-bf/klicker-uzh/pull/5777)
  branch. Question and flashcard workflows now call one typed operation with
  one draft-insertion and fenced build-completion transaction. The two old
  completion bodies are removed; content conversion and historical
  state/count rules remain explicit. All 93 focused tests, 106 business
  sentinels and ten grading tests pass; root serial typechecks pass 40 tasks.
  Schema, migration, Analytics, public SDL and dependency diffs remain empty.
  Slice reviews and the full build are running. Publication and integrated
  review remain pending; no claim of merge or release readiness is made.

- 2026-09-05 — Completion extension source qualification finished: both slice
  reviews and the integrated final review pass with no required changes.
  The final review covers all 13 changed paths at
  `801a04f7110486ffb09d45555a298c0fc7fa553b`; later closeout is Progress-only.
  Full production build passes 26 tasks with zero cache hits. The exact
  generation-lifecycle runtime is Stopped with zero routes; its data and
  worktree are retained. Own-branch draft publication is the next approved
  action. Hosted checks, final AI review, broader lifecycle normalization,
  migration qualification and stable-v3 merge remain separate unfinished gates.

- 2026-09-05 — Completion extension published to
  [PR #5777 — generation lifecycle contracts](https://github.com/uzh-bf/klicker-uzh/pull/5777)
  at `c8c35e2d94d06c42c4dc94ff41170dc2ed01c51f`, with matching local and
  remote branch readback. The package remains draft against `v3-ai`.
  Eleven commits cover 13 paths; substantive diff is 1,628 additions and
  324 deletions excluding project artifacts. Full source review covers
  `208e97d38e6abfd13d997d48200077febc8c1445..801a04f7110486ffb09d45555a298c0fc7fa553b`;
  the final commit records that review only. Hosted qualification is pending.
  No merge, upstream integration, real data, deployment or peer changes occurred.

- Exact published completion head: hosted OpenCodeReview run `33963181131`
  again failed authentication with HTTP 403, zero tokens and zero comments.
  It produced no usable review. GraphQL run `33963182111`, codebase run
  `33963182163` and Playwright run `33963182292` started for the same head.
  One Playwright CLI watcher owns the current CI wait; the expired earlier
  heartbeat remains paused. No credential repair, blind retry, CI-policy
  change or new source workaround is authorized by this failure.

- Exact published completion head `c8c35e2d94d06c42c4dc94ff41170dc2ed01c51f`:
  [GraphQL CI](https://github.com/uzh-bf/klicker-uzh/actions/runs/33963182111/job/101298563677)
  passed all 75 files, including the new completion and real Element persistence
  suites. [Codebase checks](https://github.com/uzh-bf/klicker-uzh/actions/runs/33963182163/job/101298541905)
  passed. Playwright's shared build passed and its eight shards are running.
  Hosted review authentication remains blocked; no merge readiness is claimed.

- 2026-09-05, 11:50 UTC — Exact completion head hosted qualification settled:
  [Playwright run 33963182292](https://github.com/uzh-bf/klicker-uzh/actions/runs/33963182292/job/101299213146)
  has seven passing shards. Shard 8 has 104 passed, five skipped and the same
  three failures recorded on the exact base: hidden chat-account usage,
  unavailable analytics, and small-desktop activity choices. No additional
  test failures appeared. Their source files and frontend-manage remain
  unchanged; underlying causes are not diagnosed by this package. The CLI
  watcher exited, and rate-limit readback showed no exhaustion. GraphQL's
  75 files and codebase checks pass; hosted-review HTTP 403 remains parked,
  not accepted. Final AI review remains gated. The draft PR description
  records current-head evidence; no new source commit, retry or integration
  was made. Automatic follow-up continues only within the approved package
  and a bounded watch ending at 14:00 UTC; it cannot repair shared credentials,
  change UI policy, leave draft or merge without new authority.
  Existing heartbeat `monitor-generation-lifecycle-pr-5777` is active at a
  15-minute interval, with quiet checks widening within that deadline. It
  replaces the exited CLI watcher; no duplicate monitor was created.

- 2026-09-05 — Generation-lifecycle finalization remains focused on
  [PR #5777 — generation lifecycle contracts](https://github.com/uzh-bf/klicker-uzh/pull/5777).
  The user subsequently approved the analytics loading-state correction.
  The guard now waits with a standalone loader before mounting Layout;
  existing authentication and backend permissions remain unchanged. Manage
  typecheck passes. The regression-test typecheck and formatting passed before
  a final retrying-URL assertion adjustment; that small adjustment still needs
  the container check, which the active shutdown lock rejected.
  Browser verification is currently blocked:
  canonical startup and one repair both reject remaining foreground-build
  children after ten cached dependency builds. No lifecycle guard was bypassed.
  The executor's unauthenticated-access regression is retained locally; main
  owns the final assertion and the executor is closed. Canonical task shutdown
  succeeded with startup's Blob port override restored; all nine task containers
  are exited. Worktree and volume are retained. No lock bypass or shared mutation
  occurred. These corrections are uncommitted and unpublished; browser evidence
  and required implementation reviews remain blocking.
  This supersedes the scope-approval request below, not the verification gate.
  Latest 2026-09-06 result: approved Devrouter alignment to 0.0.55 is locally
  verified. Container and host frozen installs pass with pnpm 11.5; the generated
  lockfile changes only Devrouter. Canonical repair passed with ready/full,
  zero drift, eleven routes and healthy services. Launcher/profile contract
  tests pass 24/24. Focused browser run completed with five passes, one failure
  and one skip: absent chat flag and smaller-desktop activity choices pass;
  analytics profile failure redirects to login instead of unavailable state.
  The loading guard mounts an authenticated Layout before profile evaluation
  settles. A narrow loading/authentication-flow correction needs explicit
  scope approval; no authentication source was changed or test weakened.
  Local changes remain uncommitted/unpublished. Exact runtime stop completed;
  all nine containers are confirmed exited and no workspace routes remain.
  Worktree and synthetic database are retained. This result supersedes
  queued-run states below.
  Latest qualification failed before tests: the canonical pnpm launcher selects
  repository-pinned Devrouter 0.0.51 rather than host 0.0.55, and its helper lacks
  the adopted adapter's required --prepare-command support. Aligning repository
  tooling pins and lockfile was explicitly approved on 2026-09-06 and is now
  in progress in the existing worktree; do not bypass the launcher. The exact
  workspace stop completed with nine containers stopped and zero routes.
  Subsequent repair did not restore the application process. Container pnpm
  remains available for the approved lockfile update; fresh runtime and UI
  qualification remain pending. These are the latest results, superseding
  the historical queued-run and approval-blocked states below.
  Runtime recovery subsequently completed: canonical ensure exited zero with
  ready/full, zero drift, healthy dependencies and published routes. The newly
  created local database was bootstrapped. Focused UI verification is active
  in host session 24968, currently queued during canonical reconciliation.
  No test pass or source-readiness claim exists yet. This supersedes the
  missing-network blocker below; no shared setup change was required here.
  Latest 2026-09-06 ruling: the user authorized independent takeover of the
  existing generation worktree/runtime, superseding the handback wait below.
  Fresh checks find its old containers and database volume absent. Canonical
  startup downloaded required images but cannot proceed because shared devnet
  and devrouter-traefik are absent. Shared-machine setup requires explicit
  authority; no task container is running and no source implementation changed.
  Resume the existing qualification package after setup, retaining the complete
  data-model and business-regression obligations rather than opening a duplicate.
  Blocked audit, 2026-09-06: three resumed turns still lack generation readiness and runtime handback;
  the recovery owner is now idle with no live operation to await. The goal is
  blocked pending that external-state change, not complete. Preserve existing
  ownership and the paused monitor instead of repeating status-only turns.
  Update, 2026-09-06: task messaging is restored and the shared-runtime identity
  confirmation was delivered to Devsy Issues. Its receiving turn completed
  without a readable handback. Central records UX recovered and stopped;
  generation recovery remains unverified. Fresh provider status is Stopped
  and the source-scoped route count is zero. Preserve central runtime custody
  and caches; focused Playwright reset/reseed needs handback and reconciliation
  of the preservation boundary. The PR remains draft and mergeable at the
  unchanged head below. This supersedes older messaging and recovery status,
  not the remaining qualification, data-model or business-regression gates.
  Resumed blocked audit reached three consecutive turns: generation runtime
  remains unavailable under central custody despite completed source-receipt
  and PR-evidence reconciliation. Fresh host inspection still shows all nine
  containers exited, both managed processes stopped and no generation lifecycle
  operation. Central now reports UX recovery progressing, not generation
  readiness. Mark the goal blocked pending qualified generation recovery and
  custody handback; do not duplicate recovery or infer completion.
  Exact-head reconciliation now succeeds after host access recovered. The PR
  remains draft and mergeable at c8c35e2d94d06c42c4dc94ff41170dc2ed01c51f,
  with zero unresolved review threads, passing GraphQL/codebase checks and the
  same Playwright/OCR failures plus pending final AI review. Its description is
  corrected and read back: stopped runtime, unqualified local UI candidates and
  separately adopted runtime source, with published backend evidence preserved.
  Fresh host inspection confirms nine exited containers and zero routes.
  Fetch performed no integration; target v3-ai is unchanged. Central recovery
  and custody handback remain prerequisites for focused UI qualification.
  Latest continuation supersedes the historical runtime blockers below: central
  records Devrouter 0.0.55 released/installed with the Compose hash and mount-order
  fixes. The six runtime-source changes and cache-preservation guard are adopted
  locally and uncommitted; the preservation marker is present. This source task
  confirms it shares the KB/KG/Generation runtime, not a separate recovery target.
  Central retains serialized recovery, currently paused by prelaunch automatic
  permission-review timeouts. This task's remote refresh hit the same timeout
  twice, so remote/CI observations below were not refreshed. Shell syntax and
  whitespace checks pass; browser qualification remains unrun. No lifecycle
  command, cache clearing, reset, commit, publication or integration occurred.
  Resume after central supplies qualified recovery and returns runtime custody.
  Earlier producing-run evidence follows and is not current readiness proof.
  Source custody subsequently returned: the local header candidate now permits
  group wrapping and retains right-aligned account controls, with no permission
  change. Exact diff inspection and whitespace checks pass; browser acceptance,
  checks, reviews, commits and publication remain pending. The user explicitly
  approved restoring the committed GrowthBook test default and retrying exact
  devrouter 0.0.52 repair with Blob port 10043. The environment file is now clean.
  Repair still exits one before startup: the app Compose configuration hash
  differs. All eight other service hashes match, and configured app environment
  values match the retained container. The remaining mismatch is unresolved.
  Published head c8c35e2d94d06c42c4dc94ff41170dc2ed01c51f remains draft and
  mergeable, with passing GraphQL/codebase checks and no unresolved review
  threads. The two local browser-test repairs and approved header layout fix
  still need focused qualification and reviews. Do not replace that work with
  generic manual testing or claim full v3-ai acceptance. Fresh host inspection
  confirms all nine retained task containers exited, zero checkout routes and
  no active lifecycle command. Managed state remains degraded at process-start.
  Devsy Issues owns the separate runtime repairs; its isolated prototype passes
  are not deployed fixes, and its required review is blocked by unavailable
  review credits. No duplicate tooling fix or guard bypass is authorized here.
  The generation goal remains blocked on runtime qualification. Outbound
  cross-thread messaging is unavailable; the package plan retains the exact
  consumer evidence without claiming delivery. No reset, deletion, new source
  publication or upstream integration occurred.
  The earlier successful restoration below is historical. Current recovery
  and resume details live in the existing package plan.

- 2026-09-05 — Local workspace restored for
  [PR #5777 — generation lifecycle contracts](https://github.com/uzh-bf/klicker-uzh/pull/5777).
  The user confirmed cleaning OrbStack and requested recreation. After
  explicit runtime custody coordination, one canonical ensure completed with
  the supported temporary Blob port override 10043, avoiding the other
  workspace's port10003 listener. Fresh bootstrap initialized and seeded the
  local database. Full-profile managed readiness passed with zero drift,
  healthy required services, and both Hatchet workers live. Workspace
  rs-generation-lifecycle-contract and Compose default-rs-f189c are retained
  running for the user's manual verification under Klicker KB/KG/Generation
  custody. Revisit that lease at manual-verification completion or the next
  custody handoff; do not run broad Playwright cleanup during that use.
  Native readiness is not AI-provider or generation acceptance. The existing
  UI candidate remains local, unreviewed and unpublished; no source/configuration
  changes, peer interruption, lock bypass or volume deletion occurred.
  The prior environment blocker below is historical. Durable host-worker
  Blob routing remains separately owned, not implemented by this restoration.

- 2026-09-05 — UI verification environment blocker for
  [PR #5777 — generation lifecycle contracts](https://github.com/uzh-bf/klicker-uzh/pull/5777).
  The user explicitly approved task-local database reset/reseed and layout-only
  Header.tsx changes, preserving the release task's permission work. Those
  authority boundaries are resolved. The local test candidate now checks
  unavailable state and absence of activity-analytics requests after an observed
  profile failure, instead of pinning loading copy. Main diff inspection and
  git diff --check pass; no new commit, push or header edit occurred.
  The canonical host Playwright launch failed before setup or tests when
  Docker Hub image inspection returned `connect: bad file descriptor`.
  Container-side formatting also failed because the task container was absent.
  No database reset ran. A normal startup retry found an existing lifecycle
  owner and did not bypass its lock. Fresh metadata reports Devsy NotFound,
  no matching Compose containers and no approved database volume in either
  configured local Docker endpoint; both resolve to the same daemon. The
  routing record still contains eleven task routes. Earlier stopped/intact
  runtime evidence is historical, not current proof. Resolve the active
  lifecycle owner and runtime identity before mutation. Keep the browser
  closed, heartbeat paused, and unverified source unpublished. The existing
  draft head remains c8c35e2d94d06c42c4dc94ff41170dc2ed01c51f. Hosted-review
  credential repair stays with its owner. No peer work or shared configuration
  was changed. Resume the already-approved qualification workflow after this
  environment blocker is resolved.

- 2026-09-05 — UI qualification extension approved for
  [PR #5777 — generation lifecycle contracts](https://github.com/uzh-bf/klicker-uzh/pull/5777).
  The user authorized correcting the three inherited Playwright failures;
  hosted-review credential repair remains with its owner. The existing
  execution plan now records the bounded extension rather than opening a
  competing package. Source remains at c8c35e2d94d06c42c4dc94ff41170dc2ed01c51f.
  Read-only mapping found two stale test inputs: the absent-flag test inherits
  ai-beta enabled, and the profile-failure test intercepts UserProfile while
  the guard requests ManageUserProfile. These are diagnoses, not passing
  corrected tests. Browser inspection with synthetic CI flags reproduces
  a 761-pixel document in a 749-pixel viewport; the header user-menu menubar
  is the overflowing element. Evidence is retained at
  trees/rs/generation-lifecycle-contracts/project/_local/ui-overflow-749-before.png.
  The release task is editing Header.tsx, so the layout correction pauses for
  explicit custody direction. PR #5771's usage component remains untouched.
  The planner approved the bounded extension after one correction round.
  A local, uncommitted candidate now repairs only B-feature-access.spec.ts;
  main diff inspection and git diff --check pass, but runtime, formatter,
  package and implementation-review gates remain pending. It is not published
  or passing UI qualification. Native Playwright setup broadly deletes and reseeds the database selected
  by its host launcher; the preserved database has not been reset. Continue
  independent test repair only within the reviewed extension and obtain the
  exact database authority before that verification. No upstream integration,
  policy change, credential repair or peer-task mutation occurred. The existing
  heartbeat is paused during this correction work. The browser is closed;
  managed runtime shutdown succeeded. Fresh Devsy readback is Stopped and
  the exact source-path route count is zero; retained data remains intact.

- 2026-09-05 — Post-publication target reconciliation: the live branch API
  and fetched `origin/v3-ai` now agree on
  `795808d18e9d2fb41861ec10f89d43a752bb5cf8`. The generation-lifecycle
  branch remains at published `c8c35e2d94d06c42c4dc94ff41170dc2ed01c51f`,
  eleven commits ahead and seven behind that target. Against remote stable
  `v3` at `fbc5f4fcc2ffa1c8d25695679823134985c5a8d8`, it is 145 ahead
  and two behind. No integration occurred. GitHub's PR readback still reports
  the earlier base object `208e97d38e6abfd13d997d48200077febc8c1445` and
  MERGEABLE; this is not proof of qualification against the newer target.
  Existing head-scoped checks and reviews remain valid for their tested tree.

  [PR #5756 — enhance(kb): replace uploaded resources in place](https://github.com/uzh-bf/klicker-uzh/pull/5756)
  merged at 11:45 UTC as `de2c5eb449940b25c373d17bbaa2976dcca98eee`.
  The September 4 ownership table above is historical: resource replacement
  is now delivered target-branch input, not an open implementation to repeat.
  It adds a restrictive replacement-ticket relation and excludes resources
  with retained tickets from hard-delete maintenance. Later resource revision
  and maintenance normalization must preserve that real retention behavior.
  Chatbot authoring and framework dependency updates also landed. The nine
  generation completion, lease, workflow, draft, dispatch, accounting and
  persistence source paths checked have no target changes, but shared schema,
  generated SDL and dependency inputs changed. A future approved integration
  therefore requires relevant schema/client regeneration, package checks and
  regression verification; unchanged-head CI is not merged-result proof.

  Goal audit: the requested next dependency-eligible reviewed plan was the
  common Element completion extension, now approved, implemented and published
  within the same PR. Do not create a duplicate plan or silently extend it
  again. Exact-head qualification remains incomplete because of the three
  inherited UI failures, hosted-review authentication and gated final AI review.
  Broader lifecycle writers, KB revision and graph/generation normalization,
  usage-envelope and response-example decisions, and migration/RC proofs remain
  in their existing roadmap packages. They are not satisfied by this refactor.
