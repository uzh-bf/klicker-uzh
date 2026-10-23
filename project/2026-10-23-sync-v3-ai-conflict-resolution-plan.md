# Restore the maintained v3 to v3-ai integration

## Approval summary

Resolve the existing [draft sync PR](https://github.com/uzh-bf/klicker-uzh/pull/6595)
so it combines current development changes with the existing AI integration
branch without losing either branch's approved behavior. This is an executable
batch approved in chat: resolve conflicts, verify the integrated source and CI,
push ordinary commits to the existing sync branch, and retain draft status.
The target remains `v3-ai`; the maintained controller retains ownership of the
PR's changelog description. No new PR, stack, release or promotion path is
introduced.

Preserve source ancestry, release versions, knowledge-graph behavior, attachment
handling, conversation history, browser controls and existing CI policy. Resolve
routine overlapping edits by combining their intent rather than selecting an
entire branch wholesale. If a conflict requires a new product or security
decision, stop that dependent change and explain the concrete choice. Existing
private course records and operational findings stay outside source artifacts.

Completion means a history-preserving integration on the existing draft branch,
focused integration checks and applicable current-head draft CI, with review
findings addressed. Intentional draft skips are not executed test passes. Missing
browser proof leaves verification explicitly incomplete. Source checks do not establish
release acceptance or learner outcomes. Mark-ready, protected-branch merge,
force-push, tagging, deployment, live configuration, paid chatbot evaluation and
evaluation allowances remain outside this batch.

## Execution details

### Context and ownership

- Source: `f2edd0afcbdc36a687d4df4564bda75b67e475eb` from `v3`.
- Integration target: `3c78ec4a50bb91177d6c8b09e7812f4cae93a134` from `v3-ai`.
- Branch: `sync/v3-into-v3-ai-f6df1bbb83` in the repository-local
  `trees/sync-v3-ai-conflict-resolution` worktree.
- Artifacts root: existing `project/`. Execution mode: standard; runtime model
  identity unknown. Main owns integration, scope, external effects and proof.
- A read-only source explorer owns the four Chat runtime/API/UI conflict-intent
  analyses. Main owns all edits and other conflicts. Later reviews cover the
  immutable integrated range; specialists do not perform external effects.

### Test portfolio

| Consequential risk | Existing protection and primary seam | Obligation |
| --- | --- | --- |
| Lost Chat history, graph metadata or document parts | `pnpm --filter @klicker-uzh/chat test:run` including `chat-response-hydration.test.ts`, `history-attachment-serialization.test.ts`, `message-attachment-behavior.test.ts`; Chat `check` | none; use existing suites and browser checks |
| Dropped locale keys or incompatible seed configurations | Locale key-set comparison to both parents; `apps/chat/test/local-mcp-seed.test.mjs` and `pnpm --filter @klicker-uzh/prisma-data check` | none; inspect seed clearing of overrides and retained model IDs; never assert seed prose |
| Changed CI routing or broken development composition | `node --test .github/scripts/playwright-route.test.cjs .github/scripts/warpbuild-admission.test.cjs .github/scripts/validate-public-playwright-workflow.test.cjs`; `docker compose -f .devcontainer/docker-compose.yml config --quiet` | none; use existing contract tests |
| Lost target ancestry or incompatible release inputs | Git ancestry, frozen lock consistency, `pnpm run check:syncpack`, `bash util/check-prisma-sync.sh` and hosted CI | none; verify producing runs |

If a reproduced integration failure needs new coverage, main first updates this
portfolio with the consequential behavior and existing test destination. No new
implementation file is planned; this plan is the only new tracked file.

### Delegation map and slices

| Slice | Owner and dependency | Acceptance and stop condition |
| --- | --- | --- |
| Preserve both branches in one integration | Main; planning approval and the four-file explorer's findings are dispositioned first | All eleven conflicts resolved; both parents and every automatic merge result accounted for; stop for a new behavioral decision |
| Verify integrated behavior and review | Main; depends on integration; read-only simplifier/risk/final specialists own only their reports | Named tests plus synthetic browser proof and source review; a missing check remains incomplete |
| Publish the existing draft and settle CI | Main; depends on local verification and integrated review | Ordinary push, draft/auto-merge readback and applicable CI; stop on terminal capability or bounded recovery exhaustion |

Conflict paths: `.devcontainer/docker-compose.yml`,
`.github/scripts/playwright-route.cjs`, `apps/chat/src/app/RuntimeProvider.tsx`,
`apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`,
`apps/chat/src/components/thread.tsx`, `apps/chat/src/hooks/useChatResponse.ts`,
`docs/ci-and-deployment.md`, `package.json`, `packages/i18n/messages/de.ts`,
`packages/i18n/messages/en.ts`, `packages/prisma-data/src/data/seedChatbots.ts`.

### Sequence

1. Review this frozen plan, then commit it on the existing sync branch. Merge
   the frozen target into that branch without rebasing or rewriting history.
2. Resolve the eleven previewed conflicts: development compose, Playwright
   routing, four Chat files, CI/deployment documentation, root package manifest,
   two locale catalogs and chatbot seed data. Inspect both parent histories and
   preserve all compatible changes. Account for automatic merge results too.
3. Run the smallest useful checks first, then applicable container-based package
   verification and required hosted CI. No dependency upgrade or new tool is
   part of resolution. Record missing browser proof explicitly if unavailable;
   do not substitute static checks for interaction acceptance. Browser checks
   use seeded/synthetic local history to verify thread load/reload, graph-link
   affordances, document composer parts, filtering/export and per-mode controls;
   send no inference. Retain captures and distinguish unexercised paths.
4. Commit the merge and any verified integration correction. Run a simplification
   pass and one risk review over the merge resolution and committed corrections.
   Record the merge SHA and both parents, inspect resolution hunks against both
   parents and automatic results. Final whole-branch review covers frozen target
   `3c78ec4a50bb91177d6c8b09e7812f4cae93a134..FINAL_HEAD` with its complete path
   manifest. One initial review and at most one same-reviewer material correction
   pass are allowed; unresolved findings then require scope/risk reassessment.
   Review public source only; private operational evidence is excluded.
5. Push normally to the existing branch, check draft/auto-merge state, inspect
   feedback and verify exact-head CI through one supported watcher. Leave the
   controller-owned changelog body unchanged. Keep final manual review's draft
   eligibility separate from draft-stage completion. Expected draft contexts are
   `check`, `check-gitleaks`, `test-graphql-status`, `test-unit-status`,
   `test-intl-production-status`, `test-olat-api-status`, `test-playwright-status`,
   and `build-images-status`, subject to authoritative ruleset/readback. Record
   actual job execution versus intentional sync-draft skips for every context;
   deferred Playwright/images do not establish those application checks ran.

Review corrections stay inside this batch when they repair integration without
changing product behavior or authority. Target integration repeats only for a
concrete conflict or required freshness reason. A new source movement alone
does not justify repeated integration. CI infrastructure failures receive
one diagnosed retry per failed infrastructure run, with at most two such
recoveries for the package. Repeated infrastructure failure is a capability
blocker; do not alter runner policy or CI architecture. Description ownership
remains with the controller throughout feedback and CI handling.

## Progress

Plan derived from the approved executable batch; planning challenge approved
after correcting draft-check semantics, exact review scope and finite recovery.
Initial dependency-free route/admission/controller checks: 48 passed. No merge
or source resolution has started. The PR is draft and auto-merge is off.
