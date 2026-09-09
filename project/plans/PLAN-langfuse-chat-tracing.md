# Langfuse tracing for AI SDK 7 chat

## Goal

Make `apps/chat` emit useful, privacy-conscious Langfuse traces through the
native AI SDK 7 integration, compatible with the self-hosted Langfuse v4.28.1
deployment. One streamed chat turn should produce a stable, named trace whose
generations and tool calls carry model/usage data and can be grouped into a
conversation session.

## Non-goals

- Do not enable telemetry in staging or production in this PR.
- Do not mirror `ChatMessage.rating` to Langfuse; PostgreSQL remains the only
  rating store until a durable delivery design exists.
- Do not move prompts into Langfuse Prompt Management or add evaluators.
- Do not add UI, GraphQL, Prisma, seed, or gamification changes.
- Do not instrument unrelated HTTP/database spans.

## Design

### Domain vocabulary

- A **chat turn** is one participant request and its assistant response.
- A Langfuse **trace** represents one chat turn.
- A Langfuse **session** represents one Klicker chat thread.
- No Langfuse **user** identifier is exported in this first version. Stable
  per-user analytics require a separate privacy and secret-rotation decision.

### Options considered

1. Patch only the existing OpenTelemetry 1.x provider. This does not satisfy
   the current Langfuse peer requirements and misses AI SDK 7's callback-based
   telemetry integration.
2. Upgrade to the Langfuse v5 AI SDK 7 integration and OTel 2-compatible
   `NodeSDK` (**selected**). This is the current first-party path and captures
   generations, tools, model identity, usage, errors, and lifecycle events.
3. Rely only on LiteLLM proxy tracing. This loses application-level thread,
   participant, chat-mode, and tool-execution context and does not cover custom
   provider routes consistently.

### Layer footprint

- `apps/chat`: dependencies, Next instrumentation, server tracing helpers,
  streamed chat trace context/lifecycle, exec-form container startup, and unit
  tests.
- `deploy/charts/klicker-uzh-v3` plus environment values: non-secret tracing
  environment/release configuration; telemetry requires explicit opt-in and
  defaults to disabled.
- `turbo.json`: allow new runtime environment variables through strict env.
- `docs/chat-platform.md`: replace the obsolete broken-exporter warning with
  the durable tracing/privacy/rollout contract.
- No Prisma, GraphQL, shared type, i18n, Hatchet, frontend UI, or fixture
  changes.

### Auth and privacy

- The existing participant authentication and course-membership checks remain
  authoritative; tracing does not grant access or alter request behavior.
- Derive only a pseudonymous `sessionId` and chatbot identifier from
  server-validated IDs. Do not export `userId` or any raw database ID.
- Export only low-cardinality operational metadata: request, model, routing,
  chat mode, reasoning effort, tool count, and attachment count. Do not export
  course names, participant names, emails, or raw database IDs as attributes.
- Do not record AI SDK inputs or outputs. Apply an exporter mask for secrets
  and image data URLs as defense in depth, and disable Langfuse media upload.
- Keep Langfuse v5's default LLM-focused span filter; do not export all OTel
  spans.

### Trace shape and lifecycle

- Register `LangfuseVercelAiSdkIntegration` only on the primary chat
  `streamText` call and export through `LangfuseSpanProcessor` in a `NodeSDK`.
  The image-description call is explicitly excluded from telemetry.
- Use the stable application-root name `generate-chat-response`. Adapter-owned
  child observations retain the Langfuse AI SDK's standard model/tool names;
  model identity is also carried in structured attributes.
- Keep the streamed root observation open across the AI SDK stream and close it
  exactly once on completion, abort, or error. Set its input and output only to
  bounded operational summaries such as message/attachment counts, terminal
  status, and response length.
- Propagate trace name, pseudonymous session ID, a `chat` tag, and allowlisted
  string metadata before the AI SDK creates observations.
- Derive deterministic trace addressing from a namespaced composite of the
  server-validated chatbot/thread and `assistantMessageId`, without exporting
  any of those raw IDs.
- Batch export in the long-running Next/Kubernetes process. Register a Next.js
  `after()` callback for each traced route to flush after the streamed response
  closes. Exec-form container startup forwards termination signals and a
  90-second pod grace period allows active requests and trace draining to
  finish where possible. Existing request cancellation remains unchanged;
  the grace period does not guarantee completion of unbounded requests.
  Live rollout must still verify delivery against the deployed server.

### Other feature-design questions

- Gamification: none; no points, XP, or leaderboard behavior changes.
- Async/Hatchet: none; export batching is owned by the Langfuse/OTel SDK in the
  chat process.
- UI/i18n: none; no visible state or strings change, so no browser screenshot
  is required for this server-only draft.
- Seeds/fixtures: none.

## Slices

1. Upgrade Langfuse to `5.10.1`, add the AI SDK 7 adapter and OTel
   `NodeSDK@0.221.0`, and remove the incompatible OTel 1.x tracer dependency.
   These are the newest releases that satisfy the repository's minimum-release-
   age supply-chain policy; the newer `5.11.0`/`0.222.0` releases are blocked.
   Langfuse's compatibility matrix supports SDK v5 and OTLP ingestion on the
   self-hosted server v4 line; v4.28.1 is newer than the documented v3.63.0
   minimum for the SDK.
2. Add strict telemetry opt-in/configuration, pseudonymous session grouping,
   metadata-only capture, masking, attribute propagation, stable names, and
   exact streaming observation closure.
3. Add focused unit tests for enablement, pseudonymous IDs, masking (including
   error status/events), propagated context, enabled stream lifecycles, startup
   registration, and graceful shutdown.
