---
type: Feature Flags
title: Feature Flags
description: Shared GrowthBook contracts, frontend and backend connectivity, targeting attributes, failure behavior, and the adoption checklist.
timestamp: '2026-08-24'
tags:
  - architecture
  - frontend
  - backend
---

# Feature Flags

**Browser and backend consumers share one typed flag registry, but they must not
share one network address.** Browsers need a public HTTPS SDK endpoint with
CORS for the Klicker origin; Node.js services should use GrowthBook's
cluster-internal service. The browser client key identifies an SDK connection
and is not a GrowthBook management key.

The reusable foundation is `@klicker-uzh/feature-flags`. Its registry is
`packages/feature-flags/src/contracts.ts:FEATURE_FLAG_DEFAULTS`. Applications
initialize GrowthBook only when they adopt their first flag.

## Active flags

| Key                  | Consumer           | Fallback | Disabled behavior                                    |
| -------------------- | ------------------ | -------- | ---------------------------------------------------- |
| `learning-analytics` | Lecturer UI/Manage | `false`  | Analytics controls remain visible but are not usable |

Disabled analytics controls explain that the feature is not yet available for
the current account. This keeps a deliberately staged rollout distinguishable
from a broken control without implying that lecturers can enable it themselves.

Manage mounts the browser provider at the application root with anonymous
attributes, then updates it after `QUserProfile` resolves to target the
authenticated lecturer by stable `User.id`, role, actor type, and environment.
This keeps full-screen routes such as activity evaluations inside the provider.
Public live-quiz evaluation links with an HMAC stay anonymous and skip the
profile lookup so Apollo's Unauthorized handler cannot redirect them to login.
The former `User.publicPreview` field is no longer selected by that operation
and is not authoritative for learning analytics. The Prisma and public GraphQL
fields remain available for other consumers and a later cleanup.

Direct analytics routes remain reachable to authenticated lecturers, but they
render an unavailable state while the flag is off. When the flag is on, course
dashboards remain unavailable until the course control is enabled and a fresh
recomputation is valid. The flag controls product affordances, not
authorization; routes and APIs continue to enforce their own access rules.

## Package contract

| Import                             | Purpose                                                                |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `@klicker-uzh/feature-flags`       | Strict flag keys, defaults, targeting attributes, environment handling |
| `@klicker-uzh/feature-flags/react` | Browser `FeatureFlagProvider` and typed `useFeatureFlag`               |
| `@klicker-uzh/feature-flags/node`  | Multi-user `NodeFeatureFlagClient` for process-level backend instances |

Both GrowthBook dependencies are intentionally pinned to `1.6.5` for a
synchronized core and React SDK pair
(`packages/feature-flags/package.json`). The package checks below run without
Klicker services:

```bash
pnpm --filter @klicker-uzh/feature-flags test
pnpm --filter @klicker-uzh/feature-flags check
pnpm --filter @klicker-uzh/feature-flags build
```

## Environment and targeting attributes

Every client config receives the deployment environment. The adapters
normalize it once and add it to every GrowthBook evaluation. Every caller
supplies the actor contract from
`packages/feature-flags/src/contracts.ts:FeatureFlagAttributes`:

- `id`: the stable Klicker `User.id` or `Participant.id` when one exists;
- `actorType`: `user`, `participant`, or `anonymous`;
- `role`: the Klicker role when applicable;
- `environment`: added by each adapter after normalizing its deployment config;

`normalizeFeatureFlagEnvironment` maps an unset value to `development`. A
recognized value (`development`, `test`, `staging`, or `production`) allows the
client to initialize normally. Any other non-empty value becomes `unknown`, is
logged, and makes the client behave as unconfigured: it performs no SDK fetch,
initializes an empty payload, and evaluates every boolean flag `false`. An
`id`-targeted rule or a remote default of `true` therefore cannot bypass an
invalid deployment environment.

The environment-specific SDK key remains GrowthBook's environment boundary;
the normalized value is also included as an evaluation attribute for
diagnostics and optional targeting. `NEXT_PUBLIC_ENV` is registered in
`turbo.json` `globalEnv` so changing it invalidates the Turborepo build cache.

Do not use email addresses or other direct identifiers. Browser attributes and
client-side targeting rules are observable by the person using the browser, so
they must not carry secrets or authorize data access. A flag may change what is
offered in the UI; the destination route and API must still enforce their own
authentication and authorization.

## Browser adoption

The adopting app maps these public build variables into the provider config:

- `NEXT_PUBLIC_GROWTHBOOK_API_HOST`: public HTTPS GrowthBook SDK endpoint;
- `NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY`: environment-specific client SDK key.

