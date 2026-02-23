# LiteLLM Gateway

AI gateway sitting between Klicker workloads (e.g., Chat) and model providers (e.g., Azure OpenAI).

## Status in this repo

- **Out-of-repo**: this repository does not currently contain deployment manifests/configuration for LiteLLM.
- The component is still part of the documented system architecture (see `Overview.canvas`).

## Responsibilities (intended)

- Provide an **OpenAI-compatible** API surface for model inference.
- Route requests to upstream providers (e.g., Azure OpenAI deployments).
- Centralize provider configuration, rate limiting, and (optionally) cost/usage reporting.
- Emit observability data to Langfuse (see `04-Building Blocks/Workloads/AI Infra/Langfuse.md`).

## Interfaces / contracts (to document)

- Inbound: HTTPS requests from Chat to LiteLLM (OpenAI API style; exact base URL/auth to validate).
- Outbound: HTTPS requests from LiteLLM to Azure OpenAI.
- Telemetry: LiteLLM → Langfuse (traces/usage).

## Cross-links

- Workload: `04-Building Blocks/Workloads/AI Infra/Chat.md`
- Provider: `04-Building Blocks/Data Stores/Azure OpenAI.md`
