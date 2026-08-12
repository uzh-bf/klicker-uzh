# 5. Chat generation crosses a versioned internal engine boundary

Status: Accepted

`chat-api` must remain the single platform boundary for participant
authentication, chatbot and thread ownership, attachments, MCP authorization,
model and credit policy, persistence, and stream validation. The public
deployment and the private Catalyst deployment need to use different
generation implementations without duplicating those responsibilities or
coupling the public repository to Mastra.

We therefore define a small, versioned HTTP contract in the unpublished
workspace package `@klicker-uzh/chat-engine-contract`. It exposes a manifest
and a versioned chat endpoint. `chat-api` sends opaque conversation identifiers,
the resolved generation configuration, bounded message history, approved tool
descriptors, and a short-lived tool capability. The engine returns validated
text, reasoning, tool lifecycle parts, normalized usage, finish data, and
structured errors. The contract package owns schemas and conformance fixtures;
it does not own persistence, credits, pricing, participant data, or provider
credentials.

The resolved generation object is the only model configuration crossing the
boundary. It contains the public model ID, provider deployment ID, configured
output limit, applied reasoning settings, response-storage behavior, and an
explicit provider credential mode. It does not contain prices, credit state,
fallback flags, the unresolved model registry, or secrets. Request-scoped and
deployment-owned provider credentials are mutually exclusive and are never
persisted or logged. Engines do not retry or select another engine.

The default public engine implements this contract using the repository's
existing AI SDK and OpenAI-compatible provider behavior. Catalyst can implement
the same contract with Mastra in its private repository. Contract conformance
tests are the compatibility gate; engine selection remains deployment
configuration, never a browser choice.

Contract generations use ordinal route and body literals such as `v1`. W3C
trace context travels only in `traceparent` and optional `tracestate` HTTP
headers. The JSON request has no second trace representation. Approved tools
cross as schemas and stable server IDs; one scoped execution token is sent in
`x-mcp-execution-token`, and the engine calls a deployment-owned MCP execution
endpoint instead of opening caller-selected MCP server URLs.

This preserves one platform policy and one conversation store while allowing
generation implementations to evolve independently. The cost is an explicit
HTTP serialization and validation seam, plus a required conformance run for
every engine implementation.
