# PLAN — GrowthBook feature flags

- **Date:** 2026-08-06
- **Repository:** `uzh-bf/klicker-uzh`
- **Stack:**
  1. `feat/growthbook-foundation` → `v3`
  2. `feat/growthbook-learning-analytics` → `feat/growthbook-foundation`
- **Goal:** establish one typed GrowthBook integration that future Klicker
  frontends and Node.js services can adopt, then prove it by replacing the
  lecturer learning-analytics preview gate.

## User decisions

- GrowthBook is self-hosted in the same Kubernetes cluster as Klicker.
- A browser-accessible HTTPS SDK endpoint exists.
- Browser consumers use the public SDK endpoint; future Node.js consumers use
  the cluster-internal service.
- GrowthBook must support per-user targeting using Klicker's internal actor ID.
- Learning-analytics controls remain visible but cannot be clicked when the
  flag is disabled.
- The first product flag is a rollout control, not an authorization boundary;
  direct analytics URLs remain unchanged.
- The work ships as two native GitHub stacked draft PRs.

## Non-goals

- Deploying or administering the GrowthBook service.
- Creating flags or targeting rules through GrowthBook's management API.
- Adding GrowthBook initialization to applications that do not yet consume a
  flag.
- Running an A/B experiment or adding exposure tracking in this stack.
- Protecting routes, GraphQL fields, or service operations with the
  learning-analytics flag.
- Removing the Prisma `publicPreview` field in this stack.
- Changing `privatePreview` behavior.

## Architecture

### Shared package

Add `@klicker-uzh/feature-flags` as the single integration boundary. Consumers
must not construct GrowthBook SDK instances directly. The package has three
entry points:

- `@klicker-uzh/feature-flags` — typed feature registry, feature values, and
  the shared targeting-attribute contract.
- `@klicker-uzh/feature-flags/react` — a provider and typed hooks for browser
  applications. It uses the browser-accessible SDK host.
- `@klicker-uzh/feature-flags/node` — a process-level `GrowthBookClient`
  adapter for Node.js services. Evaluation accepts a request-specific user
  context, so attributes are never shared mutably between concurrent requests.

The core contract starts with no product flags in the foundation layer. The
second layer adds:

```ts
type KlickerFeatureFlags = {
  'learning-analytics': boolean
}
```

Both adapters expose Klicker-owned methods rather than raw SDK instances. This
keeps feature names, fallback semantics, and attributes consistent if the SDK
is replaced later.

### Targeting attributes

The shared minimum actor context is:

```ts
type FeatureFlagAttributes = {
  id?: string
  actorType: 'user' | 'participant' | 'anonymous'
  role?: string
  environment: 'development' | 'test' | 'staging' | 'production'
}
```

- `id` is the internal Klicker UUID for `User` or `Participant`.
- Email, display name, and other personal data are not sent to the SDK.
- The same `id` and attribute names must be used for browser and server
  evaluation, so percentage rollouts and targeted assignments remain stable.
- GrowthBook attribute values supplied by Klicker stay local to SDK evaluation,
  but browser feature payloads can expose targeting rules. If pseudonymous ID
  lists must also be hidden, use GrowthBook remote evaluation or add a distinct
  hashed secure-ID attribute consistently on browser and server.

### Browser lifecycle

The React adapter owns SDK construction, initialization, attribute updates,
and cleanup. It receives `apiHost`, `clientKey`, and attributes from the host
application. Missing configuration, loading, unknown flags, timeouts, and
network failures all evaluate to the declared fallback.

`frontend-manage` activates the adapter inside its authenticated `Layout`,
after `UserProfileDocument` has returned the lecturer. Login and unauthenticated
pages do not initialize GrowthBook. The first slice uses normal SDK fetching
and caching without streaming; published changes are observed through the
SDK's normal refresh/cache lifecycle. Streaming can be added later if the
deployment includes the GrowthBook Proxy Server.

### Node.js lifecycle

