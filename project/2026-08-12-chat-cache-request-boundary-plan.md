# Chat cache request boundary and stable prompt-prefix identity

## Goal

Protect personalized Klicker chat from unsafe or ineffective exact-response
cache reuse while preserving provider-managed prompt-prefix caching for the
default OpenAI-compatible gateway path. Make the provider request contract
observable and deterministic for both AI SDK OpenAI transports without adding a
Klicker-side cache, call ledger, or production measurement path.

The package owns two separate request contracts:

1. The default gateway request carries LiteLLM's per-request exact-cache bypass
   flags, so personalized requests neither read from nor write to the gateway
   exact-response cache.
2. The default gateway request carries a privacy-safe, versioned fingerprint of
   the stable prompt prefix as its provider prompt-cache identity. The
   fingerprint is independent of the person, thread, assistant response, and
   raw database identifiers.

## Non-goals

- Do not change LiteLLM, Redis, Azure OpenAI, router-affinity, or deployment
  configuration.
- Do not fork LiteLLM or introduce a permanent gateway cache policy.
- Do not add a database table, per-call ledger, CronJob, cache accounting
  reader, Langfuse mapping, cost measurement, or paid model call.
- Do not change custom chatbot endpoint request behavior. Custom endpoints
  retain their current provider request shape and receive neither the default
  gateway cache-bypass field nor the default prompt-cache identity.
- Do not add explicit provider prompt-cache breakpoints. The installed local
  probe proves serialization of a system-message breakpoint but does not prove
  that separately serialized tool definitions are before the breakpoint.
- Do not claim that the fingerprint produces cross-route cache reuse. The first
  version includes the requested deployment identity, including `auto-router`;
  resolved-model cache partitioning remains a later runtime confirmation.
- Do not change the public UI, chat semantics, credits model, authentication,
  authorization, thread ownership, MCP authorization, or image attachment
  behavior.
- Do not resume the closed affinity/accounting branch or copy its
  thread-derived prompt-cache key. Its code and tests are reference evidence
  only.

## Plan identity and authority

- Status: approved; implementation in progress on the named branch.
- Plan: `project/2026-08-12-chat-cache-request-boundary-plan.md`
- Repository: `/Users/rschlae/Git/klicker/klicker-uzh`
- Branch: `rs/chat-cache-request-boundary`
- Worktree: `/Users/rschlae/Git/klicker/klicker-uzh/trees/chat-cache-request-boundary`
- Target/base: `v3` / `origin/v3`
- Base SHA validated on 2026-08-12: `5264353ff77afc598ea69f05f262b25f882ca38c`
- Existing reference worktree:
  `/Users/rschlae/Git/klicker/klicker-uzh/trees/chat-turn-affinity-cache`
- Existing reference PR: #5365, closed, unmerged, draft; reference only.
- Project artifact root: `project/`
- Local review artifacts: `project/_local/reviews/` (ignored, never staged).
- First post-approval commit: this plan only, before implementation.
- No implementation, commit, push, PR, merge, deployment, cluster/tunnel
  access, measurement, or production mutation is authorized by this plan.

The primary checkout contains unrelated user changes. It is not an execution
surface and must remain untouched. The reference worktree contains one
uncommitted plan update and must remain read-only. The named worktree is clean
and was created from the validated `origin/v3` ref. `trees/` is already
gitignored.

## Settled architecture

### Request boundary

The route currently constructs one OpenAI provider for either a custom
chatbot endpoint or the default OpenAI-compatible gateway. Both paths already
share `responsesApiFetch`, which patches assistant input items for strict
Responses-compatible providers. The implementation will preserve that patch
and make the exact-response policy an explicit property of the provider
construction:

- `routing.source === 'default'`: apply the existing Responses normalization
  and add the top-level request field
  `cache: { "no-cache": true, "no-store": true }` after AI SDK serialization.
- `routing.source === 'custom'`: apply the existing Responses normalization
  only; do not add the gateway cache field or default prompt-cache fields.

The wrapper is attached to the provider, rather than only to `streamText`, so
all personalized requests made through the default provider obey the same
exact-cache boundary. This includes the route's image-description
`generateText` request, whose user-supplied image and context must not become
eligible for a gateway exact-response cache. The image-description request does
not receive the stable chat prompt-prefix identity because it has a different
prompt contract.

