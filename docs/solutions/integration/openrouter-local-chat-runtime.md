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

The linked Chat workspace uses LiteLLM as its local model boundary. LiteLLM
reads the OpenAI-compatible base URL and API key from its container
environment, so the key must be present when the workspace is created. A
plain `devrouter ensure` can leave an already-running LiteLLM container with
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
   ([AGENTS.md:143](../../../AGENTS.md#L143)).
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

4. Verify only key presence, with no stdout or derived fingerprint:

   ```bash
   devrouter exec <checkout-path> -- sh -c 'test -n "$UPSTREAM_OPENAI_API_KEY"'
   ```

5. Keep Auto Mode selected and run the seeded Benibot smoke from
   [AGENTS.md:191](../../../AGENTS.md#L191). The successful synthetic path
   calls the local `KB_doc_query` tool, returns `KLICKER_LOCAL_MCP_OK`, and
   keeps the synthetic source card visible after reload. The deterministic
   marker is defined at
   [local-mcp-server.mjs:36](../../../apps/chat/scripts/local-mcp-server.mjs#L36).

## Why This Matters

The LiteLLM configuration resolves every OpenAI-compatible model and embedding
route through `UPSTREAM_OPENAI_BASE_URL` and `UPSTREAM_OPENAI_API_KEY`
([config.yaml:80](../../../util/litellm/config.yaml#L80)). A route-level 200 or
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
returns JSON, treat that as a stale generated Chat build first. Stop the exact
workspace, move only the worktree's ignored `apps/chat/.next` directory to a
recoverable temporary path, restart with the key injection, and verify the
route again before diagnosing the upstream.

## Examples

- The repository startup contract and synthetic prompt are kept together in
  [AGENTS.md:143](../../../AGENTS.md#L143).
- LiteLLM's upstream environment contract is explicit in
  [config.yaml:80](../../../util/litellm/config.yaml#L80) and the embedding
  route at [config.yaml:144](../../../util/litellm/config.yaml#L144).
- The local MCP fixture is deterministic and read-only at
  [local-mcp-server.mjs:16](../../../apps/chat/scripts/local-mcp-server.mjs#L16).
