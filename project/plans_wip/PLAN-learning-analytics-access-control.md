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
  mistake SDK initialization for a disabled result.
- `apps/frontend-manage`: mount a shared guard at the application root for the
  `/analytics` route namespace before page query components mount.
- `playwright`: cover direct navigation when the browser flag is on and off.
- `docs/feature-flags.md`: replace the old affordance-only contract with the
  enforced route/API contract and rollout requirements.

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
  navigation and an enabled flag permits it.
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

- Shared feature-flag package: build, check, and 24 tests passed.
- GraphQL: check and production build passed; all 8 focused access-control
  tests passed, including denial before Prisma access for all four analytics
  service entry points.
- Backend and Manage: checks and production builds passed.
- Playwright: type-check passed and all 10 feature-access tests were discovered,
  including direct-navigation flag-off and flag-on cases.
- Repository `check:all` passed (25 checks and 7 lints).
- Independent review found no backend bypass. Its two medium findings—anonymous
  startup readiness and four-path enforcement evidence—were addressed before
  final verification.
- Runtime browser execution remains for CI: no approved local environment was
  already running, and the local Docker provider was unavailable. No
  environment was started because Devrouter is opt-in.
