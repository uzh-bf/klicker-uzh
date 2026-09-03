# v3-ai pre-release improvement roadmap (G2 execution breakdown)

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
  hygiene work that must land before `v3-ai` is merged into `v3` for the
  3.4.0 AI release. It references v4, the
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
> session context. Read [docs/index.md](../docs/index.md),
> [docs/domain-model.md](../docs/domain-model.md), and
> [docs/async-and-workers.md](../docs/async-and-workers.md) first. Every
> W-item has Do/Check steps, a working context, and an authority line. When a
> W-item and v4 disagree, v4 wins; when v4 and this file both point at an ADR,
> the ADR wins unless §7 records that the ADR is being amended.

### Orchestration contract

| Field | Content |
| --- | --- |
| Goal and terminal | `v3-ai` carries the normalized schema, a rewritten single migration tail, and the DRY/hygiene fixes below, with every W-item `pr_ready` or `merged` into `v3-ai` and the N6 migration proofs green. Orchestration ends when W11 (migration-tail rewrite) is merged and its proof evidence is recorded in §10. |
| Mode and boundary owner | `rs-roadmap-orchestrator` owns Phase 5 review at each W-item boundary and is the only writer of §10 Progress. Juniors return a boundary candidate; they never edit this file. |
| Question channel | Orchestrator by default. A junior that hits an unlisted decision stops, writes the question into its execution plan's Progress, and returns `NEEDS_CONTEXT`; it does not interview the user directly. |
| Authority layers | Granted to juniors: worktree creation under `trees/`, in-scope edits, in-container checks, local commits, pushing their own task branch, opening or updating their own draft PR against `v3-ai`. Withheld from juniors and from the orchestrator (user only): merging any PR, writing `STG_PROMOTION_PAUSED`, rulesets, tags, any `v3`↔`v3-ai` merge or rebase, ArgoCD or staging actions, destructive resets, changes to secrets or Infisical, edits inside other tasks' worktrees. |
| Writer budget | At most three simultaneous writers: W1 (hygiene), W2 (backend DRY), W3 (app DRY) are disjoint. Schema-changing items W5–W10 are serialized, one writer at a time, because they share `packages/prisma/src/prisma/schema/*.prisma` and the migration tail. |

## 2. How to work on this

Repository: `uzh-bf/klicker-uzh`. Base for every W-item: the **current
`origin/v3-ai` head at the moment the worktree is created**, never a
hard-coded SHA. Record the exact base SHA in the W-item's execution plan and
in the boundary candidate. Never use `v3` as a base or a PR head.

Bring-up, per W-item (all commands from the repository root of the primary
checkout, on the host):

```bash
git fetch --prune
git branch <branch> origin/v3-ai       # e.g. rs/w1-repo-hygiene
devrouter workspace up <branch>        # creates the worktree, builds + starts the linked stack
devrouter exec trees/<workspace> -- pnpm install --frozen-lockfile
```

`devrouter workspace up` creates the worktree itself; do not run
`git worktree add` first. It derives `<workspace>` from the branch by replacing
`/` with `-` (`rs/w1-repo-hygiene` becomes `rs-w1-repo-hygiene`), places the
worktree at `trees/<workspace>`, and truncates the workspace label to 32
characters because it becomes a hostname label
(`https://manage.klicker.<workspace>.localhost`). Keep branch slugs short
enough that the truncated label stays unique. Every `trees/<branch>` below
means that `trees/<workspace>` path.

Run every check **inside the container** through `devrouter exec
trees/<branch> -- <command>`; never run `pnpm install`, `pnpm build`, or
husky hooks on the host against a linked worktree (see §5). Standard loop:

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

Branch and PR conventions: branch `rs/<w-item-slug>`; conventional-commit
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

## 3. Current state (verified 2026-09-03)

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

## 5. Known traps

- **Host husky hooks break the container.** Symptom: `git commit` or `git
  push` on the host runs `pnpm` against the host store, then `turbo dev`
  in the container 502s. Cause: pre-commit/pre-push hooks install on the host.
  Remedy: run the check loop in-container, then commit and push with
  `--no-verify` and disclose it in the PR body.
