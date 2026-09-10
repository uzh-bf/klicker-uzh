---
type: Feature Flags
title: Feature Flags
description: Shared GrowthBook contracts, frontend and backend connectivity, targeting attributes, failure behavior, and the adoption checklist.
timestamp: '2026-09-06'
tags:
  - architecture
  - frontend
  - backend
---

# Feature Flags

**Browser and backend consumers share one typed flag registry, but they must not
share one network address.** Browsers need a public HTTPS SDK endpoint with
CORS for the Klicker origin; Node.js services should use an HTTPS endpoint for
GrowthBook's cluster-internal service or proxy. The browser client key
identifies an SDK connection and is not a GrowthBook management key.

The reusable foundation is `@klicker-uzh/feature-flags`. Its registry is
`packages/feature-flags/src/contracts.ts:FEATURE_FLAG_DEFAULTS`, which currently
holds the `ai-beta` and `learning-analytics` product flags. Applications
initialize GrowthBook only when they adopt their first flag.

`ai-beta` is not the whole gate over the lecturer AI surfaces. For Knowledge
Base access and question/graph generation, the account's `aiFeaturesEnabled`
column remains an independent approval gate, and both conditions must hold.
Chatbot authoring is preapproval: it uses the database beta preference and the
`ai-beta` rollout with Catalyst and allowed account scope, without requiring
`aiFeaturesEnabled`. Chatbot publication and model usage still require that
approval — see [Chat platform](./chat-platform.md#auth-guard-pattern-route-handlers).
In `frontend-manage`, `aiFeaturesEnabled` controls the Knowledge Bases and
generation entries while the separate authoring gate can expose the Chatbots
entry before AI approval; each denied route renders a localized unavailable
state instead of redirecting. GraphQL applies the combined flag and approval
gate to every lecturer KB and question/graph-generation entry point. Chatbot
authoring uses the separate beta preference and rollout gate, while publication
and model usage still check `aiFeaturesEnabled`; participant chatbot discovery
and worker-only KB settlement are unaffected.

## Active flags

| Key                  | Consumer                                                | Fallback | Disabled behavior                                                                              |
| -------------------- | ------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| `learning-analytics` | Lecturer UI/Manage                                      | `false`  | Analytics controls remain visible but are not usable                                           |
| `ai-beta`            | Server-side chatbot authoring and account-usage rollout | `false`  | Authoring UI is not mounted; authoring API calls are denied and protected reads return no data |

Beta Features is discoverable in account settings and the first-login dialog
regardless of Catalyst, login scope, or rollout availability. The information
names chatbot creation as a beta feature. Discovery never grants access.

See [Beta preference and rollout ownership](#beta-preference-and-rollout-ownership)
for preference permissions, rollout attributes and the independent AI approval.

Chatbot authoring requires `ai-beta`, Catalyst, and `FULL_ACCESS` or
account-owner scope in both Manage and GraphQL. A denied direct route displays
an explanation and a link to beta settings without mounting authoring queries.

Disabled analytics controls explain that the feature is not yet available for
the current account. This keeps a deliberately staged rollout distinguishable
from a broken control without implying that lecturers can enable it themselves.

### AI capability states

The backend-owned capability for Knowledge Bases, generation, and Manage assistants
has three states. Chatbot authoring keeps its separate upstream gate.

| State                    | Meaning                                                      | Manage behavior                                    |
| ------------------------ | ------------------------------------------------------------ | -------------------------------------------------- |
| `enabled`                | Live database entitlement and `ai-beta` both allow the actor | AI navigation and protected operations are enabled |
| `disabled`               | The entitlement is absent or false, or GrowthBook denies it  | AI navigation is hidden and operations are denied  |
| `temporarilyUnavailable` | Entitlement is true but no usable GrowthBook answer is ready | AI navigation stays visible but disabled; retry    |

The backend reads `User.aiFeaturesEnabled` and `User.betaEnabled` live before
GrowthBook evaluation. Both must be exactly `true`; an absent account, revoked
approval, or beta opt-out denies immediately, including during a payload outage.
Unreadable database state never grants access. The trusted `betaEnabled` value
is included in the sanitized evaluation attributes and the stale-allowance key.

The shared Node adapter gives `ai-beta` a named 15-minute bounded-stale policy
only for the same sanitized actor whose decision was previously validated as
`true` while that payload was fresh. A newly seen actor, newly started process,
missing payload, or expired payload is `temporarilyUnavailable`; a newly
refreshed `false` applies immediately. These actor allowances are process-local,
cleared when the payload is replaced, and never persisted or logged. Generic
`isEnabled` retains its 120-second stale limit, so `learning-analytics` and
other flags and the separate chatbot-authoring gate do not inherit the longer
AI grace. Changing the beta preference invalidates the prior actor allowance.

Manage keeps the last capability only in React memory. It does not persist an
actor identifier or decision, does not poll while healthy, and schedules retries only
while temporarily unavailable with jittered backoff capped at 60 seconds. It
also revalidates on browser focus and when the browser comes online, including
while healthy. Each event can issue one capability request and live account
read; concurrent requests are coalesced within the controller. Authentication
errors stop recovery rather than entering the outage retry loop. Capability
queries do not reuse Apollo cache entries or deduplicated requests across
identity lifetimes. Only the query controller resets; application children
remain mounted while the profile resolves. A recovery
re-enables the existing menu without a full reload. Profile or authentication
failure is treated as an absent identity, so cached profile or capability data
is not presented for the next user and the AI entry remains hidden and fail
closed.

Protected AI operations distinguish the cause of a denial:

| Boundary                                  | Explicit denial                         | Temporary GrowthBook outage          |
| ----------------------------------------- | --------------------------------------- | ------------------------------------ |
| GraphQL AI operations                     | `AI_BETA_ACCESS_REQUIRED`               | `AI_FEATURE_TEMPORARILY_UNAVAILABLE` |
| Chat `/manage` page                       | Existing unavailable/not-found response | Dedicated unavailable page state     |
| Chat `POST /api/manage/chat`              | HTTP `403`                              | HTTP `503` with `Retry-After: 30`    |
| Chat `POST /api/manage/proposals/confirm` | HTTP `403`                              | HTTP `503` with `Retry-After: 30`    |
| Chat `GET /api/manage/capabilities`       | HTTP `403`                              | HTTP `503` with `Retry-After: 30`    |

Manage mounts the browser provider at the application root with anonymous
attributes, then updates it after `QManageFeatureFlagProfile` resolves to target the
authenticated lecturer by stable `User.id`, role, actor type, and environment.
It does not expose the provider as ready until that authenticated identity is
available, so an initially anonymous evaluation cannot unlock a protected
route. If the profile request settles without a usable identity, the provider
marks evaluation unavailable: flag hooks remain false and protected routes
render their unavailable explanation instead of loading indefinitely.
This keeps full-screen routes such as activity evaluations inside the provider.
Public live-quiz evaluation links with an HMAC stay anonymous and skip the
profile lookup so Apollo's Unauthorized handler cannot redirect them to login.
The former `User.publicPreview` field is no longer selected by that operation
and is not authoritative for learning analytics. The Prisma and public GraphQL
fields remain available for other consumers and a later cleanup.

All five `/analytics` pages wait for browser initialization and the current
user attributes before mounting their page queries. A false or unavailable
flag renders the translated unavailable explanation instead. The GraphQL API
independently requires the same flag at every analytics-data service entry
point, in addition to its existing course/activity `READ` permission. This
makes direct URLs and direct GraphQL requests fail closed; browser evaluation
is only the user-experience layer and is never trusted as the data boundary.

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
- `catalyst`: whether the authenticated lecturer currently has Catalyst
  eligibility;
- `betaEnabled`: the trusted database-backed beta preference when evaluating
  the server-side `ai-beta` rollout;
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
they must not carry secrets or authorize data access. A browser flag may change
what is offered in the UI, but the destination route and API must still enforce
their own authentication and resource authorization. A feature entitlement may
additionally be enforced by the backend under
[ADR 0038](./adr/0038-backend-enforced-feature-entitlements.md); a true result
never grants access beyond the existing role, scope, and resource permissions.

## Browser adoption

The adopting app maps these public build variables into the provider config:

- `NEXT_PUBLIC_GROWTHBOOK_API_HOST`: public HTTPS GrowthBook SDK endpoint;
- `NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY`: environment-specific client SDK key.

It must also pass
`process.env.NEXT_PUBLIC_ENV ?? process.env.NODE_ENV` as `environment`.

The app owns environment-variable registration in `turbo.json`; the shared
package itself reads no process environment. Mount the provider above every
flag consumer, and memoize the attribute object. If identity loads
asynchronously, start with `actorType: 'anonymous'`, keep `attributesReady`
false, and apply the authenticated attributes before marking them ready:

```tsx
<FeatureFlagProvider
  config={browserConfig}
  attributes={attributes}
  attributesReady={identityReady}
>
  <App />
</FeatureFlagProvider>
```

`packages/feature-flags/src/react.tsx:FeatureFlagProvider` creates one client
per provider mount, applies new attributes through the browser adapter's
sanitizer without recreating it, and dedupes initialization under React Strict
Mode. `useRefreshFeatureFlags()` bypasses the browser cache after an enrollment
change; otherwise a flag change is picked up on the next provider mount or page
reload. Missing configuration initializes an empty payload without a network
request and emits a credential-free browser warning.
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

### Local beta-preference verification

Use a disposable test database for browser or integration verification. The
local fixture supplies only an SDK payload for `ai-beta`; it does not emulate
enrollment membership, a GrowthBook management API, or a Redis lock. Exercise
the real `User.betaEnabled` read and write through GraphQL and confirm that the
preference persists across a new request or process. Do not run the fixture
against a retained manual database and do not infer database persistence from
an SDK payload alone.

The fixture is test-only and uses synthetic actors and payloads. It must not
provision or validate v3-ai tokens, access a real GrowthBook management
endpoint, or carry approval data. Token provisioning and validation belong to
the v3-ai workflow.

### Server configuration

The adopting service maps server-only variables into one process-level client:

- `GROWTHBOOK_API_HOST`: HTTPS GrowthBook SDK service or proxy reachable from
  the cluster;
- `GROWTHBOOK_CLIENT_KEY`: environment-specific server SDK key;
- `GROWTHBOOK_ENV`: server deployment environment;
- `GROWTHBOOK_REFRESH_INTERVAL_MS`: optional polling override (30 seconds by
  default; tests use 250 ms).

```ts
const flags = new NodeFeatureFlagClient({
  apiHost: process.env.GROWTHBOOK_API_HOST,
  clientKey: process.env.GROWTHBOOK_CLIENT_KEY,
  environment: process.env.GROWTHBOOK_ENV ?? process.env.NODE_ENV,
})
await flags.initialize()
flags.isEnabled(featureKey, requestAttributes)
```

`packages/feature-flags/src/node.ts:NodeFeatureFlagClient` owns the payload
lifecycle so a long-running backend never serves a silently stale definition:
it fetches with an abortable two-second deadline, polls every 30 seconds
(`GROWTHBOOK_REFRESH_INTERVAL_MS` override), deduplicates overlapping refreshes,
and marks the client healthy only after a validated payload update. For generic
boolean evaluation, a payload
becomes unusable 120 seconds after the last successful refresh. The AI-specific
`getAiBetaDecision` may reuse a previously enabled decision for the same actor
and payload generation for at most 15 minutes after the last successful refresh,
provided that decision was earned while the payload was fresh. Otherwise it
reports temporary unavailability. Evaluations fail closed before initialization
and after `destroy()`. A direct client setting of zero disables polling, so it is
only
suitable for consumers that call `refresh()` themselves. The backend requires
`GROWTHBOOK_REFRESH_INTERVAL_MS` to be positive and falls back to 30 seconds
when it is zero or invalid, preventing an unattended startup payload from
expiring permanently. Missing, malformed, non-HTTPS, or query- or
fragment-bearing API hosts are treated as unconfigured and cause no SDK
request, and payload requests reject redirects to avoid transport downgrades.
`getStatus()` reports health, staleness, and the last successful refresh time
without exposing keys or targeting data.
Evaluations stay request-local: the adapter filters unknown attributes before
calling GrowthBook, so direct identifiers cannot cross the boundary even when a
JavaScript caller supplies a wider object. Never mutate global attributes with
the current user.
Entitlement evaluation requires the runtime feature value to be exactly boolean
`true`; truthy strings, numbers, or objects fail closed. When no SDK connection
is configured, `FEATURE_FLAGS_FORCED_ON` can supply registered flags only in
`development` or `test`. Configured clients and staging or production ignore the
override.

The self-contained devcontainer serves its explicit development flags through
`/__growthbook__/api/features/sdk-test`. Manage proxies that endpoint to the
local backend, so browser navigation and server capabilities agree without a
GrowthBook service. The development route is absent in production; test mode
keeps its separate intercepted fixture endpoint. Account beta preferences,
Catalyst eligibility, login scope, and administrative approval still apply.

The `NODE_ENV` fallback covers local development and tests. It must not be used
to distinguish staging from production because both normally run with
`NODE_ENV=production`. An adopting service must register `GROWTHBOOK_ENV` in
`turbo.json`.

The primary backend GraphQL process initializes this client during startup and
injects it into both HTTP and WebSocket contexts, runs the owned polling loop,
and destroys it on process exit. Startup continues after a missing configuration
or unsuccessful initialization, but analytics-data resolvers return `FORBIDDEN`
until `learning-analytics` evaluates true for the authenticated user. The v3
chart makes the Kubernetes-deployed Node workloads configuration-ready:

- `GROWTHBOOK_ENV` comes from `global.deploymentEnvironment`; the checked-in
  environment values set it to `staging` or `production`.
- backend GraphQL, backend assessment, Chat, OLAT API, LTI, both response APIs, and all three Hatchet
  worker Deployments optionally import
  `<rendered-chart-fullname>-secret-growthbook`.
- that externally provisioned Secret contains exactly
  `GROWTHBOOK_API_HOST` (the reachable HTTPS SDK/proxy endpoint) and
  `GROWTHBOOK_CLIENT_KEY` (the environment's server SDK connection key).

The Secret is deliberately optional at the Kubernetes reference boundary.
This matches the adapter's fail-closed contract and lets the chart render and
pods start before an environment is provisioned. Provision or update it before
enabling the first backend flag, then restart the affected workloads so
environment-variable values are re-read. Secrets remain external to this
public repository; never add their values to Helm files or documentation.

Auth receives public browser configuration only. Chat also initializes the
Node adapter and consumes the shared GrowthBook Secret; include its pods when
rotating the server SDK configuration.

## Diagnosing unavailable AI

First distinguish an expired login from an AI dependency failure. An
`Unauthorized` GraphQL response requires login, not a feature-flag retry.
For an authenticated account, verify live beta opt-in and AI approval before
investigating GrowthBook. A closed database gate returns `disabled` without
evaluating the flag.

For `temporarilyUnavailable`, check the values-free backend startup status
(`configured`, `healthy`) and `[feature-flags] payload availability` transition
logs. Verify SDK configuration presence, environment alignment, endpoint
reachability and a boolean `ai-beta` definition without printing keys or
payloads. Capability-query transport and database failures can also cause the
same browser presentation. These checks require access to the affected
environment; a healthy application probe does not prove GrowthBook health.

Grace is process-local and limited to actors evaluated true against the current
fresh payload. Every successful replacement clears allowances. GraphQL and
Chat, or different replicas, can disagree during an outage; the accepting
service's own gate always decides whether an operation runs. The 15-minute
bound is not a guaranteed grace period for every user or every AI surface.
Generic boolean callers, including chatbot authoring, retain their shorter
policy. Do not widen or share grace without a separate authorization decision.

During an outage, changing a flag requires reachable GrowthBook. The live
per-account approval and beta preference remain immediate stop controls on
the next protected request. Source rollback requires rebuilding and deploying
compatible backend, Chat and Manage revisions; merely restarting a floating
image tag does not select an older image. Rollout and rollback are separately
authorized operations, not part of these diagnostic checks.

## Beta preference and rollout ownership

### Separate backend management connection

The primary GraphQL backend retains the optional external
`<rendered-chart-fullname>-secret-growthbook-management` reference for other
backend flag-control use cases. It supplies `GROWTHBOOK_MANAGEMENT_API_URL`
and `GROWTHBOOK_MANAGEMENT_API_KEY`; both remain in `turbo.json` for server
task environment forwarding. This configuration is separate from SDK evaluation.
Never pass the management key to `NodeFeatureFlagClient`, frontend builds, or
`NEXT_PUBLIC_*` variables. Other workloads do not receive this management Secret.
No management API call is introduced here; future writers need their own
authorization and target contracts. Beta preference requires neither variable.

### Database-owned preference

The database owns the personal beta preference. `User.betaEnabled` defaults to
`true`, and the GraphQL enrollment service reads and writes the authenticated
actor's own row. Request-local reuse prevents duplicate reads without turning
the preference into a process-wide cache. See
`packages/prisma/src/prisma/schema/user.prisma:User`,
`packages/graphql/src/services/betaEnrollment.ts:getBetaEnrollment`, and
`packages/graphql/src/lib/featureFlags.ts:getBetaPreference`.

`FULL_ACCESS` and `ACCOUNT_OWNER` sessions may read and edit the preference
through the enrollment capability. That capability returns unknown membership
for weaker scopes without a database read. Catalyst is
required to opt in; full-access opt-out remains possible without Catalyst.
The API's `signupAvailable` field is a Catalyst-eligibility compatibility
signal, not a GrowthBook enrollment switch.

The backend passes the trusted preference to the read-only GrowthBook `ai-beta`
evaluation with the existing stable actor id, `actorType: user`, role, and
Catalyst attributes. The rollout rule must require `betaEnabled: true`,
`catalyst: true`, and `actorType: user`; preserve the environment boundary and
any deliberately narrower role or rollout restrictions. A missing, false, or
unreadable preference fails closed, and a remote force-true result cannot
override a false database value.

This flow does not use a saved group, GrowthBook Management API, management Secret,
`beta-signup` flag, or Redis membership lock. GrowthBook supplies rollout
evaluation only; it does not persist or mutate beta membership. Token
provisioning and validation belong to v3-ai and are outside this contract.

`User.aiFeaturesEnabled` defaults to `false` and remains the sole account
approval gate for Knowledge Base access, question/graph generation, chatbot
publication, and model usage, even when budget enforcement is disabled.
Chatbot authoring is preapproval and may use the beta preference and `ai-beta`
rollout without that approval, but neither grants it. Per-chatbot publication
review and published participant access remain separate and unchanged.

### Transition from saved-group targeting

This is an operator checklist, not authorization to deploy or edit live flags.
No live rule or saved-group contents were verified for this change.

1. Before deployment, record the current rule configuration and check which
   other flags reference the old beta saved group. Keep any targeting identifiers
   in the restricted operator system, not Git or PR comments. Confirm the
   [release approval prerequisites](../project/2026-09-06-v3-release-readiness.md#release-activation-prerequisites),
   including account AI approval; changing `ai-beta` cannot grant it.
2. Deploy the complete migration and application candidate first. Old images
   do not send `betaEnabled`, so switching the rule first can exclude everyone.
   During the interim window, the old rule still selects the rollout cohort,
   but the new backend additionally denies a false or unreadable database
   preference. Default-on preference alone does not broaden the old rule.
3. Verify the new attribute in both Manage and backend evaluation for a synthetic
   eligible lecturer. If the old rule has an eligible canary, prove `ai-beta`
   remains true there; otherwise record the expected false result and require
   a controlled rule-change canary. Then replace only the saved-group membership
   condition with `betaEnabled: true`, retaining `catalyst: true`,
   `actorType: user`, and the intended environment/role/rollout restrictions.
   Prove enabled authoring, opt-out denial, and unchanged participant access
   independently of the owner's beta preference.
4. If verification fails, restore the prior rule configuration while retaining
   the new application and its database opt-out guard. Do not force-enable the
   flag or roll back to a binary that selects the removed approval column.
   Rolling the rule back narrows the cohort but does not undo saved preferences.
5. Once the rollback window closes, the GrowthBook operator checks again for
   other consumers and obtains explicit approval to delete the obsolete group.
   Do not export its personal membership list by default. Any required retention
   needs a separately approved purpose, restricted destination and deletion date.
   Keep the general backend management API configuration for future flag writers.

## Failure and rollout behavior

- Missing host or client key performs no fetch and evaluates boolean flags
  false.
- An invalid non-empty environment performs no fetch and evaluates boolean
  flags false, even if the remote definition would match the actor or default
  to true.
- Network or unusable-payload initialization leaves generic flags false. The
  Node adapter keeps a validated cached payload only within its two-minute
  stale bound for generic evaluation; `getAiBetaDecision` gives only a
  previously enabled `ai-beta` decision the separate 15-minute bound and
  reports `temporarilyUnavailable` outside it.
- A hung Node request is aborted at the adapter deadline and is not retained in
  GrowthBook's shared fetch cache, so the next scheduled refresh can recover.
- Healthy backend definitions refresh every 30 seconds by default. Revocations
  therefore propagate without a pod restart; an outage can extend the old
  decision only until the bounded stale deadline.
- `initialize()` reports whether the SDK loaded successfully; application
  startup must not depend on a true result.
- A backend-enforced flag must be configured in both the browser and backend
  environments with equivalent definitions and targeting attributes. If the
  two evaluations disagree, a backend `false` always denies. A browser `false`
  may still hide the feature when the backend result is true; a backend `true`
  never bypasses existing authentication and resource permissions.
- For `ai-beta`, an explicit backend denial and an unavailable GrowthBook
  decision use separate capability states and public error contracts. Only the
  unavailable state preserves a visible, disabled Manage entry for recovery;
  neither state authorizes a protected operation.
- Feature definitions and targeting rules are managed in GrowthBook. Ordinary
  SDK evaluation never uses the optional management API key; the beta
  preference path uses only the read-only SDK payload and has no management
  credential or enrollment control plane. Only a future, explicitly authorized
  control-plane integration may use that key.
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
6. Document whether the flag hides, disables, changes behavior, or is a
   backend-enforced feature entitlement. Browser evaluation is never an
   authorization boundary; entitlement flags must follow ADR 0038.

## Deployment setup checklist

1. Create one browser SDK connection and one server SDK connection for each
   GrowthBook deployment environment. Record their SDK client keys (`sdk-*`)
   separately from any management credential.
2. Add the four public values in the GitHub repository settings using the exact
   variable names in the browser table above.
3. Provision the shared external Kubernetes Secret in staging and production
   with the two exact Node keys documented above. Resolve its final name by
   rendering the chart for that environment; do not guess the Helm fullname.
4. Do not provision a GrowthBook management Secret for beta preference or
   `ai-beta` rollout. Token provisioning and validation are v3-ai-only concerns
   and are not defined by this feature-flag contract.
5. Confirm the public GrowthBook endpoint allows the real Klicker browser
   origins and the internal endpoint is reachable from the target namespace.
6. Before deploying the AI capability adapter, register `ai-beta` with a boolean
   false default and provision its server SDK connection. Missing configuration
   or an absent feature definition makes opted-in, approved accounts visibly
   unavailable rather than silently hiding AI. Inspect a frontend bundle/runtime
   request and a backend pod's variable names without printing credential
   values, then enable the first flag in staging.

GitHub reference: [Variables](https://docs.github.com/en/actions/concepts/workflows-and-actions/variables).

The architectural rationale is recorded in
[ADR 0008](./adr/0008-use-growthbook-for-feature-flags.md) and
[ADR 0038](./adr/0038-backend-enforced-feature-entitlements.md).