4. Add environment/release chart wiring and update the engineering wiki.
5. Run package tests/check/lint/build plus repository pre-PR checks where the
   host environment permits them. A real Langfuse trace fetch is a required
   rollout gate but remains blocked in this checkout because no project keys are
   available and both deployed environments intentionally disable telemetry.

## Verification evidence

- `pnpm --filter @klicker-uzh/chat test:run`
- `pnpm --filter @klicker-uzh/chat check`
- `pnpm --filter @klicker-uzh/chat lint`
- `pnpm --filter @klicker-uzh/chat build`
- `pnpm run check:all`
- `pnpm run build`
- Render/inspect the chat ConfigMap for staging and production.
- Confirm the lockfile resolves Langfuse against OTel 2.x peers.
- Exercise AI SDK 7 spans through the real Langfuse v5 processor and an
  in-memory OTel exporter, asserting operational attributes are present while
  prompt, response, tool-argument, tool-result, provider-error, and tool-error
  sentinels are absent from attributes, status, and events.
- Live trace audit (deferred rollout gate): enable a non-production Langfuse
  project, execute a synthetic chat turn, fetch it with `langfuse-cli`, and
  audit naming, nesting, input/output, model, usage, masking, session/user
  attributes, environment, and release against the current Langfuse best
  practices page.

## Progress

- 2026-09-03: Installed and read the Langfuse skill; fetched the current
  Langfuse instrumentation, AI SDK 7 integration, v4→v5 migration, sessions,
  masking, OTel, and trace-quality guidance.
- 2026-09-03: Confirmed the existing `@langfuse/otel@4.6.1` resolves against
  incompatible OTel 1.26 peers, AI SDK 7 lacks its required Langfuse adapter,
  and both staging and production keep telemetry disabled.
- 2026-09-03: Selected the native Langfuse v5 + AI SDK 7 integration; code not
  yet changed.
- 2026-09-03: The lockfile guard rejected Langfuse `5.11.0` and OTel `0.222.0`
  as too new; selected the newest policy-approved versions, `5.10.1` and
  `0.221.0`.
- 2026-09-03: Independent plan review tightened the privacy contract to
  metadata-only capture, no `userId`, per-call AI SDK integration, strict
  opt-in, and an explicitly untraced image-description call.
- 2026-09-03: Implemented tracing, deployment wiring, and the SDK-side
  compatibility harness. Independent review found and prompted fixes for raw
  upstream exception details, process shutdown flushing, enabled-path test
  coverage, and the scope of the stable-name contract. The complete Chat
  suite, Chat typecheck/lint, root build, root `check:all`, Helm lint, staging
  and production render checks, and whitespace checks pass.

- 2026-09-08: Review corrections restore the accurate parent-span comment,
  replace the UI-copy assertion with a redaction assertion, share the sanitized
  error constant, and handle null telemetry values in the Helm ConfigMap.
  Remove the newly imposed 55-second deadline and its MCP cancellation rewrite;
  preserve the target branch's scope-token discovery and request cancellation.
  Update the lifecycle description to avoid promising bounded drain completion.
- 2026-09-08: Integrated target `v3` at
  `3f6917ecc52d606d212db5b156be502cd5c99973` because GitHub reported conflicts.
  All four conflicts are resolved locally. The merge remains uncommitted, with
  review corrections also present in the working tree. Helm lint, the null
  telemetry render, and whitespace checks pass.
- 2026-09-08: Delivery is blocked before commit, publication, and final review.
  The managed runtime fails with an unexpected Compose model after startup;
  `devrouter exec` reports `Reliability operation-request blocked`. The supported
  repair command reports no persisted degraded runtime. The exact task runtime
  was stopped without deleting its data. Restore supported runtime readiness,
  run Chat tests and repository checks, complete the merge commit and independent
  final review, then update the existing PR and its exact-head checks.

- 2026-09-08 resume: The supported startup replaced the incompatible app
  container, then failed guarded database bootstrap because the retained
  PostgreSQL volume has no `klicker_test` role. Database logs confirm the missing
  role. Managed exec remains reliability-blocked, so no Chat test ran. Stopped
  the exact runtime again; deleting retained runtime data requires explicit
  approval. Default, null, enabled, staging, and production Helm renders pass.

- 2026-09-08 final verification: Approved runtime recreation resolved the retained
  database blocker. Chat tests pass (615 passed, 21 environment-gated skips),
  all 35 repository typecheck tasks pass, and all 23 build tasks pass. The
  equivalent repository lint, formatting, dependency, agent-document, identity,
  retired-artifact, and Prisma-sync checks pass. The 89 host-only Playwright
  tooling tests pass on the host. The aggregate container command cannot run
  those host-only tests, so its checks were completed separately.
- 2026-09-08 verification caveats: Prisma generation raced with its build during
  the aggregate check and produced stale declarations. A fresh sequential run
  passed. Local Prisma builds used Rollup's `--forceExit` option to close a
  process that remained alive after reporting completion; that temporary
  package-script change was restored and is not part of this PR.
- 2026-09-08 review disposition: The chart rejects non-HTTPS configured Langfuse
  endpoints. Default, null, enabled, staging, and production chart cases pass,
  and HTTP is rejected. Gitleaks reports no staged leaks. A bounded Opengrep
  scan reports only two unchanged development-logging findings. Retain the
  first-party NodeSDK integration and test-state reset helper; replacing them
  is unnecessary for this review correction. Live trace export remains a
  separate rollout gate, and telemetry remains disabled in deployed values.
- 2026-09-08 delivery: Source corrections and target integration are complete.
  Final independent review and publication of the reviewed head remain next.

- 2026-09-08 final review: Independent review of the integrated committed range
  found only a stale chart comment claiming the removed deadline. Corrected
  that comment and verified Helm rendering. No source publication blocker
  remains. The runtime is stopped, its app container is exited, and all four
  task routes are removed.
