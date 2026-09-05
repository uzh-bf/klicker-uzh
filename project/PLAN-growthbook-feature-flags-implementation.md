# GrowthBook Feature Flags Implementation Plan

> **For agentic workers:** Execute this plan inline, task by task, and update
> the checkboxes and progress log after each verification cycle. This repository
> prohibits Superpowers skills; use the native Klicker skills named below.

**Goal:** Ship two native stacked draft PRs: a reusable, typed GrowthBook
foundation for browser and Node.js consumers, followed by a lecturer learning-
analytics example.

**Architecture:** A new `@klicker-uzh/feature-flags` package owns the feature
registry, targeting attributes, React provider, and process-level Node client.
The foundation layer has no runtime consumer; the second layer initializes the
React adapter only inside authenticated `frontend-manage` layouts and replaces
the legacy `publicPreview` analytics checks.

**Tech Stack:** TypeScript 6, React 19, Next.js 16 Pages Router, GrowthBook JS
and React SDK 1.6.5, Vitest 3, Playwright, pnpm 11, Turborepo, native `gh stack`.

## Global Constraints

- Stack bottom: `feat/growthbook-foundation` → `v3`.
- Stack top: `feat/growthbook-learning-analytics` →
  `feat/growthbook-foundation`.
- Pin `@growthbook/growthbook` and `@growthbook/growthbook-react` to `1.6.5`.
- Never expose a GrowthBook management/admin key to a browser.
- Use Klicker `User.id`/`Participant.id`, never email, for per-user targeting.
- Feature flags control rollout, never authentication or authorization.
- Missing configuration, an invalid non-empty deployment environment, or an
  unusable feature payload evaluates boolean flags to their application
  fallback (`false` for learning analytics).
- Do not initialize GrowthBook in an app until that app consumes a flag.
- Do not remove the Prisma or public GraphQL `publicPreview` field in this
  stack; only remove it from `QUserProfile` after its last frontend consumer is
  gone.
- Keep `privatePreview` behavior unchanged.
- No Prisma migration, seed, i18n, gamification, or Hatchet changes.
- Use `apply_patch` for source edits, `pnpm` for dependencies, Biome/Prettier for
  formatting, and browser verification for the UI layer.

---

## File map

### Layer 1 — foundation

- `packages/feature-flags/package.json` — package exports and pinned SDK deps.
- `packages/feature-flags/tsconfig.json` — ESM declaration build for core,
  browser, React, and Node modules.
- `packages/feature-flags/tsconfig.test.json` — no-emit type-check for tests and
  Vitest configuration.
- `packages/feature-flags/vitest.config.ts` — isolated Node test runner.
- `packages/feature-flags/src/contracts.ts` — flag registry, strict keys,
  actor-attribute values and environment normalization.
- `packages/feature-flags/src/index.ts` — core public entry point.
- `packages/feature-flags/src/browserClient.ts` — internal GrowthBook browser
  instance factory used by the React adapter and unit tests.
- `packages/feature-flags/src/react.tsx` — public React provider and typed
  boolean hook.
- `packages/feature-flags/src/node.ts` — public singleton-friendly Node adapter
  with request-scoped attributes.
- `packages/feature-flags/test/contracts.test.ts` — core contract tests.
- `packages/feature-flags/test/browserClient.test.ts` — browser SDK adapter
  tests with mocked SDK HTTP responses.
- `packages/feature-flags/test/node.test.ts` — Node SDK fallback, targeting, and
  request-isolation tests.
- `docs/feature-flags.md` — adoption and operations guide.
- `docs/adr/0008-use-growthbook-for-feature-flags.md` — architecture decision.
- `docs/adr/README.md`, `docs/index.md` — wiki navigation.
- `docs/log/2026-08-06-growthbook-foundation.md` — wiki change record.
- `pnpm-lock.yaml` — pinned dependency resolution.

### Layer 2 — learning analytics

- `packages/feature-flags/src/contracts.ts` — register
  `learning-analytics: boolean` with fallback `false`.
- `packages/feature-flags/test/contracts.test.ts` — registry regression test.
- `apps/frontend-manage/src/components/featureFlags/ManageFeatureFlagProvider.tsx`
  — map the authenticated lecturer profile into shared attributes and the
  deployment environment into client configuration.
- `apps/frontend-manage/src/components/Layout.tsx` — activate the provider only
  after `UserProfileDocument` succeeds.
- `apps/frontend-manage/src/components/common/Header.tsx` — always render the
  analytics navigation and disable it from GrowthBook.
- `apps/frontend-manage/src/components/courses/CourseOverviewHeader.tsx` —
  always render and disable the course analytics button.