- **Linked-worktree apps look dead.** Symptom: every page renders but nothing
  hydrates. Cause: Next `allowedDevOrigins` glob misses the namespaced host.
  Remedy: prove hydration on one page before diagnosing any feature; the
  glob must be `**.localhost`.
- **Typegen 404s routes while the dev stack is up.** Symptom: after `pnpm run
  check`, an app's API routes return 404. Remedy: `touch` the affected
  `route.ts`/page files inside the container; do not restart the stack.
- **GraphQL tests wipe the dev database.** Remedy: after `pnpm --filter
  @klicker-uzh/graphql test`, reseed (`prisma:reset:raw --force`,
  `prisma:push:raw`, `seed:raw`) before browser checks. The seed is not
  idempotent (`docs/solutions/best-practice/dev-seed-is-not-idempotent-reset-first.md`).
- **Stale `*.tsbuildinfo` makes rollup fail on raw TS.** Symptom:
  `Expected ',', got 'X'` from a package build after any host build. Remedy:
  `find . -name "*.tsbuildinfo" -not -path "*/node_modules/*" -delete` inside
  the container.
- **Hatchet workers under `tsx --watch` lose workflows.** Symptom: `workflow
  not found` after a file save. Remedy: run workers without `--watch` when
  testing worker behavior.
- **`final-ai-review` fails on PRs targeting `v3-ai`.** Cause: repository
  policy rejects a non-default target without native stack metadata (v4
  Progress, 2026-09-02). Remedy: open the PR through `$gh-stack` so it carries
  stack metadata; never retarget to `v3` and never invent metadata.
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

Order is dependency order. W1–W3 are parallelizable and schema-free. W4
(N1) is schema-free and may run in parallel with W2/W3 once W1 has validated
the pipeline. W5–W10 are schema-changing and serialized. W11 (N6) is last.
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

- **Problem:** Five copies of the advisory-lock helper, status literal sets
  re-derived in seven places, eleven blob-client constructions, a duplicated
  JWT module, and triplicated MCP auth literals make every N-item touch more
  files than necessary and invite drift.
