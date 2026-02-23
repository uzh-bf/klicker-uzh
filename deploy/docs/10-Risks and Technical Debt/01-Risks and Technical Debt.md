# Risks and Technical Debt

Living list of repo-grounded implementation debt and architectural risks that impact correctness, operability, and future change.

## Technical Debt

### High

- **Audit logging is logger-only**
  - Description: `create-audit-log-entry` is a Hatchet task that currently only writes to `ctx.logger` (no durable audit sink).
  - Source: `/Volumes/HOME/Git/klicker/klicker-uzh/packages/hatchet/src/index.ts:55`
  - Impact: limited forensic traceability (especially for assessment flows that rely on correlation IDs).
- **Assessment response audit fallback is incomplete when Hatchet push fails**
  - Description: when `response-received:assessment` cannot be pushed, the response API tries to push an audit event; if that also fails it only logs to stderr (no direct network fallback).
  - Source: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/response-api/src/index.ts:330`
  - Impact: possible loss of audit evidence for assessment submissions during orchestrator/network incidents.
- **Response processor retains legacy Azure Function-era structure**
  - Description: the non-assessment response processor explicitly calls out that it originated from an Azure Function and needs a rework to Hatchet best practices (DAG-style tasks, clearer idempotency boundaries).
  - Source: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/hatchet-worker-response-processor/src/processors/processor.ts:1`
  - Impact: harder retriability/idempotency reasoning; higher maintenance cost for changes in live quiz grading/aggregation.

### Medium

- **Leaderboard and participation edge cases are not fully resolved**
  - Description: the processor notes open questions around participants without course participation and rendering/handling of zero-point entries.
  - Source: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/hatchet-worker-response-processor/src/processors/processor.ts:29`
  - Impact: fairness/correctness issues in live leaderboards; potential confusion for instructors and participants.
- **Numerical scoring does not incorporate “distance to correct range”**
  - Description: the processor flags a missing scoring refinement for numerical items.
  - Source: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/hatchet-worker-response-processor/src/processors/processor.ts:309`
  - Impact: less nuanced feedback/scoring for numerical questions (pedagogical quality).
