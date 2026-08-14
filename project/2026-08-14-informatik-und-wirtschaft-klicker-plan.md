# Informatik und Wirtschaft native Klicker chatbot

## Goal

Add one native Klicker chatbot configuration path for the Informatik-und-Wirtschaft video corpus by reusing the existing doc-query MCP integration and making the required MCP binding explicit, strict, and fail-closed before any thread, model, credit, or message side effect.

## Non-goals and authority

- No deployment-route, LiteLLM, pipeline, corpus, secret, STG, production, activation, push, PR, merge, or cleanup work in this package.
- Package B remains a separate operational step. It supplies reviewed course/chatbot IDs, model/route/auth policy, disclaimer, credit policy, and credential ownership before any provisioning or deployment apply.
- This branch may edit and commit local repository code and project artifacts only. No external state change is authorized.

## Plan identity

- Plan path: `project/2026-08-14-informatik-und-wirtschaft-klicker-plan.md`
- Repository: `/Users/rschlae/Git/klicker/klicker-uzh`
- Worktree: `/Users/rschlae/Git/klicker/klicker-uzh/trees/informatik-und-wirtschaft-klicker`
- Branch: `rs/informatik-und-wirtschaft-klicker`
- Target: `v3`
- Base: `origin/v3` at `b1ea5ecba8aa835d6639ae3717a2aa456f470fc9`
- PR/MR: none
- History: [previous cross-repository plan](../../../ai/klicker-uzh-video-ai/project/2026-08-14-informatik-und-wirtschaft-klicker-chatbot-migration-plan.md) and its handoff remain background evidence, not the current execution contract.

## Research

- Problem: The old handoff plan treated a one-course chatbot as a multi-layer migration and relied on deployment-side assumptions that are not part of this repository.
- Evidence: The current chat route already loads enabled MCP configs, aggregates tools, builds prompt-cache identity from the final tool map, and recognizes generic `doc_query` source names. The current route filters inactive servers before the aggregator and creates a thread before MCP aggregation; both orderings weaken a required binding.
- Evidence: The existing `ChatbotMCPConfig.parameters` JSON field can carry a narrow runtime policy without a schema migration. The static route/tool probe found the deployment route exposes the video-expert tool rather than a bare `doc_query` tool, so Klicker needs a model-facing alias at the existing MCP seam.
- Prototype: A synthetic probe confirmed that one enabled route can carry a strict alias through the existing parameters field and that the existing source-card predicate recognizes the aliased `doc_query` name. No live MCP or credential was used.
- Planning review: `project/_local/reviews/2026-08-14-informatik-und-wirtschaft-simplified-planning.md` (`DONE_WITH_CONCERNS`) reviewed this simplified plan. Accepted corrections are recorded below.

## Decisions

- Keep this as one normal full-path PR package with a plan-first commit; do not create a stack for the reduced scope.
- Reuse `ChatbotMCPConfig.parameters` with exactly two reserved keys: `required` and `toolAlias`.
  - Existing configs without reserved keys keep current optional/fail-open behavior.
  - A strict config is `{ "required": true, "toolAlias": "<OpenAI-compatible tool name>" }`.
  - Partial, mistyped, optional-alias, wildcard, missing-alias, or disallowed-alias configurations fail closed during config validation.
  - Other parameter keys remain untouched for compatibility.
- Pass enabled MCP configs to the aggregator even when their server is inactive. Optional inactive servers are skipped; required inactive or unavailable servers produce a typed error.
- Return `503 { "code": "REQUIRED_MCP_UNAVAILABLE" }` before thread creation, model/cache work, image-model work, credit usage, or message writes. Preserve existing generic handling for optional failures.
- Alias only the single allowed raw tool for the strict config. Reject a missing raw tool, a raw-tool/alias collision, or an aggregate name collision instead of silently renaming it.
- Parse custom auth strictly: malformed custom headers are an MCP availability failure for required configs and remain an optional fail-open failure for optional configs; neither path logs secret values.
- Provisioning uses the repository's `DRY_RUN=false` safe-mutation protocol. The apply path validates the reviewed payload and before-state lock, then performs create-or-verify in one serializable transaction: absent exact state creates, exact desired state is a no-op, and partial/competing/drifted state performs zero writes.