- `apps/frontend-manage/src/components/evaluation/navigation/EvaluationNavigation.tsx`
  — always render and disable asynchronous analytics.
- `apps/frontend-manage/src/components/activities/overview/PracticeQuizActions.tsx`
  and `MicrolearningActions.tsx` — stop filtering analytics actions by
  `publicPreview`.
- `apps/frontend-manage/src/components/activities/actions/usePracticeQuizActions.ts`
  and `useMicroLearningActions.ts` — attach the GrowthBook disabled state.
- `apps/frontend-manage/src/components/activities/overview/ActivityActions.tsx`
  — forward `ActivityAction.disabled` into dropdown items.
- `apps/frontend-manage/package.json`, `turbo.json`,
  `util/_with_local_test_origins.sh`, `pnpm-lock.yaml` — workspace dependency
  and build/test configuration.
- `packages/graphql/src/graphql/ops/QUserProfile.graphql` plus generated ops —
  remove the unused query selection and regenerate.
- `playwright/util/fixtures/manage.ts`,
  `playwright/tests/B-feature-access.spec.ts` — deterministic SDK payloads and
  enabled/disabled assertions.
- `docs/frontend-conventions.md`, `docs/feature-flags.md`,
  `docs/log/2026-08-06-growthbook-learning-analytics.md` — behavior docs.

---

### Task 1: Scaffold the shared package and core contract

**Files:**

- Create: `packages/feature-flags/package.json`
- Create: `packages/feature-flags/tsconfig.json`
- Create: `packages/feature-flags/vitest.config.ts`
- Create: `packages/feature-flags/src/contracts.ts`
- Create: `packages/feature-flags/src/index.ts`
- Create: `packages/feature-flags/test/contracts.test.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Produces `FeatureFlagAttributes`, `FeatureFlagEnvironment`,
  `KlickerFeatureFlags`, `FeatureFlagKey`, `BooleanFeatureFlagKey<T>`,
  `FEATURE_FLAG_DEFAULTS`, and `normalizeFeatureFlagEnvironment()`.
- Layer 1 intentionally produces `FeatureFlagKey = never`; layer 2 adds the
  first product key.

- [x] **Step 1: Write the core contract test before the implementation**

```ts
import {
  FEATURE_FLAG_DEFAULTS,
  normalizeFeatureFlagEnvironment,
} from '../src/index.js'

describe('feature flag contracts', () => {
  it('starts without active product flags', () => {
    expect(FEATURE_FLAG_DEFAULTS).toEqual({})
  })

  it.each([
    ['production', 'production'],
    ['staging', 'staging'],
    ['test', 'test'],
    ['development', 'development'],
    [undefined, 'development'],
    ['', 'development'],
  ] as const)('normalizes %s to %s', (input, expected) => {
    expect(normalizeFeatureFlagEnvironment(input)).toBe(expected)
  })

  it.each(['unexpected', 'prod', 'Production', 'stg'])(
    'refuses to map the unrecognized environment %s onto a real one',
    (input) => {
      expect(normalizeFeatureFlagEnvironment(input)).toBe('unknown')
    }
  )
})
```

- [x] **Step 2: Run the package test and verify the red state**

Run: `pnpm --filter @klicker-uzh/feature-flags test`

Expected: failure because the package and exports do not exist.

- [x] **Step 3: Add the package manifest and TypeScript/Vitest configuration**

Use exact GrowthBook versions and subpath exports:

```json
{
  "name": "@klicker-uzh/feature-flags",
  "version": "3.1.0",
  "license": "AGPL-3.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./react": { "types": "./dist/react.d.ts", "default": "./dist/react.js" },
    "./node": { "types": "./dist/node.d.ts", "default": "./dist/node.js" }
  },
  "dependencies": {
    "@growthbook/growthbook": "1.6.5",
    "@growthbook/growthbook-react": "1.6.5"
  },
  "devDependencies": {
    "@types/node": "^24.10.1",
    "@types/react": "^19.2.17",
    "typescript": "~6.0.3",
    "vitest": "~3.2.4"
  },
  "peerDependencies": { "react": "^19.2.7" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "build:test": "pnpm run build",
    "check": "tsc --noEmit --tsBuildInfoFile dist/tsconfig.check.tsbuildinfo -p tsconfig.json && tsc --noEmit -p tsconfig.test.json",
    "dev": "tsc -w -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "engines": { "node": "=24" },
  "volta": { "extends": "../../package.json" }
}
```

The `tsconfig.json` must use NodeNext ESM, `rootDir: "src"`, `outDir: "dist"`,
declarations/source maps, strict mode, `jsx: "react-jsx"`, and
`lib: ["es2022", "dom", "dom.iterable"]`. The Vitest config mirrors
`packages/util/vitest.config.ts` with one Node fork.

- [x] **Step 4: Implement the core contract**

```ts
export const FEATURE_FLAG_DEFAULTS = {} as const

