# Chat GPT-6 model migration

## Approval summary

**Why and what changes?** Production chat sends direct Luna selections to
GPT-5.6 Luna, while Auto already routes to GPT-6 Luna and Sol. GPT-6 Luna is
cheaper (0.10 / 0.50 USD per 1M tokens against 0.20 / 1.20), and the
production LiteLLM already falls back from every GPT-6 alias to its GPT-5.6
twin. This package renames the participant base model from `gpt-5.6-luna` to
`gpt-6-luna` everywhere. It adds `gpt-6-sol` as a selectable ADVANCED model,
keeps `gpt-4.1` and `gpt-5.4`, and removes `gpt-5.1`. It rewrites stored
chatbot allow-lists in a data migration and reprices Auto from its measured
tier mix.

**What stays unchanged?** Credit budgets, usage classes and the Auto routing
policy stay the same. Historical `ChatMessage.modelId` values stay as recorded.
The production LiteLLM model list is not trimmed in this package.

**What could change the decision?** The rename needs a new release of both the
chat and backend images, because both validate that the only BASE model has
the hard-coded base ID. Production values must therefore change in the same
PR as the image tag bump, never earlier. Repricing Auto needs read access to
the KlickerUZH Langfuse project, which the operator profile does not have yet.
Between the production migration and the chat rollout, bots keep working
through the base fallback, but direct Luna disappears from pickers until the
new image is live.

**How will we know it is done?** Registry, policy and parity tests pass. The
migration rewrites a seeded dev database correctly and is idempotent. Local
chat answers through `gpt-6-luna` and `gpt-6-sol`, and the picker shows the
new models. Staging reports the new model IDs on answers after rollout.

**What does approval authorize?** Implementation on
`enhance/chat-gpt6-models`, local commits, pushes to that branch and a draft
PR to `v3`, plus a draft MR in `ai/deployment` for the classifier switch.
Withheld: marking ready, merging, the release tag, the production values PR's
merge, the Argo sync, running the production migration, and any change to the
operator allowlist.

## Execution details

### Evidence

- Production DB, 2026-09-29, last 30 days: `auto` 1,650 answers, 54.5
  credits; `gpt-5.6-luna` 773 answers, 5.2 credits; `gpt-5.1` 1 answer.
- 24 chatbots active in 30 days, all `PUBLISHED`. Allow-lists naming
  `gpt-5.6-luna`: most active bots (`{auto,gpt-5.6-luna}`), Ethik-Rollenspiel
  and a synthetic demo (`{gpt-5.6-luna}` with `high` effort), six former
  tutor bots (`{gpt-5.5,gpt-4.1-mini,gpt-5.6-luna}`), four Intro to R bots.
- `packages/util/src/chatModelRegistry.ts`: `CHAT_BASE_MODEL_ID` is the only
  allowed BASE model; the chat and backend registry parsers enforce it.
- `deploy/charts/klicker-uzh-v3/templates/cm-chat.yaml` and
  `cm-backend-graphql.yaml` both receive `chat.modelRegistry` as
  `CHAT_MODEL_REGISTRY_JSON`.
- Production LiteLLM (`ai/deployment`, `litellm/prd-generic/config.yaml`):
  `klickeruzh/azure/gpt-6-luna` and `gpt-6-sol` exist with low to xhigh
  (Luna) and low to high (Sol) effort aliases; fallbacks point to GPT-5.6.
  The Auto classifier still runs on `gpt-5.6-luna-low`.
- OpenRouter lists `openai/gpt-6-luna` and `openai/gpt-6-sol` for local dev.

### Registry contract after the change

| ID | Deployment (prd) | Class | Cost in / out | Efforts |
| --- | --- | --- | --- | --- |
| `auto` | `klickeruzh/azure/auto-router` | ADVANCED | from Langfuse mix | — |
| `gpt-6-luna` | `klickeruzh/azure/gpt-6-luna` | BASE, fallback | 0.1 / 0.5 | low, medium, high, xhigh |
| `gpt-6-sol` | `klickeruzh/azure/gpt-6-sol` | ADVANCED | 2.0 / 10.0 | low, medium, high |
| `gpt-4.1` | `klickeruzh/azure/gpt-4.1` | ADVANCED | 2.0 / 8.0 | — |
| `gpt-5.4` | `klickeruzh/azure/gpt-5.4` | ADVANCED | 2.5 / 15.0 | minimal to xhigh |