The same wrapper covers Chat Completions and Responses because AI SDK selects
the transport through `provider.chat(deploymentId)` or
`provider.responses(deploymentId)` while both models use the provider's fetch
option. The test contract must exercise both paths and verify that custom
provider construction remains unchanged.

### Stable prompt-prefix identity

The route assembles the final `systemPrompt` after applying the language-style
and citation contracts, loads the final MCP tool set, and resolves the selected
model configuration before calling `streamText`. The identity helper will
receive only provider-visible stable-prefix inputs:

- a fixed identity version marker, such as `klicker:prompt-prefix:v1`;
- the requested provider/deployment compatibility identity, including the
  configured `deploymentId` and transport family (`chat` or `responses`);
- the final effective `instructions` string;
- canonical enabled tool names; and
- canonical provider-visible tool descriptions and JSON schemas.

The helper will serialize that structure deterministically and hash it with
SHA-256. The emitted OpenAI prompt-cache key will contain the version and hash,
for example `klicker:prompt-prefix:v1:sha256:<digest>`. The raw effective
prompt and tool schemas remain local inputs to hashing and are never logged or
sent as identity metadata.

The canonical tool representation must use the provider-visible schema rather
than executable functions or MCP client instances. It should resolve each
tool's `inputSchema` through the installed AI SDK schema boundary, retain the
tool name and description, include every provider-visible function-tool field
that the installed SDK forwards (`strict`, `inputExamples`, and
`providerOptions` where present), sort tools by canonical name, and recursively
sort object keys. Array order remains meaningful unless the provider-visible
schema contract proves that a particular array is set-like; the helper must not
silently reorder semantic arrays.

The canonical provider-tool projection must be used twice: first as the input
to the fingerprint, and second as the provider-facing tool object passed to
AI SDK. Re-wrap each canonical JSON schema through the SDK's JSON-schema
boundary while retaining the executable `execute` function and other runtime
behavior. Pass the same canonical tool order through AI SDK's `toolOrder`.
Tests must compare normalized logical tool projections from both wire shapes
(Chat Completions nests function fields while Responses does not) and must
assert that schema key order in the captured request is canonical as well as
that the tool order is stable.

The helper must not accept or derive identity from participant IDs, user IDs,
chatbot IDs, thread IDs, assistant message IDs, request IDs, message content,
tool-call arguments/results, raw MCP server IDs, or telemetry trace IDs. Those
values may continue to serve their existing authentication, persistence, and
telemetry roles but cannot partition a reusable stable prefix.

For the default route, `providerOptions.openai` will carry the stable
`promptCacheKey`. The `promptCacheOptions: { mode: 'implicit' }` field is
capability-gated: the first implementation may emit it only for an explicit
allow-list of direct GPT-5.6-or-later deployment identities supported by the
installed provider contract. Older direct deployments and unresolved
`auto-router` requests must omit that mode until their compatibility is
explicitly established. The fingerprint still includes the requested
deployment identity, including `auto-router`, but serialization or a key is
not evidence of a resolved model or a provider cache hit. Keep the key and
mode as separate options so a supported stable key does not imply unsupported
implicit-mode behavior. The route will not carry an explicit breakpoint.

For custom endpoints, preserve the provider options already emitted by the
route—Responses `store` and any applicable reasoning fields—and omit only the
new default-gateway exact-cache and prompt-cache fields. The plan does not
claim that custom provider options are currently empty.

### Cache mechanism separation

The package keeps these mechanisms independent:

| Mechanism | This package changes | Identity/policy owner |
| --- | --- | --- |
| LiteLLM exact-response cache | Default personalized request bypass only | Request fetch boundary |
| Provider prompt-prefix cache | Versioned stable-prefix key, implicit mode | OpenAI provider options |
| Router classification affinity | No change | Gateway/deployment policy |
| Retrieval, embedding, and rerank caches | No change | Their existing services |

The exact-response bypass must not be implemented by reusing the prompt-prefix
key, and the prompt-prefix key must not contain a person or conversation
identity merely to make gateway behavior observable.

