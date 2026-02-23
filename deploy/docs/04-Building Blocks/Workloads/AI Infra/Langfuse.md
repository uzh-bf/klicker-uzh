# Langfuse

Observability for AI interactions (traces, prompts, usage, cost).

## Status in this repo

- **Out-of-repo**: this repository does not currently contain deployment manifests/configuration for Langfuse.
- The component is still part of the documented system architecture (see `Overview.canvas`).

## Responsibilities (intended)

- Collect traces/metadata for model requests and tool calls.
- Support debugging and cost/usage analysis across chatbots and environments.

## Interfaces (intended)

- Inbound telemetry from:
  - LiteLLM gateway (primary, if model traffic is routed through the gateway)
  - Chat (optional/direct instrumentation; not currently visible in this repo’s code)

## Cross-links

- `04-Building Blocks/Workloads/AI Infra/LiteLLM Gateway.md`
- `04-Building Blocks/Workloads/AI Infra/Chat.md`