## Primitive impact

| Primitive | Disposition | Contract delta |
| --- | --- | --- |
| Course chatbot | Reuse | Existing chatbot ownership, access, disclaimer, credits, model, and route contracts remain in force. |
| MCP server/config binding | Extend | Existing configs remain optional; a reserved JSON policy can make one exact tool binding required and give it a model-facing alias. |
| Chat sources and citations | Reuse | Existing generic `doc_query` recognition remains the source/citation contract; no source schema or renderer change is planned. |
| Course provisioner | Create | A one-shot, idempotent repository script creates only the approved course/chatbot/MCP binding shape after strict validation. |

No new user-facing lifecycle or authorization state is introduced. If the existing source/citation contract cannot recognize the alias without production-code changes, stop this package rather than widening it.

## Data protection by design and by default

- The provisioner reads only allowlisted course/owner UUIDs and fixed configuration values from an ignored local input; it rejects names, emails, credentials, unknown fields, malformed UUIDs, and owner/course mismatches.
- Existing course and chatbot ownership/access checks remain the authority. No new personal-data category, purpose, recipient, or retention period is introduced.
- Dry-run and apply receipts contain counts, operation names, and hashes/status only; never secret values, auth headers, raw personal data, or connection strings.
- Defaults are minimum-scope: no committed operational input, no secret logging, no broad discovery, no new public access, and no writes on validation drift or partial state. The residual operational gap is immediate discoverability after a later Package B apply; activation/deployment remains outside this branch.

## Delegation map

| Slice | Owner/route | Dependency | Acceptance boundary |
| --- | --- | --- | --- |
| S0 plan | Main | Current base and reviewed simplified plan | Plan is present, reviewed, and committed first. |
| S1 strict MCP runtime | Main | S0 | Focused chat tests and chat typecheck; no thread or credit side effect on required-MCP failure. Main retains this security/cross-system seam. |
| S2 course provisioner | Native `executor` | S1 runtime contract | Focused Prisma Data tests/check plus disposable local dry-run/apply/idempotence evidence; no STG or production access. |
| S3 integrated verification | Main | S1 and S2 accepted/reviewed | Full relevant checks, local/browser evidence when the environment is available, final review, and an updated Progress section. |

## Feature-wide test portfolio

| Risk/behavior | Obligation | Primary seam | Distinct failure caught | Owner |
| --- | --- | --- | --- | --- |
| Existing optional MCP configs remain compatible | Extend existing | MCP aggregation unit tests | Existing configs unexpectedly become strict or unavailable | S1 |
| Required alias contract is exact | Add new | MCP policy/aggregation tests | Missing tool, malformed policy, inactive server, auth failure, or alias collision is silently accepted | S1 |
| Required failure has no pre-generation side effects | Add new | Narrow route-handler or preflight integration seam | Thread/message/credit work occurs before a required MCP `503` | S1 |
| Alias remains source/citation-compatible | Extend existing | Source/citation and prompt-cache identity tests | Retrieval works but source cards/citations or cache identity lose the aliased tool | S1 |
| Provisioner is safe and idempotent | Add new | Script validation and disposable local database run | Partial/competing state writes, secret-bearing receipts, or second-run duplicate creation | S2 |

## Approved slices

### S0 — Persist the execution contract

- Route: main session.
- Do: create this plan, including the accepted simplified-planner corrections, and commit it separately before implementation.
- Check: inspect the exact staged diff for secrets/PII; verify branch, base, target, and authority boundary.
- Commit: `docs(project): add Informatik und Wirtschaft chatbot plan`.

### S1 — Make required MCP aliasing strict at the chat seam