## Verified repository and external-boundary evidence

The following evidence was read during planning. It is local or synthetic
evidence, not live provider or production proof.

- `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`: the provider
  construction seam, final prompt assembly, MCP tool loading, model registry
  resolution, image-description request, and shared `streamText` call.
- `apps/chat/src/lib/server/chatModelRegistry.ts`: `deploymentId`, transport
  capability, and the `auto-router` registry identity.
- `apps/chat/src/services/mcpClients.ts`: priority-based aggregation and
  deterministic namespacing of MCP tools.
- `apps/chat/package.json`: AI SDK `7.0.52` and OpenAI provider `4.0.30`.
- `/tmp/klicker-cache-contract-prototype/README.md` and `probe.mjs`: a
  no-network synthetic capture passed for both Chat Completions and Responses.
  It showed `prompt_cache_key`, `prompt_cache_options`, the top-level LiteLLM
  bypass field injected by an application fetch wrapper, and normalized
  `usage.inputTokenDetails` buckets. It intentionally did not contact
  LiteLLM, Redis, Azure OpenAI, Langfuse, or a paid model.
- The installed AI SDK source documents `toolOrder` as the stable ordering
  boundary and resolves tool schemas through `asSchema(...).jsonSchema`.
- The installed OpenAI provider source serializes `promptCacheKey` and
  `promptCacheOptions` for both transport families. Its usage conversion maps
  provider cached and cache-write counts to the public AI SDK
  `inputTokenDetails` shape.
- `docs/chat-platform.md`, `docs/testing.md`, and
  `.agents/skills/klicker-testing-verification/SKILL.md`: existing chat
  architecture, local LiteLLM boundary, and verification conventions.
- `docs/adr/0003-chat-framework-upgrade.md` and
  `docs/adr/0004-chat-citations-from-tool-call-parts.md`: existing chat
  framework and citation decisions that remain applicable; no new ADR is
  needed for this bounded request-contract change unless implementation
  uncovers a genuinely forward-looking architecture decision.

Historical evidence from the closed affinity branch is explicitly not treated
as current implementation or CI proof. Live remote ref verification used
`git ls-remote` because the sandbox rejected writing `.git/FETCH_HEAD`; the
read-only remote result matched the local `origin/v3` ref. A host fetch was
attempted and rejected by the sandbox policy, so the plan records that
limitation rather than claiming a successful fetch.

## Test portfolio

Each behavior is assigned one primary stable seam. Tests should be added only
where the existing suite does not already protect the named failure.