export type KlickerFeatureFlags = {
  [Key in keyof typeof FEATURE_FLAG_DEFAULTS]: boolean
}

export type FeatureFlagKey = Extract<keyof KlickerFeatureFlags, string>

export type BooleanFeatureFlagKey<Features extends Record<string, unknown>> =
  Extract<
    {
      [Key in keyof Features]: Features[Key] extends boolean ? Key : never
    }[keyof Features],
    string
  >

export type FeatureFlagEnvironment =
  | 'development'
  | 'test'
  | 'staging'
  | 'production'
  | 'unknown'

export type FeatureFlagAttributes = {
  id?: string
  actorType: 'user' | 'participant' | 'anonymous'
  role?: string
}

export type FeatureFlagEvaluationAttributes = FeatureFlagAttributes & {
  environment: FeatureFlagEnvironment
}

export function sanitizeFeatureFlagAttributes(
  attributes: unknown,
  environment: FeatureFlagEnvironment
): FeatureFlagEvaluationAttributes {
  const source =
    typeof attributes === 'object' && attributes !== null
      ? (attributes as Record<string, unknown>)
      : {}
  const actorType =
    source.actorType === 'user' ||
    source.actorType === 'participant' ||
    source.actorType === 'anonymous'
      ? source.actorType
      : 'anonymous'
  const sanitized: FeatureFlagEvaluationAttributes = {
    actorType,
    environment,
  }

  if (typeof source.id === 'string') sanitized.id = source.id
  if (typeof source.role === 'string') sanitized.role = source.role

  return sanitized
}

export function normalizeFeatureFlagEnvironment(
  value?: string
): FeatureFlagEnvironment {
  if (
    value === 'production' ||
    value === 'staging' ||
    value === 'test' ||
    value === 'development'
  ) {
    return value
  }

  if (value === undefined || value === '') {
    return 'development'
  }

  console.error(
    `[feature-flags] unrecognized environment "${value}"; disabling feature flag evaluation`
  )

  return 'unknown'
}
```

`src/index.ts` re-exports `./contracts.js` only.

- [x] **Step 5: Install and verify the green state**

Run: `pnpm install`

Run: `pnpm --filter @klicker-uzh/feature-flags test`

Run: `pnpm --filter @klicker-uzh/feature-flags check`

Expected: contract tests and both production and test type-checks pass;
`pnpm-lock.yaml` contains exact GrowthBook 1.6.5 resolutions.

- [x] **Step 6: Format and commit the core package**

```bash
pnpm exec biome check --write packages/feature-flags
git add packages/feature-flags pnpm-lock.yaml
git commit -m "feat(feature-flags): add shared contracts"
```

---

### Task 2: Add the concurrency-safe Node adapter

**Files:**

- Create: `packages/feature-flags/src/node.ts`
- Create: `packages/feature-flags/test/node.test.ts`

**Interfaces:**

- Consumes `FeatureFlagAttributes`, `KlickerFeatureFlags`, and
  `BooleanFeatureFlagKey<T>` from Task 1.
- Produces `NodeFeatureFlagClient<T>`, `NodeFeatureFlagClientConfig`,
  `initialize(): Promise<boolean>`, `isEnabled(key, attributes): boolean`, and
  `refresh(): Promise<void>`.

- [x] **Step 1: Write failing Node adapter tests**

Use a local test feature map and mock `fetch` with this payload:

```ts
type TestFeatures = { 'targeted-flag': boolean }

const payload = {
  features: {
    'targeted-flag': {
      defaultValue: false,
      rules: [{ condition: { id: 'enabled-user' }, force: true }],
    },
  },
}
```

The tests must assert:

```ts
const client = new NodeFeatureFlagClient<TestFeatures>({
  apiHost: 'https://growthbook.test',
  clientKey: 'sdk-test',
  environment: 'test',
})

expect(await client.initialize()).toBe(true)
expect(client.isEnabled('targeted-flag', enabledAttributes)).toBe(true)
expect(client.isEnabled('targeted-flag', disabledAttributes)).toBe(false)
expect(client.isEnabled('targeted-flag', enabledAttributes)).toBe(true)
```

Also construct the client with `{ environment: 'test' }` and assert
`initialize()` and every flag evaluation return `false` without calling
`fetch`. With a complete host/key but `environment: 'prod'`, assert the same
no-fetch, false result for both an id-targeted flag and a remote default-on flag.

- [x] **Step 2: Run the Node tests and verify the red state**

Run: `pnpm --filter @klicker-uzh/feature-flags test -- node.test.ts`

Expected: failure because `NodeFeatureFlagClient` is not exported.

- [x] **Step 3: Implement the Node adapter around `GrowthBookClient`**

```ts
export type NodeFeatureFlagClientConfig = {
  apiHost?: string
  clientKey?: string
  environment: string | undefined
  timeoutMs?: number
}

