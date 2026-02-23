# Frontend PWA

Student-facing Next.js application (PWA + optional Capacitor wrapper) used for joining courses and participating in live/practice activities, including submitting live quiz responses.

## Code

- App: `apps/frontend-pwa/`
- Entry point: `apps/frontend-pwa/src/pages/index.tsx`
- Live quiz session page (response submission): `apps/frontend-pwa/src/pages/session/[id].tsx`
- Course overview: `apps/frontend-pwa/src/pages/course/[courseId]/index.tsx`
- PWA/Service Worker: `apps/frontend-pwa/worker/index.ts`
- Capacitor config: `apps/frontend-pwa/capacitor.config.ts`

## Responsibilities

- Render the student dashboard and course/activity views (live quizzes, practice quizzes, microlearnings).
- Authenticate participants via cookies issued by `[[Auth]]` and consume the GraphQL API via Apollo.
- Submit responses for live quiz blocks to the Response API (`fetch(NEXT_PUBLIC_ADD_RESPONSE_URL, { credentials: 'include' })`).
- Subscribe/unsubscribe to push notifications per course (GraphQL mutations + service worker integration).
- Provide entrypoints into course chatbots (links to `[[Chat]]`).

## Dependencies

- **Backend GraphQL**: primary API for all course/activity data and mutations (`@klicker-uzh/graphql` ops).
- **Response API**: ingestion endpoint for live quiz submissions (`/AddResponse`).
- **Auth**: participant login and cookie/session management.
- **@klicker-uzh/shared-components**: shared UI components and hooks (incl. push notification helpers).
- **@klicker-uzh/markdown**: markdown rendering for content-heavy views.
- **Matomo**: optional web analytics tracking (`@socialgouv/matomo-next`).

## Deployment (Helm)

- Chart: `deploy/charts/klicker-uzh-v3/`
- Deployment template: `deploy/charts/klicker-uzh-v3/templates/deployment-app.yaml` (component `frontend-pwa`)
- ConfigMap: `deploy/charts/klicker-uzh-v3/templates/cm-frontend-pwa.yaml`
- Secret: `{{ releaseFullname }}-secret-frontend-pwa`
- Service: `deploy/charts/klicker-uzh-v3/templates/service-app.yaml` (port `3000`)
- Ingress: `deploy/charts/klicker-uzh-v3/templates/ingress-frontend-pwa.yaml`

## Configuration (names only)

- `API_URL_SSR` — graphql
- `NEXT_PUBLIC_API_URL` — graphql
- `NEXT_PUBLIC_ADD_RESPONSE_URL` — ingest
- `NEXT_PUBLIC_AUTH_URL` — auth
- `NEXT_PUBLIC_PWA_URL` — pwa
- `NEXT_PUBLIC_CHAT_URL` — chat
- `NEXT_PUBLIC_IS_ASSESSMENT` — mode
- `ALLOWED_FRAME_ANCESTORS` — csp
- `BLOB_STORAGE_ACCOUNT_URL` — blob
- `NEXT_PUBLIC_MATOMO_URL` — matomo
- `NEXT_PUBLIC_MATOMO_SITE_ID` — matomo
- `NEXT_PUBLIC_WITH_MAGIC_LINK` — login

## Notes

- Assessment deployment uses the same codebase and image but different configuration; see `[[Frontend PWA - Assessment]]` and `[[01-Assessment vs Non-assessment Split]]`.
- `NEXT_PUBLIC_*` variables are used in client-side code and are typically baked at build time (see `apps/frontend-pwa/Dockerfile`), while `API_URL_SSR` is injected at runtime via ConfigMap.
- Related docs: `[[Backend GraphQL]]`, `[[Response API]]`, `[[Auth]]`, `[[00-Component Catalog]]`.