| Risk or behavior | Existing evidence | Planned protection | Primary seam |
| --- | --- | --- | --- |
| Default Chat Completions requests bypass exact-response reads and writes | Disposable synthetic wrapper capture only | Assert both flags are added after SDK serialization and reach the final JSON body | `apps/chat/test/openai-cache-policy.test.ts` |
| Default Responses requests bypass exact-response reads and writes while the existing assistant-item patch remains | Disposable synthetic wrapper capture; current route wrapper | Assert both flags and the existing Responses normalization in one final request capture | `apps/chat/test/openai-cache-policy.test.ts` |
| Custom chatbot endpoints retain their request shape | Current `routing.source` branch; no cache-policy test | Assert custom provider requests omit the gateway cache field and default prompt-cache fields | `apps/chat/test/openai-cache-policy.test.ts` and provider-options test |
| Stable identity changes when effective instructions change | No current protection | Pure helper table cases for prompt version and instruction changes | `apps/chat/test/prompt-cache-identity.test.ts` |
| Stable identity partitions requested deployment/transport compatibility | Registry exposes deployment and reasoning transport | Pure helper cases for deployment, `auto-router`, and Chat/Responses changes | `apps/chat/test/prompt-cache-identity.test.ts` |
| Tool insertion order does not change identity or request order | MCP aggregation is priority/insertion based; AI SDK defaults to object order | Canonical tool-name/schema fixtures with reordered input objects and explicit `toolOrder` assertions | `apps/chat/test/prompt-cache-identity.test.ts` and `apps/chat/test/openai-chat-streaming.test.ts` |
| Tool schema, description, strictness, examples, or provider-visible options change the identity and wire contract | AI SDK schema conversion exists; no package contract | Pure synthetic tool definitions with changed provider-visible fields; compare canonical wire projections for both transports | `apps/chat/test/prompt-cache-identity.test.ts` and `apps/chat/test/openai-chat-streaming.test.ts` |
| User, participant, chatbot, thread, assistant-message, message/content, request, tool-call, and raw MCP identifiers do not affect identity | Existing route has all values in scope, but no negative test | Separate privacy-negative fixtures for each identifier class and an assertion that only the stable-prefix input is accepted | `apps/chat/test/prompt-cache-identity.test.ts` |
| Both transports preserve prompt-cache fields and public usage buckets | Disposable no-network probe | Repository-owned synthetic Chat/Responses fixtures assert serialized fields and public `usage.inputTokenDetails` | `apps/chat/test/openai-chat-streaming.test.ts` and a focused Responses fixture |
| Image-description requests bypass exact cache but do not receive chat-prefix identity | Route calls `generateText` through the selected provider at `route.ts:915-930`; no test currently protects the policy | Synthetic `generateText` capture through a default provider asserts the two bypass flags and absence of `prompt_cache_key` | `apps/chat/test/openai-cache-policy.test.ts` |
| Direct older models and unresolved auto-router do not receive unsupported implicit mode | Installed provider docs scope `promptCacheOptions` to GPT-5.6+; registry contains older and auto-router deployments | Provider-options matrix asserts stable key separation and mode omission for unsupported/unknown capability identities | `apps/chat/test/prompt-cache-identity.test.ts` and provider-options test |
| Existing chat behavior remains green | Current package test suite and typecheck | Run focused transport tests, full chat tests, chat typecheck, root checks, and build | Package/root verification |
| Operators can understand the boundary and its proof limits | Existing docs describe the route but not this contract | Update chat platform, testing documentation, and chat testing skill with source-linked facts | Documentation review |

No browser test is required because the package changes server-side request
policy and provider metadata, not user-visible UI behavior. If implementation
changes a visible chat response or auth/redirect/cookie behavior, the package
must be promoted to include the repository's mandatory browser path before
implementation continues.

## Execution slices after approval

### Slice 1 — Commit the approved plan

**Scope:** Stage and commit only this plan from the named worktree. Do not
include the ignored review register or any primary-checkout changes.

**Acceptance:** The commit contains the plan as the first branch commit;
`git diff --cached` has been reviewed for secrets and personal data; the
worktree has no unrelated staged files.

**Suggested commit:**
`docs(project): plan chat cache request boundary`

**Review:** Plan-stage review is completed before this slice is offered for
approval. The normal implementation final-review gates remain for the
integrated branch.

### Slice 2 — Default-provider exact-response cache boundary

**Route:** `executor` for the bounded fetch-policy implementation and focused
synthetic tests; the main session owns provider-boundary integration and
acceptance verification.

**Acceptance:** Default Chat Completions, Responses, and image-description
requests carry both exact-cache bypass flags; custom requests preserve their
existing fields and omit only the new gateway fields; focused tests pass in the
validated devcontainer.

**Scope:** Extract or extend the existing fetch wrapper in
`apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts` and, if useful, add
`apps/chat/src/lib/server/openaiCachePolicy.ts`. Keep the existing Responses
assistant-item normalization. Select the exact-cache policy from
`routing.source`, adding the top-level `cache` object only to default gateway
requests. Keep custom requests unchanged. Preserve request headers, abort
signals, response parsing, retries, and the provider choice.

**Tests:** Add or extend
`apps/chat/test/openai-cache-policy.test.ts` with synthetic no-network
captures for Chat Completions, Responses, default routing, custom routing, and
the image-description `generateText` path. The image fixture must assert the
default exact-cache flags and the absence of `prompt_cache_key`, without
requiring route/database setup. Add a separate transport-policy assertion for
custom Responses that preserves the pre-existing `store` and reasoning fields.
Keep the existing streamed tool-call fixture in
`apps/chat/test/openai-chat-streaming.test.ts` as the focused regression seam
for a provider request that can span multiple steps.

**Acceptance:**

