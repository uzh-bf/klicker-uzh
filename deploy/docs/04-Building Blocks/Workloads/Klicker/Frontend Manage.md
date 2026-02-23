# Frontend Manage

Lecturer-facing Next.js application used for creating and managing courses/activities/quizzes, controlling live sessions, and managing resources such as chatbots and media.

## Code

- App: `apps/frontend-manage/`
- Entry point: `apps/frontend-manage/src/pages/index.tsx`
- Live quiz cockpit: `apps/frontend-manage/src/pages/quizzes/[id]/cockpit.tsx`
- Lecturer view (audience interaction display): `apps/frontend-manage/src/pages/quizzes/[id]/lecturer.tsx`
- Resources (chatbots/media): `apps/frontend-manage/src/pages/resources/*`
- Analytics pages: `apps/frontend-manage/src/pages/analytics/*`

## Responsibilities

- Provide the primary UI for lecturers to create/edit content (elements, activities, quizzes) and manage courses.
- Control live quizzes (start/end, activate/deactivate blocks) and show audience interaction (feedback/confusion).
- Manage shared resources (chatbots, catalogs, user groups) and upload media assets.
- Consume the GraphQL API via Apollo Client and react to live updates via subscriptions/polling where appropriate.

## Dependencies

- **Backend GraphQL**: primary API for all management actions (`@klicker-uzh/graphql` ops).
- **Auth**: lecturer login and session cookies.
- **Azure Blob Storage**: client-side uploads using `@azure/storage-blob` (typically with SAS URLs minted by the backend).
- **@klicker-uzh/shared-components**: shared UI primitives and logic.
- **@klicker-uzh/markdown**: markdown rendering for content-heavy views.
- **UI libraries**: `@tanstack/react-table`, `@fullcalendar/*`, `recharts`, `slate`, `react-dnd` for complex interaction-heavy screens.
- **Matomo**: optional web analytics tracking (`@socialgouv/matomo-next`).

## Deployment (Helm)

- Chart: `deploy/charts/klicker-uzh-v3/`
- Deployment template: `deploy/charts/klicker-uzh-v3/templates/deployment-app.yaml` (component `frontend-manage`)
- ConfigMap: `deploy/charts/klicker-uzh-v3/templates/cm-frontend-manage.yaml`
- Secret: `{{ releaseFullname }}-secret-frontend-manage`
- Service: `deploy/charts/klicker-uzh-v3/templates/service-app.yaml` (port `3000`)
- Ingress: `deploy/charts/klicker-uzh-v3/templates/ingress-frontend-manage.yaml`

## Configuration (names only)

- `API_URL_SSR` — graphql
- `NEXT_PUBLIC_API_URL` — graphql
- `NEXT_PUBLIC_AUTH_URL` — auth
- `NEXT_PUBLIC_MANAGE_URL` — manage
- `NEXT_PUBLIC_PWA_URL` — pwa
- `NEXT_PUBLIC_ASSESSMENT_URL` — assessment
- `NEXT_PUBLIC_LTI_URL` — lti
- `ALLOWED_FRAME_ANCESTORS` — csp
- `BLOB_STORAGE_ACCOUNT_URL` — blob
- `NEXT_PUBLIC_MATOMO_URL` — matomo
- `NEXT_PUBLIC_MATOMO_SITE_ID` — matomo
- `NEXT_PUBLIC_AVATAR_BASE_PATH` — avatars

## Notes

- This is the main lecturer application; `[[Frontend Control]]` is a lightweight companion for session control on mobile/presenter devices.
- Media uploads are performed directly from the browser using the Azure SDK; the backend provides the upload authorization (SAS) and metadata persistence.
- Related docs: `[[Backend GraphQL]]`, `[[Auth]]`, `[[LTI]]`, `[[Azure Blob Storage]]`, `[[00-Component Catalog]]`.