- **Do:**
  1. Replace the five lock helpers in
     `packages/graphql/src/services/knowledge.ts` (:437–:530) with one helper
     parameterized by lock namespace and key. Behavior-preserving: same lock
     ids, same transaction scope. Binding: do not change lock granularity.
  2. Create one module exporting the ingestion, graph-build, and
     generation-build status sets (`IN_FLIGHT`, `TERMINAL`, and per-domain
     `SUCCESS`/`FAILURE`) as `as const` arrays derived from the Prisma enums,
     and use it in `knowledge.ts`, `kbIngestion.ts`, `kbMaintenance.ts`, and
     any other literal-set site a grep for the enum members finds. Place it in
     `packages/graphql/src/services/` next to its consumers unless the Hatchet
     package also needs it, in which case `packages/types`. Judgment
     expected on the file name. Do **not** merge `KBIngestionStatus` and
     `KBGraphBuildStatus` enums (ruling, §7 A-log).
  3. One blob-client factory in `packages/util` (or `packages/kb-management`
     if only KB code uses it after step 3's grep), replacing all eleven
     construction sites. Same credential resolution order as today; document
     that order in one comment at the factory.
  4. `apps/mcp-lecturer/src/jwt.ts`: delete and import from
     `@klicker-uzh/util` (`packages/util/src/jwt.ts`). Move the MCP auth
     literals shared with `apps/chat/src/lib/server/mcpAuthMint.ts:9-21` into
     `packages/types` and import them in all three places.
  5. `flashcardGenerationRuntime.ts:9-15`: replace the `'startFlashcards' in
     runtime` duck typing with an explicit discriminant or a shared interface;
     judgment expected on which.
  6. **GATED on A2 (v3→v3-ai sync):** normalize Hatchet task retries in
     `packages/hatchet/src/index.ts` (cron tasks :426, :437, :454 to match the
     `retries: 3` policy or an explicit `retries: 0` with a comment saying why).
     Do this step only after the sync has landed, because the file is one of
     the eleven conflict sites; if A2 is declined, do it inside W11 instead.
- **Check:** `pnpm run check`, `lint`, `test:run` green in-container;
  `pnpm --filter @klicker-uzh/graphql test` green after reseed; grep shows one
  advisory-lock helper, one blob-client factory, zero occurrences of the
  removed literal arrays; `apps/mcp-lecturer` builds and its existing tests
  pass. Negative check: reverting the status-set module import in
  `kbMaintenance.ts` must fail typecheck, proving the sets are consumed.
- **Working context:** worktree `trees/rs/w2-backend-dry`, branch
  `rs/w2-backend-dry` from current `origin/v3-ai`, draft PR → `v3-ai`. Owned
  seams: `packages/graphql/src/services/{knowledge,kbIngestion,kbMaintenance,
  flashcardGenerationRuntime}.ts`, `packages/util`, `packages/types`,
  `apps/mcp-lecturer/src`, `apps/chat/src/lib/server/mcpAuthMint.ts`, and
  step 6 only after its gate. Single writer.
- **Authority and terminal:** local commits, push, draft PR; `pr_ready`.
  `simplifier` pass required (this is a DRY item; it must end with less code).
- **Boundary owner:** `rs-roadmap-orchestrator`.
- **Release-note impact:** none.
- **Depends on:** W1 merged or at least `pr_ready` (pipeline validated).
  Step 6 GATED on A2. **Priority:** P2 (P1 for steps 1–2, which N1 builds on).

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
  (host-run against the worktree URLs).
- **Working context:** worktree `trees/rs/w3-app-dry`, branch `rs/w3-app-dry`
  from current `origin/v3-ai`, draft PR → `v3-ai`. Owned seams:
  `packages/types/src/chatContext.ts`, `apps/frontend-manage/src`,
  `apps/frontend-pwa/src/components/chatbot`, `apps/chat/src` (excluding
  `mcpAuthMint.ts`, owned by W2), `packages/i18n`. Single writer.
- **Authority and terminal:** local commits, push, draft PR; `pr_ready`.
  `simplifier` pass required.
- **Boundary owner:** `rs-roadmap-orchestrator`.
- **Release-note impact:** none.
- **Depends on:** W1 `pr_ready`. Runs in parallel with W2. **Priority:** P2.

### W4 — N1 lifecycle services and invariant tests

- **Problem:** v4 N1. Status transitions for KB resources, ingestion runs,
  graph builds, and generation builds are written directly by resolvers,
  workers, and maintenance code, so the invariants N2–N4 depend on (one
  active revision, reservation released on terminal state, no orphaned
  external state) have no single enforcement point and no tests.
- **Do:**
  1. One lifecycle service module per aggregate (KB resource, ingestion run,
     graph build, generation build) under `packages/graphql/src/services/`
     (or `packages/kb-management/src` for the KB ones if that is where the
     callers already live; judgment expected, pick one and say why in the
     plan). Each exposes named transitions (`start`, `succeed`, `fail`,
     `cancel`, `expire`…) that validate the from-state using the W2 status
     sets and perform the side effects the transition owns (reservation
     release, active-pointer move, cleanup enqueue).
  2. Route every direct `status`/`stage` write in `packages/graphql`,
     `packages/kb-management`, `packages/hatchet`, and `apps/chat` server code
     through those services. Grep for `status:` writes on the four models to
     find them all; list the sites in the plan before changing them.
  3. Invariant tests (vitest, in `packages/graphql/test/` or the kb-management
     package, whichever hosts the service): illegal transition rejected; every
     terminal transition releases its reservation; cancel/expire from a
     review-gate wait releases the reservation and unpins the graph build (v4
     §7.3 gate lifecycle rule). Worker-restart behavior for the two durable
     waits gets a test only if it can run without live Hatchet; otherwise
     record it as a §13.1 proof for the RC qualification, not here.
  4. No schema change in this item. If a transition needs a column that does
     not exist yet, stub the side effect and leave a `// N3:` or `// N4:`
     marker naming the W-item that adds it.
- **Check:** in-container `check`, `lint`, `test:run` green; the new invariant
  suite fails when a service's from-state check is commented out; grep for
  direct status writes on the four models outside the services returns only
  the seed and migration scripts.
- **Working context:** worktree `trees/rs/w4-n1-lifecycle-services`, branch
  `rs/w4-n1-lifecycle-services` from current `origin/v3-ai` after W2 has
  merged (or stacked on W2 via `$rs-stacked-change` if W2 is still open).
  Draft PR → `v3-ai`. Owned seams: the four service modules, their callers,
  `packages/graphql/test`. Single writer.
- **Authority and terminal:** local commits, push, draft PR; `pr_ready`.
  `slice-reviewer` per slice (architecture seam), `final-reviewer` before
  `pr_ready`.
- **Boundary owner:** `rs-roadmap-orchestrator`.
- **Release-note impact:** none.
- **Depends on:** W2 steps 1–2 (status sets, lock helper). **Priority:** P1.

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
  2. Replace the dual-written chatbot–KB binding with the association table
     and unique active binding per v4 §6 row "Chatbot–KB binding"; remove the
     dual write.
  3. Move the denormalized ingestion state off `KBResource` onto the revision
     or the operation, whichever the transition in W4's service owns. Read
     paths that today read `KBResource.status` read through the service.
  4. Deletion and retention per v4 §7.6: no owner cascade that erases
     external-cleanup correlation; `SetNull` on audit relations.
  5. One generated migration, `kb_resource_revisions_and_operations`. Data
     backfill for existing resources is a migration step only if the seeded
     and staging data need it; production has none of these tables yet (they
     are not on the prod tag), so prefer no backfill and say so in the PR.
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
     validator in `packages/types`; no new dependency); rename the per-item
     row to `GeneratedElementDraft` (v4 §6, glossary "Generated element
     draft"); record AI origin on `Element` itself when a draft is saved
     (`docs/solutions/best-practice/generated-element-keep-is-one-transaction.md`
     governs the save transaction). Gate lifecycle rule (Restrict FK to the
     source graph build, gate expiry auto-cancel) is implemented through the
     W4 services.
  3. Replace the hand-written CHECK constraints in the current tail that
     encode "generatable element types" with one exported constant in
     `packages/types` that the Prisma enum, the validator, and the GraphQL
     enum all derive from; the DB-level CHECK is re-added by W11 only if the
     enum cannot express it.
  4. Unify the three difficulty notions to one enum used by generation input,
     draft, and saved element; record the mapping in the PR body.
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
  2. **GATED on A4 (digest replacement).** Default if A4 rules as
     recommended: remove the persisted `digest` column and compute the set
     digest at load time in `apps/chat/src/lib/server/responseExampleRuntime.ts`
     from the approved examples (reuse `computeResponseExampleSetDigest`
     from `@klicker-uzh/util`), so `setDigest` at :377/:383 and the chat route
     at :1166 keep identical values for identical content. Delete the two
     write sites (`responseExamples.ts:116`, `responseExampleRuntime.ts:193`).
  3. Add the `reviewedBy` relation (`SetNull` on user deletion, per v4 §7.6).
  4. Amend ADR-0028 (response examples) "Decision" paragraph so the captured
     input artifact is "the current approved example content and a digest
     computed from it at capture time" and record the amendment date; do not
     rewrite the rest of the ADR.
  5. One generated migration, `response_examples_direct_chatbot`. The
     `chatbotId` backfill (copy it from the set before dropping the column)
     is a manual `UPDATE` inserted into the generated migration; mark it with
     a SQL comment saying so. It exists only for seeded and staging data;
     production has no sets, and W11 deletes this migration when it squashes
     the tail.
- **Check:** one migration; `packages/util/test/responseExampleRuntime.test.ts`
  green with the digest computed rather than read; new test: two loads of the
  same approved set produce the same digest, an approval changes it;
  `Y-response-examples` Playwright green; `agent-browser` screenshot of the
  review inbox and of a chat turn that used examples (source card present).
- **Working context:** worktree `trees/rs/w7-n3b-response-examples`, branch
  `rs/w7-n3b-response-examples`, base after W6 merged (or stacked). Draft PR →
  `v3-ai`. Owned seams: `chat.prisma`, `responseExamples.ts`,
  `responseExampleRuntime.ts`, the chat route's digest line, ADR-0028.
- **Authority and terminal:** as W5.
- **Boundary owner:** `rs-roadmap-orchestrator`.
- **Release-note impact:** none.
- **Depends on:** W6; step 2 GATED on A4. **Priority:** P1.

### W8 — N5 participant practice and student generation re-cut

- **Problem:** v4 N5 / D13: PRs #5481→#5482→#5483 carry the participant
  practice and student-generation work on an old base; #5483 is conflicting.
  `PersonalElement` (ADR-0026) and the plan-first generation contract
  (ADR-0027) are the target, but those ADRs are not on any remote (§3).
- **Do:**
  1. **GATED on A3 (ADR-0026/0027 provenance) — do not start before the
     ruling.**
  2. Re-cut the three PRs' content onto current `v3-ai` as a fresh stack
     (`$rs-stacked-change`, ≤3 packages): model (`PersonalElement`,
     participant-owned, never a lecturer content model), generation contract,
     UI. Reuse code by cherry-pick or re-implementation, whichever conflicts
     less; the old PRs are then closed by the user, not by the junior.
  3. Usage accounting for student generation writes through whichever
     envelope A1 selected (ledger or fallback); if A1 is unruled when this
     item starts, write through the W4 service with a `// N4:` marker.
  4. One generated migration, `personal_elements_and_student_generation`.
- **Check:** one migration; invariant tests: a participant cannot read
  another participant's `PersonalElement`; deleting a participant follows v4
  §7.6 (no cascade that erases cleanup correlation). `agent-browser` PWA
  screenshots of the practice flow as `testuser1`.
- **Working context:** worktree `trees/rs/w8-n5-participant-practice`, base
  after W7 merged. Draft PR stack → `v3-ai`.
- **Authority and terminal:** as W5.
- **Boundary owner:** `rs-roadmap-orchestrator`.
- **Release-note impact:** "students can generate their own practice
  questions" is claimable only at `live_proven` and only if the entitlement
  defaults allow it (v4 §3).
- **Depends on:** W7; GATED on A3; A1 for accounting. **Priority:** P2 (v4
  puts it in the RC, but it is the first item to park if the Sep 10 cut is at
  risk).

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
- **Check:** one migration; tests: reservation released on every terminal
  transition (already in W4, now against the real table); idempotent event
  replay does not double-count; guest chat turn draws from the owner's
  budget (v4 §7.5, keyed on chatbot owner). `docs/domain-model.md` and
  `CONTEXT.md` usage terms unchanged in meaning.
- **Working context:** worktree `trees/rs/w9-n4-usage-ledger`, base after W8
  (or W7 if W8 is parked). Draft PR → `v3-ai`.
- **Authority and terminal:** as W5.
- **Boundary owner:** `rs-roadmap-orchestrator`.
- **Release-note impact:** none user-facing; the G1 manifest records which
  envelope shipped.
- **Depends on:** W4, W6; GATED on A1. **Priority:** P1 (one of the two
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
  is the seven v3-ai-only §3 directories plus one per N-item; production has
  none of them. The two `chat_*` migrations and `course_deletion_request` in
  §3 belong to `v3` and stay exactly as they are. The RC must carry the v3 roadmap's named chain, not the history.
- **Do:**
  1. **GATED on W5, W6, W7, W9 merged (and W8 if not parked).** Rerun the
     migration inventory against the merged tree; do not trust §3 line
     numbers.
  2. Read production `_prisma_migrations` first (v3 roadmap proof 1; the
     user provides read access or the list; the junior never connects to
     production itself). Every migration present there stays byte-identical.
  3. Delete every tail migration absent from production and regenerate the
     chain with `prisma migrate dev` into the named directories of the v3
     roadmap (`ai_platform_core`, `chatbot_authoring_and_examples`,
     `knowledge_base_resources_and_operations`,
     `knowledge_graph_builds_and_artifacts`, `element_generation`, plus the
     usage-envelope migration from W9). Split points follow the v3 roadmap;
     do not invent new ones.
  4. Re-add only the unavoidable manual SQL: the partial unique index and any
     CHECK the Prisma enum could not express (W6 step 3 should have removed
     most). Each re-added statement gets a schema comment (`/// …` on the
     model) saying what it enforces and why generation cannot.
  5. Run the eight proofs from the v3 roadmap "Required migration proofs"
     (fresh database from the chain equals `prisma db push` of the schema;
     staging-shaped database upgrades; forward-only recovery per v4 §8;
     `prisma:sync` mirror equality in `apps/analytics`; codegen clean; full
     rebuild). Record each proof's command and output hash in the PR body.
  6. Update `docs/domain-model.md` migration section and the
     `klicker-data-model` skill; update the gitignored G1 manifest through
     the orchestrator (the junior lists what changed; the orchestrator writes
     the manifest).
- **Check:** `prisma migrate diff --from-migrations … --to-schema-datamodel …`
  empty; `prisma migrate deploy` on a fresh database succeeds and a second
  run is a no-op; all eight proofs recorded; `pnpm run build` green; `pnpm
  run test:run` green; Playwright full suite green on the staging-shaped
  local stack (shard 5 and 8 flake once is not a failure; rerun once).
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
§10): keep two status enums; keep the GenerationStatusProvider timer; the
lock-helper consolidation preserves lock ids and scope; superseded plans are
marked, never deleted; the RC-branch ADR (not the response-example ADR) is
the one renumbered; N1 is schema-free, N2–N5 add migrations normally and only N6 rewrites.

| ID | Question | Options | Recommendation | Gates |
| --- | --- | --- | --- | --- |
| A1 — usage envelope for the RC | At the Sep 6 checkpoint (v4 §7.5): does the neutral AI usage ledger ship in the RC, or the per-domain fallback? | (a) ledger; (b) fallback, ledger first post-RC train | (a) only if W4 and W5 are `pr_ready` by Sep 6 and W6 has started; otherwise (b). D5 holds either way. | W9 (which branch), W8 step 3 |
| A2 — `v3`→`v3-ai` sync before normalization | Perform one v4 §5.1 sync (throwaway `sync/v3-<date>` branch, PR into `v3-ai`) now, before W2–W11 cut their worktrees, so the 11 §3 conflicts are resolved once instead of growing under every N-item? | (a) sync now; (b) defer to the Sep 10 final cutoff | (a). The conflicts are in files W2 and W11 touch; deferring multiplies resolution work. The sync itself remains a user-performed action. | W2 step 6; base freshness of W4–W11 |
| A3 — ADR-0026/0027 provenance | v4 N5 depends on ADR-0026 (`PersonalElement`) and ADR-0027 (plan-first generation), which exist only as untracked files in another session's primary checkout. Who commits them, on which branch, and are they final? | (a) that session's owner commits them to `v3-ai` (or `v3`) first; (b) the W8 junior authors them fresh from v4 §3.4/§6; (c) park W8 | (a); W8 waits for them. Do not let a junior write ADRs it did not decide. | W8 |
| A4 — response-example digest | v4 D2 drops `digest` as consumerless, but it feeds `setDigest` and the chat route (§3). Replace with a digest computed at load time (no column), keep the column on `ResponseExample` rows, or keep the set? | (a) compute at load, drop column, amend ADR-0028; (b) keep a persisted digest on the chatbot; (c) keep the set | (a). Same values for same content, no wrapper, ADR intent preserved. | W7 step 2 |
| A5 — MCP shared core now or later | Extract `packages/mcp-core` before the RC, or only do W2's JWT/literal reuse now? | (a) now (W10); (b) post-RC | (b). No release risk is reduced by it; W2 removes the risky duplication (auth literals). Also records the chat route split as post-RC. | W10 |
| A6 — placement of PR #5668 | The system-prompt version catalog (#5668, targets `v3`, open) adds schema. Merge to `v3` before the RC and sync in, hold for the RC, or post-RC? | (a) `v3` before sync (then part of A2); (b) retarget into the N-stack; (c) post-RC | (a) if it is merge-ready this week, so W11 sees it in the production baseline; otherwise (c). Carried from the 2026-09-02 takeover table, still unruled. | W11 baseline, A2 timing |

## 8. External dependencies to watch

- **PR #5709 / #5710 stack** (question-generation review inbox, targets
  `v3`): already partly on `v3-ai` (`materialType`). Its remaining `v3`
  merge affects the A2 sync content. Awaited: merge state on `v3`.
- **Other session's ADR-0026/0027** (A3). Awaited: the files on a remote.
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