- The final default Chat Completions and Responses JSON bodies contain exactly
  `cache.no-cache === true` and `cache.no-store === true`.
- The custom path contains neither gateway bypass flag.
- The Responses body still has the existing assistant-message fields required
  by the strict provider workaround.
- No network, credential, gateway, Redis, or paid-provider call is needed for
  the tests.
- The image-description request continues to use the same default provider
  wrapper and is therefore covered by the exact-cache boundary without
  receiving the stable chat-prefix key.

**Route and commit boundary:** The main session owns the provider-construction
decision and integration because it crosses the custom/default trust boundary;
the implementation commit owns only the fetch-policy helper, route wiring, and
its focused synthetic tests. No prompt identity or documentation changes are
included in this commit.

**Verification and stop condition:** Run the focused cache-policy tests through
the validated devcontainer, then the chat suite and chat typecheck. Stop and
return to the main session if the wrapper cannot distinguish default from
custom construction, changes request headers or abort behavior, or requires a
gateway call to prove the contract. After the immutable commit, if the change
still qualifies as a substantive provider-boundary slice, start exactly one
read-only `slice-reviewer` and one `simplifier` in parallel before integrating;
both must return before the next slice.

**Suggested commit:** `enhance(chat): bypass exact cache for personalized chat`

### Slice 3 — Stable prompt-prefix identity and deterministic request order

**Route:** `main`.

**Execution-tier skip reason:** critical-path coupling — the identity helper,
canonical provider-facing tool projection, executable tool behavior, and both
transport serializers must be designed and integrated together.

**Scope:** Add
`apps/chat/src/lib/server/promptCacheIdentity.ts` and integrate it at the
route's final prompt/tool assembly. The helper should produce a versioned
SHA-256 key from the requested deployment/transport identity, final effective
instructions, and canonical provider-visible tool names/descriptions/schemas.
Use the installed AI SDK schema conversion boundary; do not serialize tool
execution functions, MCP clients, or request-specific values. Build one
provider-facing canonical tool projection for both the fingerprint and the
request, preserving runtime execution behavior and all provider-visible
fields. Pass an explicit stable `toolOrder` to the model request and use the
same canonical ordering for the fingerprint. Attach `promptCacheKey` for the
default gateway path; attach implicit mode only for the explicit supported
direct-model capability set. Omit explicit breakpoints.

**Tests:** Add
`apps/chat/test/prompt-cache-identity.test.ts` for determinism, meaningful
changes, deployment/transport partitioning, capability-gated implicit mode,
canonical tool order/schema/provider-visible-field changes, and separate
privacy-negative inputs for user, participant, chatbot, thread,
assistant-message, message/content, request, tool-call, and raw MCP identifiers.
Extend
`apps/chat/test/openai-chat-streaming.test.ts` or add a focused Responses
fixture to assert that both transports serialize the key, canonical tools, and
only the supported implicit options.

**Acceptance:**

- Equivalent stable prefixes with different object insertion order produce the
  same key and the same provider tool order.
- Any changed effective instruction, tool name, description, provider-visible
  schema, version marker, requested deployment, or transport family produces a
  different key.
- Participant, user, chatbot, thread, assistant-response, request, tool-call,
  and raw MCP database identifiers cannot affect the key.
- The requested `auto-router` identity is included as-is; the implementation
  does not claim that it represents the resolved model.
- The custom endpoint path retains its existing provider-options shape.
- Custom Responses requests retain existing `store` and reasoning options;
  only the new default-gateway fields are absent.
- No explicit `promptCacheBreakpoint` is emitted.

**Route and commit boundary:** The main session owns the stable-prefix input
contract and the provider-facing canonical-tool projection because it couples
prompt identity, tool execution, and both transport serializers. The
implementation commit owns the identity helper, canonical tool adapter,
provider-option integration, explicit `toolOrder`, and focused identity/
transport tests. Do not change exact-cache policy in this commit.

**Verification and stop condition:** Run identity and both-transport capture
tests through the validated devcontainer, then the chat suite and chat
typecheck. Stop if the canonical projection cannot preserve tool execution or
if the installed SDK exposes provider-visible fields that cannot be represented
without expanding the stable-prefix contract. After the immutable commit,
start exactly one read-only `slice-reviewer` and one `simplifier` in parallel
when the substantive-slice gate applies; await and disposition both before
integration.