The in-code default registries (chat and backend) mirror the dev stack:
`auto`, `gpt-6-luna`, `gpt-6-sol`, `gpt-4.1`.

### Delivery topology

1. PR A to `v3` (this branch): code rename, data migration, dev LiteLLM,
   staging values, docs, and this plan.
2. Release tag after PR A merges (withheld authority).
3. PR B to `v3`: production values with the new image tags, registry,
   `fallbackId` and course-KG ingestion models. It is prepared as a draft only.
4. `ai/deployment` draft MR: Auto classifier `gpt-6-luna-low` in stg and prd.

Staging runs `v3-ai`, so PR A reaches staging after the next `v3` to `v3-ai`
merge. The data migration then runs through the staging PreSync migrator.

### Production rollout order (for PR B, withheld)

1. Run the migration against production (manual, migrator disabled in prd).
2. Merge PR B and sync Argo so chat and backend roll out with the new registry.
3. Verify new answers carry `gpt-6-luna`, `gpt-6-sol` or `auto`.

Rollback: restore the previous tags and registry, and run the migration's
reverse SQL recorded in the migration file comment.

### Test portfolio

| Risk | Obligation | Seam | Existing protection |
| --- | --- | --- | --- |
| Registry rejects the new base ID or keeps the old one | extend existing | `apps/chat/test/chatModelRegistry.test.ts`, `packages/graphql/test/manageChatbots.test.ts` | base policy tests |
| Chat and backend default registries drift | extend existing | `apps/chat/test/modelRegistryParity.test.ts` | parity test |
| Migration misses array entries or effort keys, or is not idempotent | none (new test) | apply to seeded dev DB and query | none; one-shot SQL verified by direct check |
| Staging or production values fail registry validation | add new check | parse both values registries through `parseChatModelRegistry` in a one-off script run | none |

### Slices

All slices are owned by the main session (solo mode).

1. **Base model rename in code.** `packages/util/src/chatModelRegistry.ts`,
   `apps/chat/src/lib/server/chatModelRegistry.ts`,
   `packages/graphql/src/services/chatbots.ts`, `apps/chat/src/stores/settingsStore.ts`
   if it names the base model, seeds, the fallback script default, the
   evaluation target default, `.devcontainer/devcontainer.env`, and
   `util/litellm/config.yaml` (GPT-6 via OpenRouter with GPT-5.6 fallbacks),
   plus the affected tests. Acceptance: chat and graphql tests, `check`.
2. **Chatbot allow-list data migration.** A create-only Prisma migration with
   hand-written SQL: replace `gpt-5.6-luna` with `gpt-6-luna` in
   `Chatbot.allowedModelIds` without duplicates, and rename the key in
   `allowedReasoningEffortsByModel`. Acceptance: apply to the seeded dev DB,
   verify rows, re-run is a no-op.
3. **Staging values and docs.** `deploy/env-uzh-stg/values.yaml` registry per
   the contract, `fallbackId`, KG ingestion models and comments;
   `docs/chat-platform.md` and other named docs. Acceptance: values parse
   check, `format:check`.
4. **Auto repricing.** Needs the Langfuse KlickerUZH keys through the operator
   (approval requested separately). Compute the 30-day tier mix and a blended
   rate at GPT-6 prices; update stg values and PR B. If access is refused,
   keep 1.0 / 5.0 and record the gap.
5. **Browser proof and PR A.** Local chat with injected OpenRouter key:
   answers on `gpt-6-luna` and `gpt-6-sol`, picker screenshots. Final
   simplification and self-review, draft PR A.
6. **PR B draft and LiteLLM MR.** Prepare production values on a separate
   branch based on PR A; draft MR in `ai/deployment` for the classifier.

## Progress

- Execution mode: solo (Opus 5.5).
- Status: approved 2026-09-29 (plan and Langfuse key allowlist request).
- Next action: slice 1.
