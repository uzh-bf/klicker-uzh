# Authentication and Cookies

Cross-cutting auth pattern combining NextAuth (for lecturer/participant sessions) with additional JWT cookies used for live quiz participation and response ingestion.

## Concept

- `[[Auth]]` is the central authentication hub; other apps redirect here to establish sessions.
- NextAuth runs in two “contexts” with different providers and cookie names (lecturer vs participant).
- Other system entry points (notably response ingestion) rely on separate JWT cookies (`participant_token`, `temporary_participant_token`) that are forwarded to workers.

## How it works

- Context detection selects participant vs lecturer config per request:
  - Priority: `?participant=true` → `callbackUrl` host → redirect cookie host → default lecturer.
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/auth/src/lib/helpers.ts`
- Cookie names (NextAuth session cookies):
  - Lecturer: `next-auth.session-token` (`MANAGER_COOKIE_NAME`).
  - Participant: `next-auth.participant-session-token` (`PARTICIPANT_COOKIE_NAME`).
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/auth/src/lib/constants.ts`
- Cookie domain policy:
  - `deriveCookieDomainFromURL(NEXTAUTH_URL)` strips the first hostname label (and returns undefined for localhost/IPs).
  - NextAuth `cookies.sessionToken.options.domain` is set when a derived domain exists.
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/packages/util/src/auth.ts`
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/auth/src/pages/api/auth/[...nextauth].ts`
- Participant NextAuth configuration:
  - Edu-ID OIDC provider when `EDUID_CLIENT_SECRET` is configured.
  - JWT callback sets `role='PARTICIPANT'`, `scope=UserLoginScope.EDUID`, and `sub=<participantId>`.
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/auth/src/pages/api/auth/[...nextauth].ts`
- Lecturer NextAuth configuration:
  - Providers: Edu-ID OIDC (optional) + credentials provider “Delegation” (delegated login).
  - Uses `PrismaAdapter(prisma)` for the NextAuth account model.
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/auth/src/pages/api/auth/[...nextauth].ts`
- Redirect allow-list:
  - Participant redirects validated against `AUTH_STUDENT_ALLOWED_HOSTS` (or defaults).
  - Lecturer redirects validated against `AUTH_LECTURER_ALLOWED_HOSTS` (or defaults).
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/auth/src/lib/helpers.ts`
- Live quiz response identity cookies (non-NextAuth):
  - Response API forwards only `participant_token` and `temporary_participant_token` to Hatchet events.
  - Response processor verifies these JWTs (role `PARTICIPANT` vs `TEMPORARY_PARTICIPANT`) before enabling per-participant dedup + scoring.
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/response-api/src/index.ts`
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/hatchet-worker-response-processor/src/processors/processor.ts`

## Affected workloads

- [[Auth]]
- [[Frontend PWA]]
- [[Frontend PWA - Assessment]]
- [[Frontend Manage]]
- [[Frontend Control]]
- [[Backend GraphQL]]
- [[Response API]]
- [[Response API - Assessment]]
- [[Hatchet Worker - Response Processor]]

## Configuration

- `NEXTAUTH_URL` — origin
- `APP_SECRET` — jwt
- `APP_ORIGIN_AUTH` — jwt-iss
- `AUTH_STUDENT_ALLOWED_HOSTS` — redirect
- `AUTH_LECTURER_ALLOWED_HOSTS` — redirect
- `EDUID_WELL_KNOWN` — oidc
- `EDUID_CLIENT_ID` — oidc
- `EDUID_CLIENT_SECRET` — oidc
- `NEXT_PUBLIC_EDUID_ID` — oidc

## Related docs

- [[01-Assessment vs Non-assessment Split]]
- [[01-Live Quiz - Non-assessment]]
- [[02-Live Quiz - Assessment]]