It must also pass
`process.env.NEXT_PUBLIC_ENV ?? process.env.NODE_ENV` as `environment`.

The app owns environment-variable registration in `turbo.json`; the shared
package itself reads no process environment. Mount the provider above every
flag consumer, and memoize the attribute object. If identity loads
asynchronously, start with `actorType: 'anonymous'` and apply the authenticated
attributes when they become available:

```tsx
<FeatureFlagProvider config={browserConfig} attributes={attributes}>
  <App />
</FeatureFlagProvider>
```

`packages/feature-flags/src/react.tsx:FeatureFlagProvider` creates one client
per provider mount, applies new attributes through the browser adapter's
sanitizer without recreating it, and dedupes initialization under React Strict
Mode. It loads the feature payload once; a flag change is picked up on the next
provider mount or page reload. Missing configuration initializes an empty
payload without a network request and emits a credential-free browser warning.
Failed SDK initialization emits the same class of safe warning while retaining
false fallbacks. The browser adapter disables GrowthBook auto-experiments,
visual changes, JavaScript injection, and URL redirects; this foundation
evaluates feature flags only.

All five deployed Next.js images are build-time ready for browser adoption:
`auth`, `chat`, `frontend-control`, `frontend-manage`, and `frontend-pwa`
(including the assessment build). Their Dockerfiles accept the two GrowthBook
variables above, and their staging/production workflows pass environment-specific
GitHub Actions repository variables:

| Deployment | Public SDK host variable              | Public SDK client-key variable          |
| ---------- | ------------------------------------- | --------------------------------------- |
| staging    | `NEXT_PUBLIC_GROWTHBOOK_API_HOST_STG` | `NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY_STG` |
| production | `NEXT_PUBLIC_GROWTHBOOK_API_HOST_PRD` | `NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY_PRD` |

Configure these as GitHub Actions **variables**, not secrets. They are
non-sensitive SDK connection values that Next.js embeds into public browser
assets; GitHub documents variables as the store for non-sensitive configuration
and warns that they are not masked. Missing variables still produce a valid
image, but the browser adapter performs no SDK request and keeps flags off.

Manage registers these variables in `turbo.json` and supplies the provider from
its application root. Its Playwright fixture intercepts only the external SDK
response so feature states remain deterministic while the real Klicker
authentication, API, and database are exercised.

## Node.js adoption

The adopting service maps server-only variables into one process-level client:

- `GROWTHBOOK_API_HOST`: cluster-internal GrowthBook SDK service;
- `GROWTHBOOK_CLIENT_KEY`: environment-specific server SDK key;
- `GROWTHBOOK_ENV`: server deployment environment.

```ts
const flags = new NodeFeatureFlagClient({
  apiHost: process.env.GROWTHBOOK_API_HOST,
  clientKey: process.env.GROWTHBOOK_CLIENT_KEY,
  environment: process.env.GROWTHBOOK_ENV ?? process.env.NODE_ENV,
})
await flags.initialize()
flags.isEnabled(featureKey, requestAttributes)
```

`packages/feature-flags/src/node.ts:NodeFeatureFlagClient` keeps the downloaded
feature payload on the process client while passing the request-local
`FeatureFlagAttributes` as `attributes` to every evaluation. The adapter filters
unknown fields before calling GrowthBook, so direct identifiers cannot cross the
boundary even when a JavaScript caller supplies a wider object. Never mutate
global attributes with the current user. Call `getStatus()` from a readiness
probe and `refresh()` from an intentional lifecycle or refresh hook if the
service needs new definitions without restarting. A refresh marks the client
healthy only after GrowthBook reports a successful payload update and retains the
previous payload when a refresh fails.

The `NODE_ENV` fallback covers local development and tests. It must not be used
to distinguish staging from production because both normally run with
`NODE_ENV=production`. An adopting service must register `GROWTHBOOK_ENV` in
`turbo.json`.

The v3 chart makes the Kubernetes-deployed Node workloads configuration-ready:

- `GROWTHBOOK_ENV` comes from `global.deploymentEnvironment`; the checked-in
  environment values set it to `staging` or `production`.
- backend GraphQL, OLAT API, LTI, both response APIs, and all three Hatchet
  worker Deployments optionally import
  `<rendered-chart-fullname>-secret-growthbook`.