export class NodeFeatureFlagClient<
  Features extends Record<string, unknown> = KlickerFeatureFlags,
> {
  private readonly configured: boolean
  private readonly client: GrowthBookClient<Features>
  private readonly environment: FeatureFlagEnvironment
  private readonly timeoutMs: number
  private initializationPromise: Promise<boolean> | undefined
  private initialized = false
  private healthy = false

  constructor(config: NodeFeatureFlagClientConfig) {
    this.environment = normalizeFeatureFlagEnvironment(config.environment)
    this.configured = Boolean(
      this.environment !== 'unknown' && config.apiHost && config.clientKey
    )
    this.timeoutMs = config.timeoutMs ?? 2000
    this.client = new GrowthBookClient<Features>(
      this.configured
        ? {
            apiHost: config.apiHost,
            clientKey: config.clientKey,
          }
        : undefined
    )

    if (!this.configured) {
      this.client.initSync({ payload: { features: {} } })
    }
  }

  async initialize(): Promise<boolean> {
    if (!this.configured) return false

    if (!this.initializationPromise) {
      this.initializationPromise = this.client
        .init({ timeout: this.timeoutMs })
        .then((result) => {
          this.initialized = true
          this.healthy = result.success
          return result.success
        })
        .catch(() => {
          this.initialized = true
          this.healthy = false
          return false
        })
    }

    return this.initializationPromise
  }

  isEnabled(
    key: BooleanFeatureFlagKey<Features>,
    attributes: FeatureFlagAttributes
  ): boolean {
    return this.client.isOn(key, {
      attributes: sanitizeFeatureFlagAttributes(attributes, this.environment),
    })
  }

  getStatus() {
    return {
      configured: this.configured,
      environment: this.environment,
      initialized: this.initialized,
      healthy: this.healthy,
    }
  }

  async refresh(): Promise<void> {
    if (!this.configured) {
      return
    }

    const previousPayload = this.client.getPayload()

    try {
      const result = await this.client.init({
        skipCache: true,
        timeout: this.timeoutMs,
      })
      if (result.success) {
        this.healthy = true
        return
      }

      await this.client.setPayload(previousPayload)
      this.healthy = false
      console.warn(
        '[feature-flags] Node refresh failed; retaining the last usable payload'
      )
    } catch (error) {
      await this.client.setPayload(previousPayload)
      this.healthy = false
      console.warn(
        '[feature-flags] Node refresh failed; retaining the last usable payload'
      )
      throw error
    }
  }
}
```

Adjust only SDK result/property typings if the installed 1.6.5 declarations
require it; preserve this public interface and request-scoped user context.

- [x] **Step 4: Run the Node tests and package checks**

Run: `pnpm --filter @klicker-uzh/feature-flags test -- node.test.ts`

Run: `pnpm --filter @klicker-uzh/feature-flags check`

Expected: all pass; alternating users on one singleton retain their own result.

- [x] **Step 5: Commit the Node adapter**

```bash
git add packages/feature-flags/src/node.ts packages/feature-flags/test/node.test.ts
git commit -m "feat(feature-flags): add Node adapter"
```

---

### Task 3: Add the browser client and React adapter

**Files:**

- Create: `packages/feature-flags/src/browserClient.ts`
- Create: `packages/feature-flags/src/react.tsx`
- Create: `packages/feature-flags/test/browserClient.test.ts`

**Interfaces:**

- Produces public `FeatureFlagProvider`, `BrowserFeatureFlagConfig`, and
  `useFeatureFlag(key): boolean` through the `./react` package export.
- Keeps `createBrowserFeatureFlagClient<T>()` internal to the package.

- [x] **Step 1: Write the failing browser-client tests**

Mock the SDK endpoint with the same `targeted-flag` payload as Task 2. Assert
that initialization succeeds, `setAttributes(enabledAttributes)` evaluates
true, `setAttributes(disabledAttributes)` evaluates false, and missing config
initializes an empty payload without a fetch. A complete host/key with an
invalid environment must also avoid fetching and keep both an id-targeted flag
and a remote default-on flag false. A payload containing visual or URL redirect
experiments must not trigger injected JavaScript or redirects.

- [x] **Step 2: Run the browser test and verify the red state**

Run: `pnpm --filter @klicker-uzh/feature-flags test -- browserClient.test.ts`

Expected: failure because the browser client does not exist.

- [x] **Step 3: Implement the internal browser client**

```ts
export type BrowserFeatureFlagConfig = {
  apiHost?: string
  clientKey?: string
  environment: string | undefined
  timeoutMs?: number
}

