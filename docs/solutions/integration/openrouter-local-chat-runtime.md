---
type: Solution
title: Start and verify OpenRouter-backed local Chat safely
description: Inject the local upstream key at workspace creation, prove the complete synthetic Chat path, and keep secret-authentication failures separate from application failures.
module: chat-devrouter
date: 2026-08-24
problem_type: workflow
severity: medium
tags:
  - openrouter
  - infisical
  - devrouter
  - litellm
  - local-development
  - chat
---

# Start and verify OpenRouter-backed local Chat safely

## Context

The linked Chat workspace uses the optional `ai` profile to run LiteLLM as its
local model boundary. The `chat` app profile does not start LiteLLM or the local
MCP fixture; use `chat,ai,mcp` for the complete synthetic path. LiteLLM
reads the OpenAI-compatible base URL and API key from its container
environment, so the key must be present when the workspace is created. A
repeat `devrouter ensure` can leave an already-running LiteLLM container with
its previous environment. The upstream boundary is external; local checks
must use seeded or synthetic content only.

## Guidance

1. Run Infisical authentication and injection from a host shell outside the
   Codex sandbox. Do not run Infisical inside `devrouter exec`, the DevPod, or
   a container. Resolve the exact checkout path and use the restricted
   `rs-infisical-operator` profile. Check `status` and `permissions` without
   reading values, then map
   `OPENROUTER_API_KEY` to `UPSTREAM_OPENAI_API_KEY` while setting the fixed
   `UPSTREAM_OPENAI_BASE_URL` value for the child `devrouter ensure` command
   and selecting `--profile chat,ai,mcp`
   ([OpenRouter-backed local chat](../../../AGENTS.md#openrouter-backed-local-chat)).
2. If the host-side operator profile or login is missing, stop and complete
   the operator setup outside the sandbox. Do not substitute raw
   `infisical run`, and do not put credentials in chat, files, arguments, or
   logs.
3. If LiteLLM already runs, stop the exact checkout before injecting the key
   again. `ensure` reconciles the workspace but does not replace environment
   variables inside an existing service container:

   ```bash
   devrouter stop <checkout-path>
   ```

4. Start the injected workspace and keep its values-free runtime result. Use
   the capability-only `ai` profile only for a LiteLLM health check:

   ```bash
   runtime_json="$(devrouter ensure <checkout-path> --profile chat,ai,mcp --json)"
   printf '%s\n' "$runtime_json"
   ```

5. On the host, resolve the exact LiteLLM container from the reported Compose
   project and verify only key presence. These commands produce no key value or
   derived fingerprint:

   ```bash
   compose_project="$(printf '%s\n' "$runtime_json" | jq -er '.managedRuntime.composeProject')"
   litellm_container="$(docker ps \
     --filter "label=com.docker.compose.project=$compose_project" \
     --filter 'label=com.docker.compose.service=litellm' \
     --format '{{.ID}}')"
   test -n "$litellm_container"
   docker exec "$litellm_container" sh -c 'test -n "$UPSTREAM_OPENAI_API_KEY"'
   ```

6. Keep Auto Mode selected and run the seeded Benibot smoke from
   [OpenRouter-backed local chat](../../../AGENTS.md#openrouter-backed-local-chat).
   The successful synthetic path
   calls the local `KB_doc_query` tool, returns `KLICKER_LOCAL_MCP_OK`, and
   keeps the synthetic source card visible after reload. The deterministic
   marker is defined in
   [local-mcp-server.mjs](../../../apps/chat/scripts/local-mcp-server.mjs).

## Why This Matters

The LiteLLM configuration resolves every OpenAI-compatible model and embedding
route through `UPSTREAM_OPENAI_BASE_URL` and `UPSTREAM_OPENAI_API_KEY`
([config.yaml](../../../util/litellm/config.yaml)). A route-level 200 or
an authenticated empty thread proves only the local application boundary. The
synthetic model/tool smoke is the evidence that the local Chat request reaches
LiteLLM and the configured upstream path.

### Structured card generation rejects a valid provider response

AI SDK 7 deprecates `generateObject` in favor of `generateText` with an
explicit output contract. More importantly for the Responses API, the JSON
Schema sent as `response_format` must have an object root. A top-level Zod
discriminated union reached OpenRouter as a schema without `type: "object"` and
failed with `Invalid schema for response_format 'response'` even though the
outer Chat request itself streamed normally.

`apps/chat/src/lib/server/personalElements/tools.ts:generateGroundedCard` uses
`generateText` and wraps the ready-versus-abstain union inside
`Output.object`. Keep the union nested under that object root. A provider 200
is not sufficient evidence here: complete the personal-card browser smoke and
require the accepted plan, a generated card, grouped page references, and a
persisted card decision after reload.

The fixture is additionally gated by `LOCAL_DOC_QUERY_FIXTURE_ENABLED=true`.
That flag is set only in the self-contained devcontainer; without it, the seed
must not reconcile the globally named `KB` MCP row or bind the fixture KB, and
Chat must reject unauthenticated access even to the loopback URL. This keeps
the fixture from mutating a shared dev or staging database when `seedTEST.ts`
is run through an Infisical-backed seed command.

When the host-side operator reports that no valid login session exists, stop at
secret authentication. It is an environment-setup blocker, not evidence that
the OpenRouter key is invalid or that Chat is broken. Complete the operator
setup outside the sandbox, then repeat the exact stop, injected start, presence
check, and synthetic smoke.

## When to Apply

Apply this workflow when starting or restarting a linked Chat workspace, when
Auto Mode or direct model calls fail after a runtime restart, or when a
workspace was started without the OpenRouter mapping. Do not apply it to
production, real participant data, or a deployment change; this is a local
verification path only.

If nested Chat API routes serve an HTML 404 while the direct chatbot lookup
returns JSON, treat that as stale generated route state first. Rerun the exact
injected `devrouter ensure ... --profile chat,ai,mcp`; the repository confirms
that signature and performs one bounded repair for the affected `.next` cache.
If the route remains unhealthy, inspect `/tmp/dev.log` before diagnosing the
upstream.

## Examples

- The repository startup contract and synthetic prompt are kept together in
  [OpenRouter-backed local chat](../../../AGENTS.md#openrouter-backed-local-chat).
- LiteLLM's upstream environment contract is explicit in
  [config.yaml](../../../util/litellm/config.yaml), including the embedding
  route.
- The local MCP fixture is deterministic and read-only at
  [local-mcp-server.mjs](../../../apps/chat/scripts/local-mcp-server.mjs).
