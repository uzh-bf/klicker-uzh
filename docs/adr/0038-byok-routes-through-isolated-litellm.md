# 38. BYOK routes through an isolated LiteLLM boundary

- **Status:** Proposed — 2026-08-23

## Context

Routing BYOK calls directly from each capability to each provider would lose
the shared Auto policy, normalized usage and cost metadata, retries, provider
error handling, and generation-level Langfuse correlation. Enabling LiteLLM's
request-scoped provider credentials on the existing shared proxy would instead
widen a deliberately enforced security boundary: the deployment repository
rejects `allow_client_side_credentials` and
`configurable_clientside_auth_params` in shared configurations.

The current chat path also permits a custom base URL to fall back to the shared
platform API key. An attacker-controlled endpoint could therefore receive a
platform credential if custom endpoint state becomes user-controllable.

## Decision

BYOK requests normally pass from the AI Credential Gateway through a dedicated,
internal BYOK LiteLLM deployment before reaching an approved provider. Only the
gateway can reach this deployment. Its static configuration contains the
centrally approved provider endpoints and model aliases; each request supplies
only the minimum transient credential parameter needed for the selected
profile. Neither arbitrary base URLs nor caller-supplied model configurations
are accepted.

The shared LiteLLM deployment retains its prohibition on client-side provider
credentials. The BYOK deployment has separate network policy, authentication,
configuration validation, logs, and contract tests. LiteLLM receives the
provider credential only in process memory for the request and is not canonical
credential custody.

The first cohort supports one Provider Profile and one named model. That model
is eligible only after its exact capability has been validated for the
credential. Auto is a later gated layer and is credential-closed: it becomes
eligible only when every active classifier, embedding, and generation target in
the environment-specific, revisioned Auto manifest is available under the same
credential. Partial Auto, cross-provider fallback, and platform-funded fallback
are forbidden.

Direct-provider routing remains an explicit, platform-controlled,
capability-specific exception. It still passes through the gateway and must
preserve equivalent authorization, quota, tracing, error redaction, and notice
contracts. No direct-provider exception is implemented for the first release.

## Consequences

- The existing shared LiteLLM security policy remains intact.
- One additional internal deployment is required, but provider routing and
  tracing stay centralized rather than being reimplemented in every capability.
- The exact LiteLLM request-scoped credential mechanism is an implementation
  gate: named-model routing, complete Auto routing, callbacks, cost metadata,
  secret redaction, and non-persistence must pass a synthetic contract test
  before the feature can depend on it.
- Gateway or BYOK LiteLLM unavailability fails closed; it never triggers a
  direct call or a funded fallback.

## References

- [LiteLLM client-side credentials](https://docs.litellm.ai/docs/proxy/clientside_auth)