export function createBrowserFeatureFlagClient<
  Features extends Record<string, unknown>,
>(config: BrowserFeatureFlagConfig) {
  const environment = normalizeFeatureFlagEnvironment(config.environment)
  const configured = Boolean(
    environment !== 'unknown' && config.apiHost && config.clientKey
  )
  const growthbook = new GrowthBook<Features>(
    configured
      ? {
          apiHost: config.apiHost,
          clientKey: config.clientKey,
          disableExperimentsOnLoad: true,
          disableVisualExperiments: true,
          disableJsInjection: true,
          disableUrlRedirectExperiments: true,
          disableCrossOriginUrlRedirectExperiments: true,
        }
      : undefined
  )

  let initializePromise: Promise<boolean> | undefined

  const initialize = (): Promise<boolean> => {
    if (!initializePromise) {
      if (configured) {
        initializePromise = growthbook
          .init({ timeout: config.timeoutMs ?? 2000 })
          .then((result) => {
            if (!result.success) {
              console.warn(
                '[feature-flags] browser initialization failed; using false fallbacks'
              )
            }
            return result.success
          })
          .catch(() => {
            console.warn(
              '[feature-flags] browser initialization failed; using false fallbacks'
            )
            return false
          })
      } else {
        growthbook.initSync({ payload: { features: {} } })
        initializePromise = Promise.resolve(false)
      }
    }

    return initializePromise
  }

  const setAttributes = (attributes: unknown) =>
    growthbook.setAttributes(
      sanitizeFeatureFlagAttributes(attributes, environment)
    )

  return { environment, growthbook, initialize, setAttributes }
}
```

Use the actual 1.6.5 browser init result field (`success`) confirmed by its
declarations. Memoize the initialization promise inside the wrapper so React
Strict Mode does not issue duplicate SDK requests.

- [x] **Step 4: Implement the React provider and typed hook**

```tsx
export function FeatureFlagProvider({
  attributes,
  config,
  children,
}: {
  attributes: FeatureFlagAttributes
  config: BrowserFeatureFlagConfig
  children: ReactNode
}) {
  const [{ growthbook, initialize, setAttributes }] = useState(() =>
    createBrowserFeatureFlagClient<KlickerFeatureFlags>(config)
  )
  const destroyTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )

  useEffect(() => {
    void setAttributes(attributes)
  }, [attributes, setAttributes])

  useEffect(() => {
    if (destroyTimeout.current !== undefined) {
      clearTimeout(destroyTimeout.current)
      destroyTimeout.current = undefined
    }

    void initialize()

    return () => {
      // Let Strict Mode's next setup cancel destruction during its cleanup/setup
      // cycle before releasing the client.
      destroyTimeout.current = setTimeout(() => {
        growthbook.destroy()
        destroyTimeout.current = undefined
      })
    }
  }, [growthbook, initialize])

  return (
    <GrowthBookProvider growthbook={growthbook}>{children}</GrowthBookProvider>
  )
}

export function useFeatureFlag(key: FeatureFlagKey): boolean {
  return useFeatureIsOn(key)
}
```

Ensure `initialize` has stable identity (construct it once with the client) so
the effect does not reinitialize on attribute updates.

- [x] **Step 5: Run all package tests, check, and build**

Run: `pnpm --filter @klicker-uzh/feature-flags test`

Run: `pnpm --filter @klicker-uzh/feature-flags check`

Run: `pnpm --filter @klicker-uzh/feature-flags build`

Expected: all pass and `dist/index.*`, `dist/react.*`, and `dist/node.*` exist.

- [x] **Step 6: Commit the browser and React adapters**

```bash
git add packages/feature-flags/src packages/feature-flags/test
git commit -m "feat(feature-flags): add React adapter"
```

---

### Task 4: Document and verify the foundation layer

**Files:**

- Create: `docs/feature-flags.md`
- Create: `docs/adr/0008-use-growthbook-for-feature-flags.md`
- Create: `docs/log/2026-08-06-growthbook-foundation.md`
- Modify: `docs/adr/README.md`
- Modify: `docs/index.md`
- Modify: `project/PLAN-growthbook-feature-flags.md`
- Modify: `project/PLAN-growthbook-feature-flags-implementation.md`

**Interfaces:** Documents the package entry points, config names, attribute
contract, browser/public and Node/internal connectivity, cache/fallback model,
and adoption checklist.

- [x] **Step 1: Write the wiki and ADR**

The wiki must include these exact adoption examples:

```tsx
<FeatureFlagProvider config={browserConfig} attributes={attributes}>
  <App />