**Suggested commit:** `enhance(chat): add stable prompt cache identity`

### Slice 4 — Transport contract, documentation, and closure

**Route:** `main`.

**Execution-tier skip reason:** critical-path coupling — documentation,
public-usage assertions, and final verification must be fact-checked against
the integrated runtime contract.

**Scope:** Convert the useful assertions from the disposable probe into
repository-owned tests, including public AI SDK `usage.inputTokenDetails` for
both transports. Update `docs/chat-platform.md`, `docs/testing.md`, and
`.agents/skills/klicker-testing-verification/SKILL.md` with the request-boundary
contract, deterministic identity inputs, privacy exclusions, synthetic proof
boundary, and deferred live verification. Add dated wiki maintenance logs as
required by the repository skill. Do not add an ADR unless a new durable
architecture decision is actually discovered.

**Acceptance:**

- Focused Chat/Responses transport tests pass with synthetic responses.
- The public usage assertion distinguishes uncached input, cache reads, and
  cache writes without changing credits or cost calculation semantics.
- Documentation names local serialization proof as local evidence only and
  does not imply LiteLLM, provider, router, production, or cost proof.
- The relevant chat testing skill describes the new focused tests and the
  unchanged browser rule.
- The integrated final review covers correctness, plan compliance,
  maintainability, security, and architecture/data-flow concerns applicable to
  the changed server boundary.

**Route and commit boundary:** The main session owns integration, documentation
fact-checking, and final readiness. This slice may contain focused test and
documentation edits only; it must not add a new runtime behavior that bypasses
slice review. If documentation changes exceed the package's settled contract,
stop for a plan correction.

**Verification and stop condition:** Run the focused and full chat checks,
root checks, and the production build through the validated devcontainer. Stop
before final review if any check is unavailable, if public usage buckets are
not exposed as planned, or if docs would need live-provider claims. This slice
is documentation/test-heavy and normally does not need simplification; if it
contains substantive executable changes, apply the same parallel
`simplifier`/`slice-reviewer` gate.

**Suggested commit:** `docs(chat): document cache request contracts`

## Verification contract

Run checks in this order after each applicable implementation slice. All
package-manager, test, typecheck, lint, and build commands run inside the
validated self-contained devcontainer; only `devrouter ensure` and the host
worktree/Git commands run on the host.

1. Focused transport and identity tests, using the package's Vitest runner and
   the exact new/changed test files, through `devrouter exec`.
2. Full chat tests:
   `devrouter exec <validated-devpod> -- pnpm --filter @klicker-uzh/chat test:run`.
3. Chat typecheck:
   `devrouter exec <validated-devpod> -- pnpm --filter @klicker-uzh/chat check`.
4. Relevant formatting/lint checks, then repository checks:
   `devrouter exec <validated-devpod> -- pnpm run check:all`.
5. Production build through the self-contained devcontainer, not the host:
   validate the checkout with `devrouter ensure . --json`, then run the exact
   validated DevPod command for `devrouter exec <validated-devpod> -- pnpm run build`.

The exact focused Vitest invocation may use the repository's package script
with the changed file paths after confirming its argument forwarding. Do not
install dependencies or start a dev server merely to run the planning task.
Do not use the cluster tunnel, staging, production, Langfuse, LiteLLM, Redis,
Azure, or a paid model for this package. A green local test, typecheck, or
build proves only that local contract; it does not prove gateway cache
behavior, provider cache hits, resolved auto-router partitioning, latency, or
cost.

## Documentation changes planned for the implementation package

| File | Planned fact to add or update | Evidence to cite in the file |
| --- | --- | --- |
| `docs/chat-platform.md` | Default versus custom provider request boundary; stable prompt-prefix identity inputs/exclusions; implicit caching and no-breakpoint decision | Route symbols, model registry, AI SDK/OpenAI provider source, synthetic test path |
| `docs/testing.md` | Focused synthetic transport contract, public usage-bucket assertion, and proof boundary | Test files, disposable-probe result, package commands |
| `.agents/skills/klicker-testing-verification/SKILL.md` | Required focused checks for OpenAI-compatible request-policy changes and the unchanged browser condition | Repository test scripts and chat test files |
| `docs/solutions/` | Only if implementation uncovers a non-obvious durable incident lesson | `$rs-compound` after the lesson is verified; not created speculatively |