- Route: main session; execution-tier skip reason: security-sensitive runtime policy and ordering are coupled to the route's side-effect boundary.
- Do: add the small runtime-policy parser/error type; preserve optional configs; pass inactive-server state to the aggregator; apply one strict alias; propagate required availability failures; move aggregation before thread creation; add focused tests and the affected chat-platform wiki note.
- Check: `pnpm --filter @klicker-uzh/chat test:run -- test/mcp-clients.test.ts test/required-mcp-route.test.ts test/prompt-cache-identity.test.ts test/citation-instructions.test.ts`; `pnpm --filter @klicker-uzh/chat check`.
- Commit: `enhance(chat): require configured MCP tools before chat generation`.
- Review: after the immutable commit, run exactly one simplifier and one slice reviewer in parallel. Lenses: correctness, security, architecture, compatibility, and cross-system failure boundary.
- Stop condition: do not change source/citation production code, Prisma schema, GraphQL contracts, or external deployment routing in this slice.

### S2 — Add the guarded course provisioner

- Route: native `executor`, clean context, exact owned paths only.
- Do: add `packages/prisma-data/src/scripts/2026-08-14_provision_informatik_und_wirtschaft_chatbot.ts`, an ignored local input/lock fixture under `packages/prisma-data/src/data/_local/`, and only the minimal existing-script test command wiring if needed. Validate fixed IDs, owner/course relation, one intended chatbot, exactly two enabled tutor/explainer MCP configs, the raw tool, and the alias before any write.
- Check: focused Prisma Data test/check; disposable local DB dry-run; `DRY_RUN=false` apply once plus readback; second apply is an exact no-op; no STG.
- Commit: `feat(prisma-data): provision Informatik und Wirtschaft chatbot`.
- Review: after the immutable commit, run exactly one simplifier and one slice reviewer in parallel. Lenses: data integrity, idempotence, secret/PII hygiene, and maintainability.

### S3 — Integrate and verify locally

- Route: main session.
- Do: integrate accepted review findings, update Progress, run the relevant chat and Prisma Data suites, `pnpm run check:all`, and `pnpm run build`; use `npx agent-browser@0.32.2` against the local devrouter URL only if a local runtime is already available. Verify the required-MCP failure path leaves no thread/message/credit writes. Do not push, open a PR, apply STG, activate, or deploy.
- Check: fresh command output and exact diff against `origin/v3`; final review covers correctness/plan compliance, maintainability, security, architecture, and applicable data-integrity seams.
- Commit: any accepted review/Progress adjustment as a conventional follow-up commit.

## Progress

- Status: S1 review corrections are implemented and ready for the correction commit. The plan is committed as the branch's first commit. Remote `origin/v3` was fetched and still resolves to the recorded base.
- Completed: handoff takeover; current-base reconciliation; synthetic alias/source probe; simplified planning review; product-primitive and DPbDD pass; branch/worktree reuse; S0 plan commit; strict MCP runtime implementation; S1 simplifier and slice review; all accepted S1 review corrections.
- Latest committed slice: `b9b160ed8` (`enhance(chat): require configured MCP tools before chat generation`). Working-tree evidence: focused chat suite `36/36` passed. The package chat typecheck is currently blocked by pre-existing repository/dependency errors, including missing generated/workspace modules and unrelated i18n/model-registry diagnostics; no new error was reported in the changed production files.
- Planning review: done — `project/_local/reviews/2026-08-14-informatik-und-wirtschaft-simplified-planning.md`.
- Simplifier: done — `project/_local/reviews/2026-08-14-informatik-und-wirtschaft-s1-simplifier.md`; accepted redundant-default and in-process classifier reductions.
- Slice review: done — `project/_local/reviews/2026-08-14-informatik-und-wirtschaft-s1-slice-review.md`; accepted unsafe-header, collision-order, and wildcard-validation corrections.
- Remaining: S1 correction commit, S2 provisioner, S2 review/simplification, S3 integrated verification/final review.
- Active children: none.
- Delivery layer: local branch commits only. Achieved layer: none yet. Push, PR, STG apply, activation, deployment, and production remain explicitly withheld.
- Next action: stage only the accepted S1 correction and Progress changes, commit them, then dispatch the bounded S2 provisioner executor.

## Next steps

- Keep the existing cross-repository handoff and deployment route read-only.
- Reconfirm operational values and authority separately before any Package B apply.
