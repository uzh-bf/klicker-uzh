# Configurable chat model policy

## Approval summary

Model settings currently require source changes because the participant fallback and new-chatbot default require a particular vendor model ID. This package makes automatic selection, credit-safe fallback and new-chatbot creation resolve configurable IDs against the existing model registry. After one enabling release, supported model settings can change through configuration and a same-image rolling restart.

Both Chat and GraphQL validate the same policy at startup. Invalid references and an ADVANCED credit fallback fail closed. The Manage assistant uses that validated BASE fallback instead of escaping to the first registry entry. Existing explicit chatbot selections, pending revisions, historical accounting and stored reasoning restrictions remain intact. Registry IDs retain their meaning; operators keep referenced IDs when changing defaults. New adapters, model retirement and funding-policy changes remain separate work.

The user approved implementation with “so lets do that” after the Astra investigation. This is an executable batch authorizing implementation, focused verification, independent review, commits, ordinary task-branch push and one draft PR. Marking ready, merging, releases, promotion, live configuration, deployment and production data changes are withheld. The terminal condition is a reviewed draft package with evidence and any verification limitations recorded.

## Execution details

### Working context and contracts

- Repository: KlickerUZH; worktree `trees/configurable-chat-model-policy`; branch `enhance/configurable-chat-model-policy`; target `v3-ai` at `570af489d117a0b1605092a920bbd6dc37712e53`.
- Execution mode: standard. Ceremony: full path because defaults cross consumers and affect credit-safe selection. Boundary owner: self.
- Existing model registry and OpenAI-compatible adapter remain the sole catalog and transport. No dependency, service, schema migration or database rewrite.
- Keep both existing Zod parsers. Extend the dependency-free shared policy helpers in `packages/util/src/chatModelRegistry.ts`.
- Retain `CHAT_PRIMARY_MODEL_ID` and enable `CHAT_FALLBACK_MODEL_ID`; add `CHAT_NEW_CHATBOT_MODEL_ID`. Both consumer ConfigMaps receive identical effective policy and registry settings.
- Without explicit settings, primary resolves to canonical `auto`, fallback uses the valid legacy fallback or requires exactly one eligible BASE fallback, and new-chatbot default resolves to that fallback. Zero or ambiguous eligible fallbacks fail startup. Explicit fallback configuration selects one eligible entry regardless of registry ordering. An explicitly configured ID must exist. The selected fallback must have BASE usage and `fallback: true`.
- Built-in catalogs parse without process settings. Startup validates settings against the effective registry, preventing custom settings from invalidating an unused built-in catalog during import.
- A configured global primary outside a particular bot's allow-list does not widen that list. Nonempty stale allow-lists retain only the configured BASE fallback. Empty legacy lists keep existing compatibility behavior.
- New-chatbot default affects only new records. Preserve the existing initial reasoning configuration semantics; no new reasoning-default setting. Supported reasoning values stay configuration-driven. A nonempty stored restriction with no supported intersection returns an empty allowed set and the chat route rejects before calling the provider; it never expands efforts or omits effort to permit a provider default.
- Preserve the integer output cap of 1–4096. Configured per-model caps need not all equal 4096.
- Configuration is startup-scoped. Existing ConfigMap checksums drive same-image rolling restarts; no hot reload. Mixed-revision operation requires referenced old IDs to remain until all consumers have rolled.

### Primitive impact and decisions

| Primitive | Disposition | Contract |
| --- | --- | --- |
| Model registry | Extend | Validate configurable policy references while retaining immutable catalog identities and existing capability/pricing fields. |
| Chatbot model policy | Reuse | Preserve explicit selections and pending revisions; configured defaults apply only at the existing default-selection seams. |
| Credit fallback | Extend | Configured BASE-only fallback across participant chat, stale policies and Manage assistant. |

The existing registry architecture is retained, so no new ADR is required. A separate runtime catalog service, hot reload, floating version aliases, pricing-policy automation or model retirement would reopen architecture and authority decisions. Full Zod consolidation was rejected because util currently has no Zod dependency. External documentation is unnecessary for existing code and Helm mechanisms; Astra's source-backed investigation is the design input.

### Delegation map and sequence

One coherent implementation slice spans configuration through both consumers and is owned by main. A bounded executor helps main by editing only the dependency-free util policy helpers after planner hardening. Main owns consumer integration, tests, docs, environment handling, final proof and draft delivery. Writers do not overlap.

Bounded paths: `packages/util/src/chatModelRegistry.ts`, `apps/chat/src/lib/server/chatModelRegistry.ts`, `packages/graphql/src/services/chatbots.ts`, `apps/chat/src/services/manageAssistantRuntime.ts`, `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`; existing tests `apps/chat/test/{chat-model-registry,chatModelRegistry,modelRegistryParity,manage-assistant-runtime,required-mcp-route}.test.ts` and `packages/graphql/test/{chatModelRegistry,manageChatbots}.test.ts`; `deploy/charts/klicker-uzh-v3/{values.yaml,templates/cm-chat.yaml,templates/cm-backend-graphql.yaml}`, `.devcontainer/devcontainer.env`, `turbo.json`, and `docs/chat-platform.md`. Existing util index already exports the helper module and needs no change.