</FeatureFlagProvider>
```

```ts
const flags = new NodeFeatureFlagClient({
  apiHost: process.env.GROWTHBOOK_API_HOST,
  clientKey: process.env.GROWTHBOOK_CLIENT_KEY,
  environment: process.env.GROWTHBOOK_ENV ?? process.env.NODE_ENV,
})
await flags.initialize()
flags.isEnabled(featureKey, requestAttributes)
```

ADR 0008 records direct browser evaluation as the default for UI-only flags,
process-level `GrowthBookClient` plus request attributes for Node, incremental
migration from preview booleans, and remote evaluation as the privacy upgrade.

- [x] **Step 2: Run foundation verification**

```bash
pnpm --filter @klicker-uzh/feature-flags test
pnpm --filter @klicker-uzh/feature-flags check
pnpm --filter @klicker-uzh/feature-flags build
pnpm run check:syncpack
pnpm run format:check
pnpm exec opengrep scan --config auto packages/feature-flags
```

Expected: all package/repo checks pass and Opengrep reports no blocking
finding. Record the exact evidence in the design plan progress log.

- [x] **Step 3: Review the foundation diff and commit docs**

Inspect `git diff v3...HEAD`, verify no app imports the package, then:

```bash
git add docs project/PLAN-growthbook-feature-flags.md project/PLAN-growthbook-feature-flags-implementation.md
git commit -m "docs: document GrowthBook feature flags"
```

---

### Task 5: Create the top stack layer and activate Manage

**Files:**

- Modify: `packages/feature-flags/src/contracts.ts`
- Modify: `packages/feature-flags/test/contracts.test.ts`
- Create: `apps/frontend-manage/src/components/featureFlags/ManageFeatureFlagProvider.tsx`
- Modify: `apps/frontend-manage/src/components/Layout.tsx`
- Modify: `apps/frontend-manage/package.json`
- Modify: `turbo.json`
- Modify: `util/_with_local_test_origins.sh`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Adds strict key `'learning-analytics'` with boolean fallback `false`.
- `ManageFeatureFlagProvider` accepts the non-null result of
  `UserProfileDocument`, supplies `id`, `actorType: 'user'`, and `role` as actor
  attributes, and supplies the deployment environment as client configuration.

- [ ] **Step 1: Create the top branch with native stack metadata**

Run: `gh stack add feat/growthbook-learning-analytics`

Expected: stack view is
`v3 ← feat/growthbook-foundation ← feat/growthbook-learning-analytics`.

- [ ] **Step 2: Change the contract test first**

```ts
it('registers learning analytics as disabled by default', () => {
  expect(FEATURE_FLAG_DEFAULTS).toEqual({ 'learning-analytics': false })
})
```

Run: `pnpm --filter @klicker-uzh/feature-flags test -- contracts.test.ts`

Expected: fail because the registry is still empty.

- [ ] **Step 3: Register the feature and make the test pass**

```ts
export const FEATURE_FLAG_DEFAULTS = {
  'learning-analytics': false,
} as const
```

Run the contract test again; expected PASS.

- [ ] **Step 4: Add deterministic build/test configuration**

Add `@klicker-uzh/feature-flags: "workspace:*"` to Manage. Add all four
GrowthBook variable names to `turbo.json` `globalEnv`:

```json
"GROWTHBOOK_API_HOST",
"GROWTHBOOK_CLIENT_KEY",
"NEXT_PUBLIC_GROWTHBOOK_API_HOST",
"NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY"
```

In `util/_with_local_test_origins.sh`, export:

```bash
export NEXT_PUBLIC_GROWTHBOOK_API_HOST="https://growthbook.test"
export NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY="sdk-test"
```

Run `pnpm install` to synchronize the lockfile.

- [ ] **Step 5: Implement the Manage provider**

```tsx
const config = {
  apiHost: process.env.NEXT_PUBLIC_GROWTHBOOK_API_HOST,
  clientKey: process.env.NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY,
  environment: process.env.NEXT_PUBLIC_ENV ?? process.env.NODE_ENV,
}

