# Informatik und Wirtschaft native Klicker chatbot

## Goal

Add one native Klicker chatbot configuration path for the Informatik-und-Wirtschaft video corpus by reusing the existing doc-query MCP integration and making the required MCP binding explicit, strict, and fail-closed before any thread, model, credit, or message side effect.

## Non-goals and authority

- No deployment-route, LiteLLM, pipeline, corpus, secret, STG, production, activation, merge, or cleanup work in this package. The current task additionally authorizes pushing this branch and opening a draft PR only.
- Package B remains a separate operational step. It supplies reviewed course/chatbot IDs, model/route/auth policy, disclaimer, credit policy, and credential ownership before any provisioning or deployment apply.
- This branch may edit and commit local repository code and project artifacts only. The current task separately authorizes the external Git push and draft PR creation described below; no other external state change is authorized.

## Plan identity

- Plan path: `project/2026-08-14-informatik-und-wirtschaft-klicker-plan.md`
- Repository: `/Users/rschlae/Git/klicker/klicker-uzh`
- Worktree: `/Users/rschlae/Git/klicker/klicker-uzh/trees/informatik-und-wirtschaft-klicker`
- Branch: `rs/informatik-und-wirtschaft-klicker`
- Target: `v3`
- Base: `origin/v3` at `d76c13a3f28dcdbddac46ed8cc3fcb70fad42924`
- PR/MR: draft PR to be opened after the recorded local verification
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
- Do: integrate accepted review findings, update Progress, run the relevant chat and Prisma Data suites, `pnpm run check:all`, and `pnpm run build`; use `npx agent-browser@0.32.2` against the local devrouter URL only if a local runtime is already available. Verify the required-MCP failure path leaves no thread/message/credit writes. Do not apply STG, activate, or deploy during local verification; the current task separately authorizes a branch push and draft PR after this check.
- Check: fresh command output and exact diff against `origin/v3`; final review covers correctness/plan compliance, maintainability, security, architecture, and applicable data-integrity seams.
- Commit: any accepted review/Progress adjustment as a conventional follow-up commit. The current task permits a branch push and draft PR after this check; merge and deployment remain withheld.

## Progress

- Status: local implementation is complete through the integrated correction review after rebasing the unpublished branch onto the current `origin/v3` at `d76c13a3f`. The base promotion changes deployment values only; it does not contain an alternative implementation of this feature.
- Completed: handoff takeover; current-base reconciliation; synthetic alias/source probe; simplified planning review; product-primitive and DPbDD pass; branch/worktree reuse; S0 plan commit; strict MCP runtime implementation; S1 simplifier and slice review; all accepted S1 review corrections; guarded S2 provisioner, its simplifier/slice-review corrections, and wiki update; base rebase; type-only MCP tool-set correction; final-review corrections for mode enforcement, URL credential rejection, credential replay verification, receipt recovery, strict allowedTools shape, long-name source recognition, and duplicate test coverage.
- Latest committed implementation correction: `2e1de1749` (`fix(chat): close required MCP policy gaps`). The focused chat suite passed `40/40`. Provisioner `--validate-only`, Prisma Data `check:data`, Prisma Data `check:scripts`, and the synthetic query-bearing URL rejection passed. The package chat typecheck remains blocked by the incomplete linked-worktree dependency setup; no changed-file type error was isolated after the focused route tests.
- Planning review: done — `project/_local/reviews/2026-08-14-informatik-und-wirtschaft-simplified-planning.md`.
- Simplifier: done — `project/_local/reviews/2026-08-14-informatik-und-wirtschaft-s1-simplifier.md`; accepted redundant-default and in-process classifier reductions.
- Slice review: done — `project/_local/reviews/2026-08-14-informatik-und-wirtschaft-s1-slice-review.md`; accepted unsafe-header, collision-order, and wildcard-validation corrections.
- S1 correction review: done — `project/_local/reviews/2026-08-14-informatik-und-wirtschaft-s1-correction-review.md`; no findings at 100% confidence.
- S2 implementation evidence: synthetic `--validate-only` input validation passed; unknown top-level, secret-bearing, and query-bearing URL fields were rejected; `check:data` and `check:scripts` passed. The linked devrouter runtime was then started with the repository's self-contained container, its blank disposable database was initialized with the non-reset `prisma:push:raw`, and the synthetic local seed completed. A temporary synthetic fixture (restored to the template afterward) produced a five-row dry run, a five-row serializable apply, an exact second-apply no-op, and readback of the chatbot, disclaimer, inactive MCP server, and two strict tutor/explainer bindings. The receipt was removed after verification; no operational or repository data was retained.
- S2 simplifier: done — `project/_local/reviews/2026-08-14-informatik-und-wirtschaft-s2-simplifier.md`; accepted two behavior-preserving reductions.
- S2 slice review: done — `project/_local/reviews/2026-08-14-informatik-und-wirtschaft-s2-slice-review.md`; accepted exact second-apply no-op correction.
- S2 correction review: done — `project/_local/reviews/2026-08-14-informatik-und-wirtschaft-s2-correction-review.md`; static contract passed, and the disposable database proof now covers dry run, serializable apply, and exact second-run no-op. Drift refusal and post-commit receipt recovery remain unexercised.
- Final review: initial findings were recorded in `project/_local/reviews/2026-08-14-informatik-und-wirtschaft-combined-final.md`; the correction review closed all seven code findings in `project/_local/reviews/2026-08-14-informatik-und-wirtschaft-combined-final-correction.md`. The wiki caveat identified by that review is corrected in the working tree.
- Browser E2E: the linked feature worktree was proved with devrouter, and the missing Chromium headless-shell, ffmpeg artifact, and container libraries were installed in the disposable runtime. The full `Y-chat.spec.ts` Chromium run started against the real local apps: tests 1 and 2 passed, then the unknown-chatbot recovery test failed at `playwright/tests/Y-chat.spec.ts:98` because it expects `data-testid="chat-not-found"`. The unchanged base implementation uses `data-cy="chat-not-found"`; the response was HTTP 404, but the browser DOM contained no matching recovery marker. The changed-file diff confirms that the recovery page and E2E spec are outside this branch, so this baseline/runtime failure is not attributed to the feature. No application-level full-suite pass is claimed.
- Remaining gate: no further local implementation gate. Live MCP evidence remains unavailable because no live MCP credential or active production-like route was supplied. The current task authorizes push and a draft PR; merge, STG apply, activation, deployment, and production remain withheld.
- Active children: none.
- Delivery layer: local branch commits only until the authorized push and draft PR. Achieved layer: local code, documentation, disposable-database proof, and bounded browser execution complete; the full browser suite remains blocked by the unchanged baseline recovery test. Merge, STG apply, activation, deployment, and production remain explicitly withheld.
- Next action: push the branch and open the draft PR with the recorded verification boundary; no local database receipt or operational credential is retained.

## Next steps

- Keep the existing cross-repository handoff and deployment route read-only.
- Review the draft PR and separately repair the baseline chat recovery E2E contract if desired.
- Reconfirm operational values and authority separately before any Package B apply.
