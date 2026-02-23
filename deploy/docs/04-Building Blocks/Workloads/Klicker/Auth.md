# Auth

Central authentication hub (Next.js + NextAuth) for Klicker frontends. Provides lecturer and participant login flows and issues the session cookies consumed by the rest of the platform.

## Code

- App: `apps/auth/`
- Entry point (UI): `apps/auth/src/pages/index.tsx`
- NextAuth handler: `apps/auth/src/pages/api/auth/[...nextauth].ts`
- Redirect/host hardening: `apps/auth/src/middleware.ts`
- Student login UI: `apps/auth/src/pages/student.tsx`
- Discourse SSO flow: `apps/auth/src/pages/discourse.tsx`, `apps/auth/src/pages/discourse_handoff.tsx`, `apps/auth/src/pages/api/discourse.ts`

## External interface

- Lecturer login UI: `GET /`
- Participant login UI: `GET /student`
- Logout helper: `GET /logout`
- NextAuth: `/api/auth/*` (notably `/api/auth/[...nextauth]`)
- Discourse SSO:
  - `GET /discourse` (starts login, forwards `sso` + `sig`)
  - `POST /api/discourse` (returns Discourse redirect URL after signing)
  - `GET /discourse_handoff` (client-side handoff)

## Responsibilities

- Provide the default login UI for lecturers (Edu-ID and delegated credentials).
- Provide the dedicated participant login UI for assessment access (`/student`).
- Issue NextAuth JWT sessions for two contexts:
  - participant session cookie (`PARTICIPANT_COOKIE_NAME`)
  - lecturer/manager session cookie (`MANAGER_COOKIE_NAME`)
- Enforce redirect allowlists and short-lived redirect cookies to prevent open redirects.
- Support Discourse SSO by signing payloads based on the authenticated lecturer session.
- Emit operational notifications (e.g., first-login) via Teams webhook when configured.

## Dependencies

- **PostgreSQL**: session/account persistence via Prisma + NextAuth Prisma adapter (`@klicker-uzh/prisma`, `@auth/prisma-adapter`).
- **Edu-ID (OIDC)**: OAuth provider for lecturer and participant authentication (configured in NextAuth).
- **Klicker frontends (Manage/PWA/Assessment)**: redirect targets; validated by host allowlists in middleware and NextAuth redirect callbacks.
- **Microsoft Teams webhook**: optional operational notifications (`sendTeamsNotifications`).

## Deployment (Helm)

- Chart: `deploy/charts/klicker-uzh-v3/`
- Deployment template: `deploy/charts/klicker-uzh-v3/templates/deployment-app.yaml` (component `auth`)
- ConfigMap: `deploy/charts/klicker-uzh-v3/templates/cm-auth.yaml` (auth-specific; currently empty)
- Secret: `{{ releaseFullname }}-secret-auth`
- Service: `deploy/charts/klicker-uzh-v3/templates/service-app.yaml` (port `3000`)
- Ingress: `deploy/charts/klicker-uzh-v3/templates/ingress-auth.yaml`

## Configuration (names only)

- `APP_ORIGIN_AUTH` — issuer
- `APP_SECRET` — jwt
- `NEXTAUTH_URL` — baseurl
- `EDUID_CLIENT_ID` — oidc
- `EDUID_CLIENT_SECRET` — oidc
- `EDUID_WELL_KNOWN` — oidc
- `NEXT_PUBLIC_EDUID_ID` — oidc
- `NEXT_PUBLIC_MANAGE_URL` — manage
- `NEXT_PUBLIC_PWA_URL` — pwa
- `NEXT_PUBLIC_ASSESSMENT_URL` — assessment
- `AUTH_STUDENT_ALLOWED_HOSTS` — allowlist
- `AUTH_LECTURER_ALLOWED_HOSTS` — allowlist
- `AUTH_PWA_HOSTS` — allowlist
- `TEAMS_WEBHOOK_URL` — teams

## Notes

- This service is the login entrypoint for all other frontends; they typically redirect here and rely on its cookies for authentication.
- Kubernetes runs the Next.js server on port `3000` (container), while local development uses `next dev --port 3010` (`apps/auth/package.json`).
- Related docs: `[[Backend GraphQL]]`, `[[Frontend PWA]]`, `[[Frontend PWA - Assessment]]`, `[[02-Authentication and Cookies]]`, `[[00-Component Catalog]]`.