Route: executor for util helper implementation; main for coupled consumer integration. Main retention reason: cross-consumer semantics and startup/cache integration are critical-path coupled. Acceptance: shared helper behavior exercised through both existing consumer registry suites and consumer parity tests.

1. Freeze and harden this derived execution plan with the existing configured Astra planner; commit the plan after approval.
2. Implement shared validation/resolution, integrate Chat, GraphQL and Manage assistant, wire Helm/public environment settings and update affected documentation. Commit one substantive integrated slice after focused verification.
3. Run simplifier and risk-selected slice review on the immutable slice; apply verified corrections. Run one integrated final review, then publish the coherent draft PR and read back its metadata.

### Feature-wide test portfolio

| Consequential behavior | Obligation and existing seam | Distinct failure |
| --- | --- | --- |
| Config-only model change | Extend Chat and GraphQL registry tests using minimal synthetic catalogs | New IDs require vendor-specific code or import-time defaults reject valid external configuration. |
| Credit-safe fallback | Extend registry and Manage assistant tests | Invalid/ADVANCED fallback or first-entry escape spends the wrong credit class. |
| Existing bot policy preservation | Extend management and Chat policy tests | New defaults rewrite fixed selections or stale lists widen to the full catalog. |
| Reasoning restrictions | Extend existing Chat effort test | Capability changes silently widen a stored nonempty restriction. |
| Consumer/deployment parity | Replace catalog-content assertions in `modelRegistryParity.test.ts`; render both consumer ConfigMaps | Config differs across services, configured caps are lost or variable wiring is missing. |

Retain duplicate-ID, auto semantics, capability validation, output bounds and cost validation coverage. Remove incidental vendor lists/prices and cross-environment equality assertions; assert structured consumer parity per environment and test-owned synthetic configuration instead.

### Verification and delivery

Run `pnpm exec vitest run` in Chat for the five named test files, and in GraphQL for its registry suite and management suite when disposable marked services are available. Run relevant type/lint checks and inspect the complete diff. Render Helm consumer ConfigMaps to prove policy/registry parity and checksum-driven rollout statically; this is not evidence of an actual rollout, which remains unauthorized.

This is nonvisual frontend behavior, so a screenshot gallery does not apply. Browser verification of model selection through a local authenticated synthetic flow is required for complete behavioral acceptance; capture the required before/after evidence. Unavailable runtime/browser coverage leaves that acceptance boundary explicitly incomplete on the draft. No production generation or chat query is authorized by this package.

Before commits, inspect staged content for secrets, personal data and unrelated changes. Reuse tests/reviews only for unchanged contracts. Draft publication uses host `gh`, preserves branches/worktrees and records hosted checks independently from local evidence.

Pause only for a material product/configuration change, missing independent review capability after continuity, unsafe data boundary, or unavailable required delivery capability. No generic approval is required between routine implementation steps.

## Progress

Status: implementation and focused source verification complete; independent slice and final reviews pending. Required delivery: reviewed draft PR; PR: none yet. Next action: review the integrated committed slice. Broad production goal and separate deployment prep remain outside this package.

Planning evidence: configured Astra child `/root/configurable_chat_models_astra` completed the initial investigation and architecture refinement. Runtime model provenance is unavailable; this records configured routing rather than verified model identity. Optional opposing-provider route previously failed terminally in this parent task and is not re-probed.

The same Astra planner returned `APPROVED` after one correction round. Main accepted its reasoning-intersection guard, deterministic fallback selection, explicit ownership and incomplete-browser acceptance requirements. The bounded helper executor completed its util change; main integrated and verified the consumers.

Verification: 50 focused Chat tests and five GraphQL registry tests pass in a network-disabled Node 24.21.0 / Vitest 3.2.4 container using retained dependencies. Chat and GraphQL repository type-checks pass. Scoped Biome lint passes with three existing warnings and one existing informational suggestion. Both STG and PRD Helm renders prove identical consumer policy/registry settings, unchanged workload images and changed checksums on both consumer deployments after a default-setting change. This is static rollout proof only.

Local browser acceptance and the database-backed management suite remain pending: the exact task runtime's managed startup has not produced a readiness receipt. A broader util type-check is still running without terminal evidence; the focused helper check and util build passed. No full monorepo check/build or hosted CI success is claimed. Container checks use existing installed executables because the isolated dependency mounts cannot satisfy pnpm's whole-workspace dependency verification. Host Git identity and staged secret checks remain mandatory before publication.