The plan itself does not edit those documentation surfaces. Any behavior
change implementation must update them in the same package, following
`$klicker-wiki-maintenance`; the edits must remain fact-linked and must not
copy session provenance or private evidence into the wiki.

## Review and approval gates

### Planning-stage review

Before presenting this plan for approval, run one separate read-only configured
`planner` review against the frozen draft identity. Reserve the tuple in
`project/_local/reviews/chat-cache-request-boundary-gate-register.md` before
dispatch. The planner must inspect the plan, the named worktree, the relevant
route/provider/test seams, the disposable probe, and the repository's review
rubric. It must return a verdict with quoted path/symbol evidence and address:

- whether the cache boundaries are technically distinct and correctly scoped;
- whether custom endpoints, Responses, Chat Completions, image descriptions,
  tool schemas, and `auto-router` identity are handled without accidental
  leakage or unsupported claims;
- whether the test portfolio catches the named failure modes at stable seams;
- whether the plan stays within the planning authority and avoids live/paid
  operations; and
- whether the documentation and verification closure is complete.

Record the full report at
`project/_local/reviews/2026-08-12-chat-cache-request-boundary-planning-stage.md`
and update the plan with the verdict and any verified accepted findings. If a
finding materially changes the architecture, scope, or acceptance contract,
stop and reassess rather than silently expanding the plan.

Planning-stage result: `DONE_WITH_CONCERNS`, with the report recorded at the
path above. The parent verified and accepted all five required corrections:
capability-gated implicit mode, one canonical provider-tool projection for
hashing and wire submission, the real custom-provider option invariant, direct
image/privacy-negative test seams, and per-slice route/commit/verification
contracts including the parallel simplifier/reviewer gate. The corrected plan
remains within the settled architecture and planning authority. Its final
working-tree hash is intentionally different from the frozen pre-review hash;
the report preserves the exact identity that was reviewed.

### Post-approval implementation reviews

- The approved plan is committed first.
- The exact-cache boundary and stable identity slices are substantive server
  changes crossing a provider/data-flow boundary, so each requires one
  risk-selected read-only slice review after its exact commit and before
  integration.
- The integrated branch requires one configured read-only final reviewer after
  verification and before it is presented as complete or added to a PR.
- Review register identity, package key, scope key, report paths, and any
  correction attempt remain under the new package's ignored review directory.
- No review authorizes edits, commits, pushes, publication, deployment, or
  production access.

## Progress

- [x] Read the takeover handoff and required workflow skills.
- [x] Validate the live `v3` ref through read-only remote lookup.
- [x] Verify the existing worktrees and closed reference PR.
- [x] Create the named clean worktree from current `origin/v3`.
- [x] Inspect the route, model registry, MCP aggregation, AI SDK seam, tests,
  docs, and synthetic contract evidence.
- [x] Draft this full execution plan.
- [x] Reserve and complete the independent planning-stage review.
- [x] Incorporate verified review corrections and independently recheck them.
- [x] Present the reviewed plan for user approval; approval received on
  2026-08-12.
- [x] Commit the approved plan as the branch's first commit (`1c8ff5bf0`).
- [x] Slice 2 implemented: the default-provider fetch boundary adds the exact
  cache bypass while preserving Responses normalization, and the focused
  synthetic transport/image tests pass. The executor returned `NEEDS_CONTEXT`
  without edits, so the main session retained provider-boundary integration.
- [ ] Slice 2 review gate: commit the immutable slice, then run one
  `slice-reviewer` and one `simplifier` in parallel before Slice 3.
- [ ] Implement and verify the approved slices.

## Next action after user approval

Approval has now been received. Commit this plan as the first branch commit,
then execute the slices in order. A generic approval here does not
authorize push, PR creation, merge, deployment, measurement, tunnel use, paid
calls, or production mutation; those remain separate named gates.