The Node adapter wraps one process-level `GrowthBookClient`, initialized during
service startup from `GROWTHBOOK_API_HOST` and `GROWTHBOOK_CLIENT_KEY`. Feature
evaluation receives `FeatureFlagAttributes` on every call. The singleton owns
the cached feature payload, while user state remains request-scoped.

The foundation package provides and tests this adapter, but no running backend
service initializes it in this stack. The first backend flag can choose the
appropriate process startup and shutdown integration without changing the
shared contract.

### Configuration

Browser applications use:

- `NEXT_PUBLIC_GROWTHBOOK_API_HOST`
- `NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY`

Node.js services use:

- `GROWTHBOOK_API_HOST`
- `GROWTHBOOK_CLIENT_KEY`

The browser variables contain an SDK connection and never a GrowthBook
management/admin key. Production and staging builds receive their own SDK
connection values. Node deployments may point `GROWTHBOOK_API_HOST` at the
cluster-internal service. Local/test environments without configuration use an
empty feature payload and deterministic fallbacks.

## Stack layer 1 — GrowthBook foundation

**Branch:** `feat/growthbook-foundation`

### Scope

- Add the `@klicker-uzh/feature-flags` package with core, React, and Node entry
  points.
- Add pinned GrowthBook SDK dependencies and synchronized lockfile changes.
- Implement fail-closed initialization and typed boolean-value evaluation.
- Unit-test browser and server adapters with in-memory feature payloads; tests
  make no external network requests.
- Document browser versus internal Node connectivity, configuration, attribute
  privacy, lifecycle, fallbacks, and adoption steps.
- Add ADR 0005 recording the decision to replace database-wide preview
  booleans with GrowthBook flags incrementally.
- Add the package to the monorepo build/check/test conventions.

### Acceptance evidence

- The package builds and type-checks independently.
- Tests prove a boolean flag defaults to `false`, evaluates per actor, and does
  not leak attributes between server evaluations.
- Existing Klicker applications behave identically because none initializes
  the package yet.

## Stack layer 2 — Learning analytics example

**Branch:** `feat/growthbook-learning-analytics`

### Scope

- Add the boolean `learning-analytics` feature to the shared registry.
- Initialize the React provider for authenticated `frontend-manage` layouts.
- Supply lecturer `User.id`, actor type `user`, `User.role`, and environment.
- Replace all five active analytics-related `publicPreview` gate categories:
  - main analytics navigation;
  - course-level learning-analytics button;
  - asynchronous evaluation analytics button;
  - practice-quiz analytics action;
  - microlearning analytics action.
- Render each control in both states and pass `disabled` through button,
  navigation, and dropdown-action renderers.
- Remove `publicPreview` from `QUserProfile`, then regenerate committed GraphQL
  operations. Keep the Prisma field and public GraphQL schema field for a later
  compatibility migration.
- Refactor Playwright feature-access coverage so private-preview assertions
  remain database-driven and learning analytics is driven by mocked GrowthBook
  SDK payloads.
- Capture enabled and disabled browser screenshots in the real local manage
  application.

### Runtime behavior

| State | Analytics controls | Click/navigation |
| --- | --- | --- |
| Targeted `true` | Visible | Enabled |
| Targeted/default `false` | Visible | Disabled |
| SDK loading | Visible | Disabled |
| Missing config / no usable payload | Visible | Disabled |
| Network error with valid cached payload | Visible | Cached value |

Direct `/analytics/...` routes remain accessible to authenticated lecturers;
GrowthBook is not an authorization mechanism.

### GrowthBook operator setup

Before rollout, an operator creates a boolean feature named
`learning-analytics` in the self-hosted GrowthBook project:

- default value: `false`;
- environment-specific rules;
- optional per-user rules or a saved ID group using Klicker `User.id` values;
- production publication only after the code is deployed and verified in
  staging.

No management API mutation is part of either PR.

## Klicker feature-design checklist

- **Domain vocabulary:** the example targets lecturer `User` records, not
  student `Participant` records. The foundation supports both actor types.