function ManageFeatureFlagProvider({ user, children }: Props) {
  const attributes = useMemo<FeatureFlagAttributes>(
    () => ({
      id: user.id,
      actorType: 'user',
      role: user.role,
    }),
    [user.id, user.role]
  )

  return (
    <FeatureFlagProvider config={config} attributes={attributes}>
      {children}
    </FeatureFlagProvider>
  )
}
```

Wrap the authenticated Layout content—not the login/loading/error states—with
this provider.

- [ ] **Step 6: Type-check and commit activation**

Run: `pnpm --filter @klicker-uzh/frontend-manage check`

Expected: PASS with no runtime consumer outside authenticated Manage layout.

```bash
git add packages/feature-flags apps/frontend-manage/package.json apps/frontend-manage/src/components/featureFlags apps/frontend-manage/src/components/Layout.tsx turbo.json util/_with_local_test_origins.sh pnpm-lock.yaml
git commit -m "feat(manage): initialize GrowthBook flags"
```

---

### Task 6: Convert every learning-analytics affordance

**Files:** all UI/action files listed under layer 2 in the file map.

**Interfaces:** Every analytics affordance consumes
`useFeatureFlag('learning-analytics')`; the feature remains present in the DOM
and `disabled` is the only behavior difference.

- [ ] **Step 1: Add a failing Playwright expectation for the disabled state**

Before changing UI, mock a GrowthBook payload with default `false`, log in, and
assert both existing hooks are visible and disabled:

```ts
await expect(page.getByTestId('analytics')).toBeVisible()
await expect(page.getByTestId('analytics')).toBeDisabled()
await expect(page.getByTestId('course-learning-analytics-link')).toBeVisible()
await expect(
  page.getByTestId('course-learning-analytics-link')
).toBeDisabled()
```

Run the feature-access spec; expected failure because `publicPreview` still
hides controls or leaves them enabled.

- [ ] **Step 2: Convert header, course, and evaluation buttons**

In each component, evaluate the hook at the top level:

```ts
const learningAnalyticsEnabled = useFeatureFlag('learning-analytics')
```

Remove `publicPreview` from visibility conditions, keep existing auth/activity
conditions, and add `disabled={!learningAnalyticsEnabled}` to the navigation or
button props. Do not change `onClick` targets.

- [ ] **Step 3: Convert practice and microlearning action menus**

Always include `analyticsPracticeQuiz` and `analyticsMicroLearning` in their
permission maps. In the action hooks, add:

```ts
disabled: !learningAnalyticsEnabled,
```

and include the boolean in the `useMemo` dependency list.

- [ ] **Step 4: Forward disabled dropdown items**

In `ActivityActions.tsx`, preserve the field when mapping actions:

```ts
disabled: action.disabled,
```

The design-system Dropdown already supports per-item `disabled`; do not add a
custom click guard.

- [ ] **Step 5: Run targeted type/lint checks**

```bash
pnpm --filter @klicker-uzh/frontend-manage check
pnpm --filter @klicker-uzh/frontend-manage lint
```

Expected: PASS and `rg -n "publicPreview" apps/frontend-manage/src` returns no
matches. Private-preview management remains unchanged.

- [ ] **Step 6: Commit the UI conversion**

```bash
git add apps/frontend-manage/src/components
git commit -m "feat(manage): gate analytics with GrowthBook"
```

---

### Task 7: Remove the obsolete query selection and complete E2E coverage

**Files:** GraphQL ops/codegen files and Playwright files from the layer-2 map.

**Interfaces:** `QUserProfile` retains `privatePreview` but no longer returns
`publicPreview`. The E2E helper owns an SDK payload interceptor rather than
changing the database public flag.

- [ ] **Step 1: Add the GrowthBook SDK response helper**

```ts
export async function mockGrowthBookLearningAnalytics(
  page: Page,
  enabled: boolean
) {
  await page.route('https://growthbook.test/api/features/sdk-test*', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        features: {
          'learning-analytics': { defaultValue: enabled },
        },
      }),
    })
  )
}
```

Install the route before login/navigation in both enabled and disabled tests.
Keep the private-preview database helper, narrowed to `privatePreview` only.

- [ ] **Step 2: Cover both feature states**

The disabled test asserts all analytics controls are attached and disabled.
The enabled test asserts they are attached and enabled, then opens one safe
analytics entry point. Existing activity-sharing assertions continue to cover
`privatePreview: true` and `false` independently.

- [ ] **Step 3: Remove `publicPreview` from the user-profile operation**

Delete only this selection:

```graphql
publicPreview
```

Run: `pnpm --filter @klicker-uzh/graphql generate`

Expected: generated TypeScript, schema metadata, and persisted-operation maps
change consistently; the public schema still exposes `User.publicPreview`.

- [ ] **Step 4: Run GraphQL, Manage, and Playwright checks**

```bash
pnpm --filter @klicker-uzh/graphql check
pnpm --filter @klicker-uzh/frontend-manage check
pnpm --filter @klicker-uzh/playwright check
pnpm --filter @klicker-uzh/playwright test:run --grep "feature access"
```

Expected: all pass; screenshots/traces show the flag states rather than DB
public-preview states.

- [ ] **Step 5: Commit codegen and E2E coverage**

```bash
git add packages/graphql playwright
git commit -m "test(manage): cover GrowthBook analytics flag"
```

---

### Task 8: Document and visually verify the example layer

**Files:** layer-2 docs/log/plan files plus browser screenshots outside git.

- [ ] **Step 1: Update feature-flag and frontend documentation**

Document `learning-analytics`, default false, `User.id` targeting, disabled UI
semantics, direct-route non-authorization, and the retained-but-unused
`publicPreview` field. Replace the old statement that Klicker intentionally
does not use GrowthBook.

- [ ] **Step 2: Start the real local environment through devrouter**

Run: `devrouter ensure .`

Run the app/test processes inside the resulting container using
`devrouter exec . -- ...`; do not start host-side Next servers.

- [ ] **Step 3: Verify in a browser**

Use `npx agent-browser@0.32.2` against the branch-local Manage URL. Intercept only the
external GrowthBook SDK payload; use the real local Klicker auth, API, and DB.
Capture desktop screenshots for:

1. `learning-analytics=false`: main and course controls visible/disabled.
2. `learning-analytics=true`: controls enabled and analytics navigation opens.

Also inspect one practice-quiz or microlearning action menu in both states.

- [ ] **Step 4: Run final mechanical verification**

```bash
pnpm --filter @klicker-uzh/feature-flags test
pnpm --filter @klicker-uzh/feature-flags check
pnpm --filter @klicker-uzh/graphql check
pnpm --filter @klicker-uzh/frontend-manage check
pnpm --filter @klicker-uzh/frontend-manage lint
pnpm --filter @klicker-uzh/frontend-manage build
pnpm run format:check
pnpm run check:syncpack
pnpm exec opengrep scan --config auto packages/feature-flags apps/frontend-manage/src/components/featureFlags
```

Expected: all pass. Record any environmental limitation separately from code
failures in the plan progress log.

- [ ] **Step 5: Commit docs and verification record**

```bash
git add docs project/PLAN-growthbook-feature-flags.md project/PLAN-growthbook-feature-flags-implementation.md
git commit -m "docs: document analytics GrowthBook rollout"
```

---

### Task 9: Review and publish both draft PRs

**Files:** no source changes unless review finds an actionable defect.

- [ ] **Step 1: Audit each layer independently**

```bash
git diff --check v3...feat/growthbook-foundation
git diff --check feat/growthbook-foundation...feat/growthbook-learning-analytics
gh stack view
```

Verify layer 1 has no app behavior change and layer 2 contains all product/UI
changes. Review every staged/data file for secrets and personal data.

- [ ] **Step 2: Run the maintainability and standards review**

Apply the repository's strict review criteria to both branch tips. Resolve
blocking findings in the owning layer; record deliberately deferred items with
rationale. Do not mark either PR ready or merge it.

- [ ] **Step 3: Submit the native stack as drafts**

Run: `gh stack submit --auto`

Expected: two draft PRs, bottom targeting `v3`, top targeting
`feat/growthbook-foundation`, linked as one GitHub stack.

- [ ] **Step 4: Replace generated PR text with complete branch-aware bodies**

The foundation PR body covers architecture, package API, configuration,
privacy, tests, docs, and the fact that no app initializes it. The example PR
body covers every UI gate, disabled semantics, GraphQL cleanup, E2E evidence,
browser screenshots, retained DB field, and deployment inputs still required.

- [ ] **Step 5: Verify remote state**

Run `gh stack view` and inspect both PR checks, bases, draft state, comments,
and reviews. Report both URLs and any configuration still required before
deployment.

## Progress

- [x] 2026-08-06: approved design committed as `0046b8118` on
  `feat/growthbook-foundation`.
- [x] 2026-08-06: native stack support verified with `gh stack`.
- [x] Layer 1 foundation implemented and verified:
      `pnpm --filter @klicker-uzh/feature-flags test` (27 tests),
      `pnpm --filter @klicker-uzh/feature-flags check`, package build, root
      production build, Syncpack, formatting, and Opengrep (0
      findings) passed. The wiki validator named by the maintenance skill was
      not installed locally.
- [x] 2026-08-17: invalid non-empty deployment environments disable both
      adapters before fetching; id-targeted and remote default-on regression
      cases now fail closed.
- [ ] Layer 2 learning-analytics example implemented and browser-verified.
- [ ] Two draft PRs published and linked as a native stack.