- that externally provisioned Secret contains exactly
  `GROWTHBOOK_API_HOST` (the reachable internal SDK/proxy endpoint) and
  `GROWTHBOOK_CLIENT_KEY` (the environment's server SDK connection key).

The Secret is deliberately optional at the Kubernetes reference boundary.
This matches the adapter's fail-closed contract and lets the chart render and
pods start before an environment is provisioned. Provision or update it before
enabling the first backend flag, then restart the affected workloads so
environment-variable values are re-read. Secrets remain external to this
public repository; never add their values to Helm files or documentation.

Auth and Chat receive the public browser configuration only. If either hybrid
Next.js app later evaluates a server-side flag, add the shared GrowthBook Secret
to that Deployment in the same change that initializes the Node adapter.

## Management API readiness

SDK evaluation and GrowthBook administration use separate trust boundaries. A
future Klicker administration surface may use GrowthBook's REST API to create a
draft feature revision, change a rule, or publish an approved revision. The v3
chart reserves these server-only variables for that integration:

- `GROWTHBOOK_MANAGEMENT_API_URL`: GrowthBook REST API base URL, including the
  `/api` path where applicable;
- `GROWTHBOOK_MANAGEMENT_API_KEY`: write-capable GrowthBook Personal Access
  Token or Secret Access Token sent as a bearer credential.

The primary backend GraphQL Deployment optionally imports those exact keys from
`<rendered-chart-fullname>-secret-growthbook-management`. It is the only
workload with the management Secret because a future Manage UI should terminate
at an authenticated GraphQL mutation. Evaluator-only APIs and workers continue
to receive only the read-only SDK connection. The management variables are
registered with Turborepo but have no consumer yet; the Secret may remain absent
until an administration feature is implemented.

Never pass the management key to `NodeFeatureFlagClient`, a frontend image
build, or a `NEXT_PUBLIC_*` variable. A future consumer must use GrowthBook's
draft/revision and publish workflow, enforce an explicit Klicker administrative
authorization scope, record an audit trail, and handle retries without making a
student-facing domain mutation depend on GrowthBook availability. If another
workload becomes the control-plane owner, mount the management Secret there in
the same reviewed change rather than broadening it preemptively.

## Failure and rollout behavior

- Missing host or client key performs no fetch and evaluates boolean flags
  false.
- An invalid non-empty environment performs no fetch and evaluates boolean
  flags false, even if the remote definition would match the actor or default
  to true.
- Network or unusable-payload initialization leaves unavailable flags false;
  GrowthBook keeps a usable cached payload when one exists, while a missing or
  unusable cache stays on the false fallback.
- `initialize()` reports whether the SDK loaded successfully; application
  startup must not depend on a true result.
- Feature definitions and targeting rules are managed in GrowthBook. Ordinary
  SDK evaluation never uses the optional management API key; only a future,
  explicitly authorized control-plane integration may do so.
- Remote evaluation is the upgrade path when a future flag's rules or
  attributes are too sensitive for browser evaluation.

## Adding a flag

1. Add the exact GrowthBook key to `FEATURE_FLAG_DEFAULTS` with the value
   `false`, then update the contract test. The registry is typed
   `satisfies Record<string, false>` because evaluation resolves an unavailable
   flag through GrowthBook's own fallback rather than through this object; a
   `true` here would describe a fallback that never takes effect. A flag that
   genuinely needs to default on must switch the evaluation path to
   `getFeatureValue`/`useFeatureValue` first.
2. Create the corresponding feature in each GrowthBook environment.
3. Add the package dependency and environment variables only to consumers of
   the flag.
4. Map the authenticated actor to `FeatureFlagAttributes` once at the app or
   request boundary; adapters add their normalized deployment environment.
5. Cover fallback, enabled, disabled, and per-user targeting where relevant.
6. Document whether the flag hides, disables, or changes behavior and reiterate
   that it is not an authorization boundary.

## Deployment setup checklist

1. Create one browser SDK connection and one server SDK connection for each
   GrowthBook deployment environment. Record their SDK client keys (`sdk-*`)
   separately from any management credential.
2. Add the four public values in the GitHub repository settings using the exact
   variable names in the browser table above.
3. Provision the shared external Kubernetes Secret in staging and production
   with the two exact Node keys documented above. Resolve its final name by
   rendering the chart for that environment; do not guess the Helm fullname.
4. If a GrowthBook administration feature is introduced, provision the separate
   management Secret with the exact URL/key names documented above. Prefer a
   narrowly scoped Personal Access Token and do not add these keys to the shared
   evaluator Secret.
5. Confirm the public GrowthBook endpoint allows the real Klicker browser
   origins and the internal endpoint is reachable from the target namespace.
6. Build/deploy with no active flag first. Inspect a frontend bundle/runtime
   request and a backend pod's variable names without printing credential
   values, then enable the first flag in staging.

GitHub reference: [Variables](https://docs.github.com/en/actions/concepts/workflows-and-actions/variables).

The architectural rationale is recorded in
[ADR 0008](./adr/0008-use-growthbook-for-feature-flags.md).
