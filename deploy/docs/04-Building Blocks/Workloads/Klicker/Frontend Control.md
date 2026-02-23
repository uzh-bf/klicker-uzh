# Frontend Control

Lightweight Next.js application for presenters to control live quiz sessions (activate blocks, end sessions) from a dedicated, mobile-friendly interface.

## Code

- App: `apps/frontend-control/`
- Entry point: `apps/frontend-control/src/pages/index.tsx`
- Login redirect helper: `apps/frontend-control/src/pages/login.tsx`
- Session control page: `apps/frontend-control/src/pages/session/[id].tsx`
- Course view: `apps/frontend-control/src/pages/course/[id].tsx`

## Responsibilities

- Provide a focused UI for selecting courses and controlling running live quizzes.
- Execute live quiz control mutations (activate/deactivate blocks, end quiz) via the GraphQL API.
- Redirect unauthenticated users to `[[Auth]]` and return to the control app after login.
- Operate as a PWA for convenient use on mobile devices.

## Dependencies

- **Backend GraphQL**: API for listing courses/quizzes and performing control mutations.
- **Auth**: login entrypoint used by `/login` redirection flow.
- **@klicker-uzh/shared-components**: shared UI primitives.
- **Matomo**: optional web analytics tracking (`@socialgouv/matomo-next`).

## Deployment (Helm)

- Chart: `deploy/charts/klicker-uzh-v3/`
- Deployment template: `deploy/charts/klicker-uzh-v3/templates/deployment-app.yaml` (component `frontend-control`)
- ConfigMap: `deploy/charts/klicker-uzh-v3/templates/cm-frontend-control.yaml`
- Secret: `{{ releaseFullname }}-secret-frontend-control`
- Service: `deploy/charts/klicker-uzh-v3/templates/service-app.yaml` (port `3000`)
- Ingress: `deploy/charts/klicker-uzh-v3/templates/ingress-frontend-control.yaml`

## Configuration (names only)

- `API_URL_SSR` — graphql
- `NEXT_PUBLIC_API_URL` — graphql
- `NEXT_PUBLIC_AUTH_URL` — auth
- `NEXT_PUBLIC_CONTROL_URL` — control
- `NEXT_PUBLIC_MANAGE_URL` — manage
- `ALLOWED_FRAME_ANCESTORS` — csp
- `NEXT_PUBLIC_MATOMO_URL` — matomo
- `NEXT_PUBLIC_MATOMO_SITE_ID` — matomo

## Notes

- `/login` builds a `redirectTo` back to the control app (`NEXT_PUBLIC_CONTROL_URL`) and forwards the user to the auth service (`NEXT_PUBLIC_AUTH_URL`).
- Related docs: `[[Frontend Manage]]`, `[[Backend GraphQL]]`, `[[Auth]]`, `[[00-Component Catalog]]`.
