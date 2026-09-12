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

A healthy local MCP endpoint does not prove that Chat can use it. The legacy
seed had no transport authentication or required knowledge-base scope, while
Chat's Doc Query client expects bearer authentication and an ES256 scope token.
Keep that production client unchanged when diagnosing the local fixture.

The managed MCP startup now uses
[local-mcp-bootstrap.mjs](../../../apps/chat/scripts/local-mcp-bootstrap.mjs)
to rotate ephemeral credentials and restart both Chat and the fixture together.
Its seed repair accepts only the exact synthetic owner, course and two mode
bindings. An ownership conflict stops startup instead of replacing another
configuration. The current `scope_token` seed is recognized alongside the legacy
seed; repair preserves each binding's enabled state and disables obsolete
chatbot-ID forwarding. A disabled binding stays disabled after credential
rotation, so successful startup does not prove tool activation.
Playwright cleanup deletes the native fixture's course, chatbot and bindings,
while retaining its MCP server. The browser seed uses a different course ID.
On the next managed startup, repair can restore entirely absent parents for
the exact synthetic lecturer and owned scoped server. Both restored bindings
remain disabled and the chatbot remains a draft. Partial parents, unrelated
consumers and unrecognized ownership stop recovery without writes. Use retained
canonical repair; generic reseeding also changes unrelated MCP configuration.
The transaction acceptance script uses PostgreSQL temporary tables and must
match the real JSON type of `allowedTools` to detect insertion failures.
Plaintext credentials remain in the local process environment;
the database stores only the encrypted transport token. The local shared
process environment is not an isolation boundary between apps.

After Playwright cleanup, startup can recreate the fixture's synthetic course,
draft chatbot and two mode bindings when all are absent. The exact local server
and seeded lecturer must still match. Partial parent state is rejected; repair
never overwrites an existing course or chatbot. Restoration and credential
rotation share one transaction, so a failure leaves the previous data intact.

Use the completed tool call, final answer, source card and reload persistence
as integration evidence. The deterministic fixture has no public origin URL,
so its source card cannot prove that a linked website or PDF is accessible.
That requires a separate linked-source canary; source-normalizer tests alone
prove URL preservation, not reachability or staging retrieval quality.

The LiteLLM configuration resolves every OpenAI-compatible model and embedding
route through `UPSTREAM_OPENAI_BASE_URL` and `UPSTREAM_OPENAI_API_KEY`
([config.yaml](../../../util/litellm/config.yaml)). A route-level 200 or
an authenticated empty thread proves only the local application boundary. The
synthetic model/tool smoke is the evidence that the local Chat request reaches
LiteLLM and the configured upstream path.

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
