# Assessment edu-ID identity review fixes

## Goal

Resolve the six P1–P3 review findings on the assessment edu-ID identity branch
without changing the intended privacy boundary or the meaning of existing V1
credentials.

## Non-goals

- No new Prisma fields, GraphQL operations, or user-visible strings.
- No change to assessment access, authorization, scoring, or gamification.
- No migration of already-issued immutable credentials.
- No merge of either this child PR or its parent.

## Design answers

- **Domain vocabulary:** invitation-roster identity remains the provenance of
  V1 credentials. A V2 credential is issued only from the participant's
  current SWITCH edu-ID-backed email plus the course-scoped assessment
  participation name and matriculation claims.
- **Layer footprint:** participant OIDC configuration in `apps/auth`, a shared
  identity-value normalizer in `packages/util`, assessment snapshot issuance
  in `packages/graphql`, focused Auth/GraphQL/Playwright regression coverage,
  and the existing assessment identity ADR.
- **Auth and privacy:** request the standard OIDC `profile` scope for the name
  claims. Persist claims only on assessment participations. Public verification
  continues to expose name and source only, never email or matriculation number.
- **Gamification / async:** none.
- **UI surface:** no component or copy changes. Browser coverage exercises the
  existing private V2 report and its deliberately smaller public projection.
- **Test evidence:** utility tests for normalization, guarded Prisma-backed Auth
  coverage for assessment-only writes and refreshes, GraphQL service coverage
  for V1/V2 email provenance, and focused Playwright coverage for private and
  public V2 states plus the one-page PDF contract.
- **Seeds / fixtures:** keep deterministic synthetic identities. The assessment
  report fixture keeps participant email different from invitation email so
  provenance regressions are observable.

## Implementation slices

1. Extract one shared normalizer and use it in participant auth and assessment
   snapshot construction; add `profile` to the participant OIDC scope.
2. Build V2 snapshots from the normalized participant email instead of copying
   the V1 invitation email, while preserving V1 behavior.
3. Add Prisma-backed Auth regression coverage for assessment-only persistence,
   missing claims, claim refresh, and newly accepted assessment invitations.
4. Extend the deterministic credential fixture and Playwright assertions to
   cover private V2 and public name-only verification states.
5. Remove the duplicate root `CONTEXT.md`, record the email-provenance contract
   in the existing ADR, and run the repository verification gates.

## Progress

- **2026-08-21:** Created the child branch from PR #5452 head
  `07b847cefd0b1b73051efabf93bacd2fc9120af5`; confirmed current NextAuth v4
  provider configuration supports `authorization.params.scope` and custom
  profile callbacks after requesting the required scopes.
- **2026-08-21:** Implemented all six review fixes: requested `profile`, kept
  V1 invitation provenance intact, sourced V2 email from the participant's
  current normalized edu-ID email with fail-closed behavior, extracted the
  shared normalizer, added Prisma-backed Auth and GraphQL regressions, added
  private/public V2 browser coverage, removed the duplicate root context file,
  and updated ADR 0008.
- **2026-08-21:** Verification passed for 49 util tests, the Auth Prisma adapter
  and assessment-identity persistence smoke, 32 focused GraphQL verification
  tests, the Playwright workspace typecheck, the focused Chromium V2 scenario,
  the direct `agent-browser` public-projection check, and `pnpm run check:all`.
  Two root production-build attempts completed the changed util, GraphQL, Auth,
  backend, and PWA compile phases but could not return a trustworthy root exit
  code because the shared Docker VM became control-plane and I/O saturated by
  concurrent work; both attempts were stopped without changing tracked files.