- **Layer footprint:** layer 1 adds a shared package, lockfile, docs, and ADR.
  Layer 2 touches `frontend-manage`, shared flag types, generated GraphQL ops,
  Playwright, environment configuration, and docs. Prisma models, migrations,
  seeds, Hatchet, grading, and i18n are unchanged.
- **Auth:** no new API operation. Only authenticated manage layouts supply a
  `User` attribute context. Flags never grant permissions.
- **Gamification:** no points, XP, achievements, or leaderboard impact.
- **Async:** no Hatchet task, scheduler, or response-processing impact.
- **UI:** `frontend-manage` only in layer 2. No new user-visible string is
  required; native disabled states are used. Existing `data-cy` hooks remain.
- **Test level:** package unit tests, manage/package type checks, targeted
  Playwright, production build, and browser screenshots.
- **Seeds/fixtures:** no seed changes. Playwright intercepts the SDK feature
  payload and uses existing lecturer fixtures.

## Error handling and observability

- Boolean features always declare an application fallback; the example uses
  `false`.
- SDK initialization failures do not crash application startup or rendering;
  a valid cached payload may continue to serve its last known value.
- The Node adapter returns SDK initialization status to its caller; the React
  adapter fails closed without emitting user IDs or feature payload contents.
  Production avoids noisy per-evaluation logs.
- Backend adopters must initialize once, use request-scoped attributes, and
  choose polling or streaming explicitly for long-running processes.
- Feature use is operationally distinguishable from experimentation. Exposure
  tracking is added only when Klicker runs an actual experiment.

## Verification

### Layer 1

```bash
pnpm --filter @klicker-uzh/feature-flags check
pnpm --filter @klicker-uzh/feature-flags test
pnpm --filter @klicker-uzh/feature-flags build
pnpm run check:syncpack
pnpm run format:check
```

### Layer 2

```bash
pnpm --filter @klicker-uzh/graphql generate
pnpm --filter @klicker-uzh/frontend-manage check
pnpm --filter @klicker-uzh/frontend-manage lint
pnpm --filter @klicker-uzh/frontend-manage build
pnpm --filter @klicker-uzh/playwright test:run --grep "feature access"
pnpm run format:check
```

Run the manage application through devrouter, validate targeted `true` and
`false` states with `npx agent-browser`, and retain screenshots for the second
draft PR.

## Documentation

- Layer 1 adds `docs/feature-flags.md`, links it from `docs/index.md`, records
  ADR 0005, and adds a dated wiki log entry.
- Layer 1 updates `docs/frontend-conventions.md` to replace the obsolete
  dedicated-platform rejection while retaining both legacy preview fields.
- Layer 2 documents the learning-analytics flag and migration of
  `publicPreview` consumers.
- Each PR description explains its exact place in the stack and includes only
  evidence available at that layer.

## References

- [GrowthBook SDK overview](https://docs.growthbook.io/lib)
- [GrowthBook React SDK](https://docs.growthbook.io/lib/react)
- [GrowthBook Node.js SDK](https://docs.growthbook.io/lib/node)
- [GrowthBook targeting conditions](https://docs.growthbook.io/features/targeting)

## Progress

- 2026-08-06: repository context and existing preview gates inventoried.
- 2026-08-06: user approved a two-layer native GitHub stack and the reusable
  foundation-first architecture.
- 2026-08-06: native stack initialized with `feat/growthbook-foundation` based
  on `v3`.
- 2026-08-06: foundation implemented with GrowthBook SDK `1.6.5` (the latest
  versions published for both core and React packages) and 11 passing contract,
  browser, targeting, and request-isolation tests.
- 2026-08-06: foundation verification passed package check/build, Syncpack,
  repository formatting, and Opengrep (213 rules, 0 findings). No application
  imports the package in layer 1.
- 2026-08-06: foundation review added a separate test TypeScript config so the
  package `check` command covers both declarations and Vitest sources.
- 2026-08-06: full `pnpm run build` passed at the foundation tip (23 tasks,
  including a fresh feature-flags build; 22 existing tasks were cached).
- 2026-08-06: wiki files pass Prettier. The validator referenced by
  `klicker-wiki-maintenance` was unavailable at its documented local path.
