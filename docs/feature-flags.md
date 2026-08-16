---
type: Feature Flags
title: Feature Flags
description: Shared GrowthBook contracts, frontend and backend connectivity, targeting attributes, failure behavior, and the adoption checklist.
timestamp: '2026-08-06'
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
`packages/feature-flags/src/contracts.ts:FEATURE_FLAG_DEFAULTS`; the foundation
PR intentionally contains no active product flags and no application imports.
Applications initialize GrowthBook only when they adopt their first flag.

## Package contract

| Import                             | Purpose                                                                |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `@klicker-uzh/feature-flags`       | Strict flag keys, defaults, targeting attributes, environment handling |
| `@klicker-uzh/feature-flags/react` | Browser `FeatureFlagProvider` and typed `useFeatureFlag`               |
| `@klicker-uzh/feature-flags/node`  | Multi-user `NodeFeatureFlagClient` for process-level backend instances |

Both GrowthBook dependencies are pinned to `1.6.5`
(`packages/feature-flags/package.json`). Package tests mock only the SDK HTTP
response and run without Klicker services (**verified 2026-08-06**):

```bash
pnpm --filter @klicker-uzh/feature-flags test
pnpm --filter @klicker-uzh/feature-flags check
pnpm --filter @klicker-uzh/feature-flags build
```

## Targeting attributes

Every evaluation receives the contract from
`packages/feature-flags/src/contracts.ts:FeatureFlagAttributes`:

- `id`: the stable Klicker `User.id` or `Participant.id` when one exists;
- `actorType`: `user`, `participant`, or `anonymous`;
- `role`: the Klicker role when applicable;
- `environment`: `development`, `test`, `staging`, `production`, or `unknown`.

`normalizeFeatureFlagEnvironment` maps an unset value to `development` and any
other unrecognized value to `unknown`, logging it. `unknown` is a name no
GrowthBook environment rule is configured against, so a misspelled deployment
variable leaves every flag on its default rather than picking up the rollout of
whichever tier the typo happens to resemble. The variable that feeds it,
`NEXT_PUBLIC_ENV`, is registered in `turbo.json` `globalEnv` so that changing it
invalidates the Turborepo build cache.

Do not use email addresses or other direct identifiers. Browser attributes and
client-side targeting rules are observable by the person using the browser, so
they must not carry secrets or authorize data access. A flag may change what is
offered in the UI; the destination route and API must still enforce their own
authentication and authorization.

## Browser adoption

The adopting app maps these public build variables into the provider config:

- `NEXT_PUBLIC_GROWTHBOOK_API_HOST`: public HTTPS GrowthBook SDK endpoint;
- `NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY`: environment-specific client SDK key.

The app owns environment-variable registration in `turbo.json`; the shared
package itself reads no process environment. Mount the provider after identity
is known, and memoize the attribute object:

```tsx
<FeatureFlagProvider config={browserConfig} attributes={attributes}>
  <App />
</FeatureFlagProvider>
```

`packages/feature-flags/src/react.tsx:FeatureFlagProvider` creates one client
per provider mount, applies new attributes without recreating it, and dedupes
initialization under React Strict Mode. It loads the feature payload once; a
flag change is picked up on the next provider mount or page reload. Missing
configuration initializes an empty payload without a network request.

## Node.js adoption

The adopting service maps server-only variables into one process-level client:

- `GROWTHBOOK_API_HOST`: cluster-internal GrowthBook SDK service;
- `GROWTHBOOK_CLIENT_KEY`: environment-specific server SDK key.

```ts
const flags = new NodeFeatureFlagClient({
  apiHost: process.env.GROWTHBOOK_API_HOST,
  clientKey: process.env.GROWTHBOOK_CLIENT_KEY,
})
await flags.initialize()
flags.isEnabled(featureKey, requestAttributes)
```

`packages/feature-flags/src/node.ts:NodeFeatureFlagClient` keeps the downloaded
feature payload on the process client while passing attributes as request-local
`userContext` to every evaluation. Never mutate global attributes with the
current user. Call `refresh()` from an intentional lifecycle or refresh hook if
the service needs new definitions without restarting.

## Failure and rollout behavior

- Missing host or client key performs no fetch and evaluates boolean flags
  false.
- Network or unusable-payload initialization leaves unavailable flags false;
  GrowthBook may use its own valid cached payload when one exists.
- `initialize()` reports whether the SDK loaded successfully; application
  startup must not depend on a true result.
- Feature definitions and targeting rules are managed in GrowthBook, not by a
  Klicker management-API key or a database migration.
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
   request boundary.
5. Cover fallback, enabled, disabled, and per-user targeting where relevant.
6. Document whether the flag hides, disables, or changes behavior and reiterate
   that it is not an authorization boundary.

The architectural rationale is recorded in
[ADR 0008](./adr/0008-use-growthbook-for-feature-flags.md).