- **Free-text grading does not incorporate embedding-based similarity**
  - Description: the processor flags a potential enhancement to grade free-text using vector similarity approaches.
  - Source: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/hatchet-worker-response-processor/src/processors/processor.ts:386`
  - Impact: lower grading quality for free-text questions where near-matches should be rewarded.
- **Push notifications workflow is effectively disabled**
  - Description: `send-push-notifications` returns success early and its cron trigger is commented out.
  - Source: `/Volumes/HOME/Git/klicker/klicker-uzh/packages/hatchet/src/index.ts:277`
  - Impact: notification features remain non-functional; operational expectations may diverge from actual behavior.
- **Prisma `Decimal` conversion gotcha in GraphQL**
  - Description: `Decimal(0)` is truthy, so truthy checks can mis-handle “0” values; conversions must use `!= null` style guards.
  - Source: `/Volumes/HOME/Git/klicker/klicker-uzh/AGENTS.md:199`
  - Impact: subtle correctness bugs in analytics/scoring/reporting where zero-valued decimals are meaningful.

### Low

- **Test environment requires multiple services and specific env vars**
  - Description: running the full test suite needs a seeded DB and some package tests require Hatchet credentials.
  - Source: `/Volumes/HOME/Git/klicker/klicker-uzh/AGENTS.md:203`
  - Impact: higher friction for local verification; slower iteration for contributors.
- **Review-bot noise creates triage overhead**
  - Description: automated review tooling frequently flags false positives; manual confirmation is required.
  - Source: `/Volumes/HOME/Git/klicker/klicker-uzh/AGENTS.md:204`
  - Impact: wasted engineering time and distraction during PR review.

## Architectural Risks

- **Assessment split increases configuration surface area**
  - Evidence: parallel assessment Deployments/ConfigMaps/Ingresses and runtime gating via `ASSESSMENT_MODE`.
  - Sources:
    - `/Volumes/HOME/Git/klicker/klicker-uzh/deploy/charts/klicker-uzh-v3/templates/deployment-assessment.yaml`
    - `/Volumes/HOME/Git/klicker/klicker-uzh/deploy/charts/klicker-uzh-v3/templates/cm-backend-assessment.yaml`
    - `/Volumes/HOME/Git/klicker/klicker-uzh/deploy/charts/klicker-uzh-v3/templates/cm-response-api-assessment.yaml`
    - `/Volumes/HOME/Git/klicker/klicker-uzh/apps/response-api/src/index.ts:366`
  - Risk: drift between stacks (security settings, domains, Redis selection) and more complex rollout/testing paths.
- **Auth model evolution combines multiple contexts and cookie types**
  - Evidence: dual-context NextAuth selection plus additional JWT cookies used for live quiz response identity.
  - Sources:
    - `/Volumes/HOME/Git/klicker/klicker-uzh/apps/auth/src/pages/api/auth/[...nextauth].ts`
    - `/Volumes/HOME/Git/klicker/klicker-uzh/apps/auth/src/lib/helpers.ts`
    - `/Volumes/HOME/Git/klicker/klicker-uzh/apps/response-api/src/index.ts:114`
  - Risk: regressions in redirects/cookie domains and increased surface area for auth-related incidents.
- **Redis is the primary hot state store during live quizzes**
  - Evidence: live quiz session state and aggregation live in `lq:{liveQuizId}:...` keys and are mutated by workers using pipelines.
  - Sources:
    - `/Volumes/HOME/Git/klicker/klicker-uzh/packages/graphql/src/services/liveQuizzes.ts`
    - `/Volumes/HOME/Git/klicker/klicker-uzh/apps/hatchet-worker-response-processor/src/processors/processor.ts`
  - Risk: Redis incidents can cause partial/temporary loss of live results before they are flushed to PostgreSQL.
- **Kubernetes secrets are referenced but not created by the Helm chart**
  - Evidence: Deployments `envFrom.secretRef` expect `*-secret-*` objects, but there are no `kind: Secret` manifests under the chart templates.
  - Sources:
    - `/Volumes/HOME/Git/klicker/klicker-uzh/deploy/charts/klicker-uzh-v3/templates/deployment-app.yaml:57`
    - `/Volumes/HOME/Git/klicker/klicker-uzh/deploy/charts/klicker-uzh-v3/templates/deployment-chat.yaml:57`
    - `/Volumes/HOME/Git/klicker/klicker-uzh/deploy/charts/klicker-uzh-v3/templates/deployment-response-api.yaml:60`
    - `/Volumes/HOME/Git/klicker/klicker-uzh/deploy/charts/klicker-uzh-v3/templates/`
  - Risk: new environments can deploy “successfully” from Helm values but fail at runtime due to missing out-of-band secret provisioning.
- **Chat tool availability depends on runtime MCP server health**
  - Evidence: tools are loaded and filtered per request via streamable HTTP transport; per-server failures are tolerated but reduce capabilities.
  - Sources:
    - `/Volumes/HOME/Git/klicker/klicker-uzh/apps/chat/src/services/mcpClients.ts`
    - `/Volumes/HOME/Git/klicker/klicker-uzh/apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts:753`
  - Risk: variability in latency/availability and degraded user experience when MCP servers are slow/unavailable.

## Related docs

- [[01-Assessment vs Non-assessment Split]]
- [[02-Authentication and Cookies]]
- [[03-Redis Topology]]
- [[04-Hatchet Eventing]]
- [[01-Live Quiz - Non-assessment]]
- [[02-Live Quiz - Assessment]]
- [[03-Chat Request Lifecycle]]
- [[06-AI Keys and Model Registry]]
- [[07-MCP Servers and Tooling]]
