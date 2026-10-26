# Zod 4 migration for the adaptive and audit packages

## Approval summary

**Why and what changes?** The staging backend image fails the fixable-HIGH scan policy because Zod 3.25.76 (CVE-2023-54404) is still installed. Draft [#6699](https://github.com/uzh-bf/klicker-uzh/pull/6699) migrates the upstream consumers on `v3-ai` to Zod 4.6.6: graphql, chat, the MCP apps, Hatchet SDK 1.22.0 and Pothos Zod plugin 4.3.2. Its global `zod@` override would also force Zod 4 into three packages that exist only downstream: `packages/audit`, `packages/adaptive-client` and `packages/adaptive-server`. Those packages still declare Zod 3. This package migrates them, so that the `v3-ai` → `v3-adaptive-learning` sync lands green in one step.

**What stays unchanged?** Accepted identifiers keep v3 behavior: `.uuid()` becomes `.guid()`, following #6699. The GraphQL schema and the audit canonical-hash format are not intentionally changed. Audit and adaptive learning are staged and not yet in production, so behavior differences found by tests may be fixed forward.

**What could change the decision?** Zod 4 runtime semantics differ for transforms, defaults and union diagnostics. The existing audit and adaptive suites are the detection seam. MSAL stays out of scope: the advisory's affected code path is not reachable through `DefaultAzureCredential`.

**How will we know it is done?** The steps below must hold:
- A frozen install on the qualification branch passes.
- Typecheck passes for the affected packages and graphql.
- The audit, adaptive-client and adaptive-server test suites pass.
- `pnpm why zod --prod` from `apps/backend-docker` lists only 4.6.6.
- A local backend image scan reports no Zod HIGH finding.

**What does approval authorize?** The user approved on 2026-10-25:
- the Zod migration;
- #6699 as the upstream vehicle;
- downstream delivery inside the sync branch.

Local commits, task-branch pushes and the #6699 draft update are covered by standing delivery. The following remain withheld: marking #6699 ready, merging, pushing to the bot sync branch until #6699 has merged, deployment, and any scanner-policy change.

## Execution details

### Topology

- **Upstream:** `fix/parser-zod-security` (#6699) has been integrated with `v3-ai` 4f5ea565a7 (merge d3d6acc2d2) and must be re-verified.
- **Qualification:** `fix/zod4-downstream-migration` is `origin/v3-adaptive-learning` aea663353d plus a local merge of #6699. It is never merged or opened as a PR. Its downstream-only commits are applied to the bot sync branch after #6699 merges.

### Changes

- Manifests: audit and adaptive-client `zod` 4.6.6; adaptive-server peer `^4.6.6`. Downstream graphql and the worker manifests keep their downstream workspace dependencies plus Hatchet 1.22.0 (merge resolution).
- Schemas: 20 `.uuid()` calls become `.guid()` in adaptive-client, adaptive-server and audit.
- Further fixes only where typecheck or tests show a Zod 4 difference.

### Test portfolio

| Risk | Obligation | Seam |
| --- | --- | --- |
| Audit payload parsing changes canonical output | extend existing only if a gap appears | audit suite (contract and canonical-hash tests) |
| Adaptive artifact and contract parsing changes | none; existing suites | adaptive-server and adaptive-client suites |
| Zod 3 left in backend closure | none | `pnpm why`, local image scan |

### Verification

All checks run in the container. Frozen install, `pnpm run check`, the three package suites and the graphql suite, then a local backend image build and Trivy scan.

## Progress

- 2026-10-25: #6699 integrated with v3-ai (d3d6acc2d2). Qualification branch merged, conflicts resolved, manifests and `.guid()` changes applied. Verification running.
- Execution mode: solo (Opus 5.5). Final simplification and review: self-review, recorded at finish.
- 2026-10-26: Merged the #6699 head 168b915b2d without conflicts. Mirrored the `test-graphql` CI job locally with disposable containers, a fresh `klicker_test` database and a local Catalyst adaptive engine. Audit 140/140, response-api and response-processor 84/84, backend-docker 8/8 and GraphQL 1963 passed with 4 skipped. Audit, adaptive-client and GraphQL typechecks pass. A Trivy v0.74.0 HIGH/CRITICAL scan of a locally built backend image reports only the known `@azure/msal-node` finding; the Zod finding is gone. Remaining: apply the manifest resolution and 8eb9e072c2 on the bot sync branch after #6699 merges.
- 2026-10-26: #6699 merged into v3-ai (285d96fc67). Merged v3-adaptive-learning into the bot sync branch at that head and folded the manifest resolution and the 8eb9e072c2 source fixes into the merge, so every commit passes the hooks. Next 16.4.3 from #6716 also required the downstream adaptive UI `next` peers to move to ^16.4.3. The lockfile resolves only Zod 4.6.6. Pre-commit `check:all` and pre-push build pass in the container. Audit 140/140, adaptive-client 17/17 and the adaptive-server standalone suite 19/19 pass; the GraphQL suite result above is reused because the downstream source is unchanged since that run, and the sync PR's CI runs it again.
