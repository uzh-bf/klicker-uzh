# Learning Analytics Access Control

## Goal

Treat the `learning-analytics` GrowthBook flag as an entitlement for the
learning-analytics surface, not only as a control-visibility hint. A lecturer
whose flag evaluates to `false` must not be able to use a direct URL or a
direct GraphQL request to read analytics data.

## Domain and authorization contract

- Actor: authenticated Klicker `User` (lecturer-side account).
- Resource authorization remains unchanged: the actor still needs the
  existing `READ` permission for the requested course, practice quiz, or
  microlearning.
- Feature entitlement is an additional requirement. The backend evaluates the
  same `learning-analytics` flag with the authenticated user's stable ID,
  actor type, role, and deployment environment.
- Missing configuration, an invalid environment, initialization failure, a
  missing evaluator in context, or a false result all deny analytics access.
- Denial happens at every analytics service entry point before analytics data
  is accessed and returns a generic GraphQL `FORBIDDEN` error without exposing
  targeting rules.
- Generic course and activity list queries remain governed only by their
  existing permissions because they are shared data, not analytics results.

## Affected layers

- `apps/backend-docker`: create and initialize one process-level GrowthBook
  Node client and inject it into HTTP and WebSocket GraphQL contexts.
- `packages/graphql`: define the evaluator context contract, centralize the
  fail-closed entitlement check, and apply it to all analytics-data queries.
- `packages/feature-flags`: expose provider readiness so route guards do not
  mistake SDK initialization for a disabled result; give the Node adapter an
  abortable polling lifecycle and bounded stale-payload policy.
- `apps/frontend-manage`: mount a shared guard at the application root for the
  `/analytics` route namespace before page query components mount.
- `playwright`: cover direct navigation when the browser flag is on and off and
  a real persisted GraphQL denial when the backend entitlement is false.
- `docs/feature-flags.md`: replace the old affordance-only contract with the
  enforced route/API contract and rollout requirements.
- `docs/adr`: record the narrowly scoped backend-entitlement exception to the
  original presentation-only GrowthBook decision.

## User experience

- While the browser SDK initializes, the route displays the normal analytics
  layout with a loader.
- When disabled or unavailable, the route displays the existing translated
  learning-analytics-unavailable explanation and mounts no page query.
- When enabled, the existing analytics page renders unchanged.
- Existing visible-but-disabled controls and their explanations remain.

## Non-goals

- No database schema, migration, durable state, gamification, or participant
  behavior changes.
- No GrowthBook management API use and no write-capable API key.
- No change to existing course/activity permissions.
- No attempt to conceal public SDK connection values or browser-side flag
  evaluation.

## Verification

- Unit-test the fail-closed evaluator behavior and type-check the shared
  provider-readiness contract; exercise readiness through the route E2E.
- Run focused feature-flag and GraphQL tests and package type checks/builds.
- Add Playwright coverage proving a disabled flag blocks direct analytics
  navigation, a profile failure settles to unavailable, and an enabled flag
  permits a protected analytics-data request through the backend evaluator;
  independently prove the backend denies a persisted request when disabled.
- Unit-test hung-request recovery, scheduled refresh, revocation propagation,
  bounded staleness, and teardown for the Node adapter.
- Run repository formatting/lint checks for changed files.
- Exercise the route in a browser with deterministic GrowthBook responses if
  an already-running approved local environment is available; otherwise record
  the runtime verification gap and rely on the deterministic Playwright CI job.

## Progress

- [x] Confirm the original GrowthBook foundation PR is merged into `v3`.
- [x] Trace all five analytics routes and analytics-data GraphQL resolvers.
- [x] Implement the backend entitlement boundary.
- [x] Implement provider readiness and the frontend route guard.
- [x] Add focused automated coverage and update documentation.
- [x] Complete verification and independent review.

## Verification evidence

- Shared feature-flag package: build, check, and 53 tests passed, including
  strict boolean-only entitlement evaluation, abortable hung-request recovery,
  scheduled revocation refresh, bounded stale denial, and teardown.
- GraphQL: check and production build passed; all 16 focused access-control
  and AI-gate tests passed, including denial before Prisma access for all four
  analytics service entry points.
- Backend and Manage: checks and production builds passed.
- Playwright: type-check passed and all 12 feature-access tests were discovered,
  including direct-navigation flag-off, flag-on, backend-denied, and
  profile-failure cases.
- The deterministic backend GrowthBook fixture returned the expected targeted
  payload and switched its synthetic definition between enabled and disabled.
- Repository `check:all` passed (29 checks and 7 lints).
- The feature-related production builds passed. The root build completed 23
  tasks before the sandbox blocked Chat's internal Turbopack port and canceled
  the remaining tasks; the Chat production build passed when rerun with the
  required process and port permissions.
- The final independent security/readiness review found no remaining
  actionable issue after strict value checks, deterministic backend-decision
  polling, attribute-failure settling, and documentation corrections.
- Full GraphQL and browser runtime execution remain for CI. The isolated local
  GraphQL/Playwright stacks bind ports already owned by unrelated active
  Devrouter environments, and those environments were left untouched.
