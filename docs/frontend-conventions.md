---
type: Frontend Conventions
title: Frontend Conventions
description: Shared conventions for manage, pwa, control, and auth — design system, Apollo with generated ops, i18n, Formik, data-cy, and CSP rules.
timestamp: '2026-08-16'
tags:
  - frontend
---

# Frontend Conventions

**Every user-visible string is TWO edits, and every interactive element gets a `data-cy`.** New text goes into BOTH `packages/i18n/messages/de.ts` and `en.ts` under the matching namespace, or one locale silently falls back. New buttons/inputs get a `data-cy` attribute — it is the single test hook consumed by Playwright (`playwright.config.ts` sets `testIdAttribute: 'data-cy'`, so `page.getByTestId(...)` reads it). There is no `data-testid` anywhere; don't introduce one.

Scope: `frontend-manage`, `frontend-pwa`, `frontend-control`, `auth` — all Next.js **pages router**. `apps/chat` is the app-router exception with its own conventions: [Chat Platform](./chat-platform.md).

Course overview headers keep the participant count beneath the course name so metadata does not compete with actions. Keep the contextual action primary and place low-frequency actions in one labelled overflow menu. Keep the visible buttons and overflow trigger in one action cluster; let that cluster wrap across viewports without separating or shrinking the ellipsis control or duplicating controls (`apps/frontend-manage/src/components/courses/CourseOverviewHeader.tsx`).

Assessment report exports intentionally keep one browser-side artifact:
`apps/frontend-pwa/src/components/insights/assessmentResults/exportReport.ts:createAssessmentReport`
creates the self-contained HTML used by both report actions. **View report**
opens the blob directly; **Save as PDF** opens the same blob in a guarded popup
and invokes the browser print dialog only after the report has loaded. The
document title includes the human report title and course name, so the browser
can suggest a course-specific PDF filename. Print CSS sets A4 portrait pages,
keeps the SVG chart and accessible histogram table, and compacts the QR and
metadata blocks without changing the on-screen report. QR rendering and popup
navigation have bounded failure paths so export cannot remain stuck on a
spinner.

## Next.js tooling

- All five Next.js 16 apps use Turbopack for development and `build:test`. Auth and chat also use Turbopack for production. Control, manage, and PWA keep Webpack only for production while `@ducanh2912/next-pwa` generates their service workers. Each script selects exactly one bundler; never combine `--webpack` with `--turbopack`.
- The shared Next config derives the active checkout root from its own module URL and passes it to both `turbopack.root` and `outputFileTracingRoot`. This keeps standalone output correct in nested Git worktrees.
- Run lint through each app's `eslint .` script. Next.js 16 removed `next lint` and the `eslint` block from `next.config`.
- Each app's `check` script runs `next typegen` before `tsc --noEmit`. Keep generated `next-env.d.ts` ignored but included in `tsconfig.json`, together with `.next/types/**/*.ts` and `.next/dev/types/**/*.ts`; Next owns and rewrites these files. Control, Manage, and PWA use `tsconfig.check.json` only for raw package checks so stale `.next/dev/types` cannot duplicate fresh Pages Router validators. Next builds use the canonical `tsconfig.json`; Next 16 filters development validators on its production typecheck path. Auth and Chat use their main config for both checks and builds.
- TypeScript 6 path mappings use explicit relative targets such as `./src/*`; do not restore a package-level `baseUrl`. Manage and PWA retain a narrow `public/*` → `./public/*` mapping for their existing bare rank-image imports (`apps/frontend-manage/tsconfig.json`, `apps/frontend-pwa/tsconfig.json`).
- `auth`, `frontend-control`, `frontend-manage`, and `frontend-pwa` use Pages Router i18n. `chat` is App Router and passes `includeI18n: false` to the shared config.
- Generated PWA service-worker, Workbox, fallback, and worker bundles are ignored by each PWA app's flat ESLint config. Do not lint or commit them.

## Components and styling

- **Local fonts**: all five Next.js apps load Source Sans 3 through
  `packages/shared-components/src/font.ts`; Chat and Manage also use JetBrains
  Mono. Both families use package-local WOFF2 assets. Keep the existing exports
  and CSS variables when changing typography, and keep production builds
  independent of external font services. Upstream versions, licenses, and asset
  hashes live beside the files in
  `packages/shared-components/src/fonts/PROVENANCE.md`.
- **Design system first**: `@uzh-bf/design-system` provides `Button`, `Modal`, `FormikTextField`, `H1–H4`, `toast`, etc. Design-system components take the test hook as a prop: `data={{ cy: 'save-button' }}`; raw elements use a plain `data-cy` attribute.
- **Tailwind v4, CSS-first**: no `tailwind.config.js` — theme tokens live in each app's `globals.css` (`@theme` block, `--color-uzh-blue`, shadcn-style tokens) and the design system is scanned via `@source "../node_modules/@uzh-bf/design-system/src"`. Conditional classes via `twMerge`.
- **Shared components** (`packages/shared-components`): Loader, DataTable, question renderers, Leaderboard, charts, evaluation. **Deep-import** them (`@klicker-uzh/shared-components/src/Loader`) — there is no barrel index.
- Function components with hooks only; PascalCase files; app-local components under `src/components/` with relative imports.
- Clickable rows must ignore events from marked interactive subtrees so opening a dropdown or modal cannot also trigger the row navigation.
- Async Formik submit handlers must return or await their mutation promise so `isSubmitting` remains active and users cannot navigate away before the save completes.

## Markdown and Video Embeds

- **Plain-link trigger**: Any plain, unformatted markdown link labelled `video` or `embed` (case-insensitive, trimmed) with a supported URL is rendered as a responsive iframe. The player uses a block-styled phrasing wrapper so links keep the original interception behavior inside paragraphs, lists, headings, and tables without producing invalid `<p><div>` markup. Formatted labels, unsupported hosts, malformed IDs, and other link labels stay regular links.
- **YouTube URLs**: Allowlisted `youtube.com/watch`, `youtu.be`, and `youtube.com/embed` links are supported. Video IDs must contain exactly 11 valid characters.
- **Kaltura URLs**: MediaSpace, legacy `entryId` / `partner_id` / `uiConfId`, and PlayKit `/p/{partnerId}` / `/uiconf_id/{uiConfId}` forms are supported. Entry IDs require `0_` or `1_` plus 8 alphanumeric characters; partner/UI configuration defaults to `106` / `23449004`. Generic Kaltura origins intentionally normalize to the UZH SWITCHcast player for now.
- **Player behavior**: YouTube and Kaltura render immediately with the original 16:9 responsive dimensions, accessible provider title, lazy loading, and fullscreen support.

## Data fetching

Apollo Client with **generated documents only** — `import { UserProfileDocument } from '@klicker-uzh/graphql/dist/ops'`; never inline `gql`. Standard query guard: `if (!data?.field) return <Loader />`. Mutations declare `refetchQueries`. New/changed ops require the codegen ritual ([API layer](./graphql-api-layer.md)). Server state lives in Apollo cache; local state in React hooks. The PWA additionally uses **localforage** as an offline side-channel for live-quiz answers (`apps/frontend-pwa/src/components/liveQuiz/storageHelpers.ts`).

## Knowledge-base management

The lecturer routes `apps/frontend-manage/src/pages/resources/knowledgeBases.tsx:KnowledgeBasesPage` and `apps/frontend-manage/src/pages/resources/knowledgeBases/[id].tsx:KnowledgeBasePage` mount the buildless `@klicker-uzh/kb-management` package inside the authenticated manage layout. The dynamic detail route uses `getServerSideProps`; its arbitrary database ids are resolved per request rather than through empty build-time paths. Keep reusable KB UI in that package rather than duplicating it in the host app.

`apps/frontend-manage/src/components/common/Header.tsx:Header` shows the KB navigation item only for `user.privatePreview`. That client gate is discoverability only: direct catalog/detail URLs rely on the service's fresh database guard and render the localized `KB_PREVIEW_ACCESS_REQUIRED` message. GrowthBook course-cohort gating remains deferred; do not treat this interim per-account flag as the final rollout model.

The catalog uses server search and cursor-driven “load more” rather than loading all owned KBs. The detail page keeps metadata/metrics separate from `packages/kb-management/src/components/KnowledgeBaseResourceList.tsx:KnowledgeBaseResourceList`, which owns server search plus design-system type/status filters, selection, confirmed bulk deletion, the source inspector, and contextual Ingest/Retry/Re-ingest/Delete actions. While any loaded row is `QUEUED`/`PROCESSING`, the two-second interval fetches page zero plus pages known to contain active rows and runs a full loaded-window walk every tenth tick. Cursor or page-length drift triggers an immediate full walk. Promise-only polls use `ApolloClient.query` with `no-cache`; generation fencing, the latest loaded-count ref, and shared cache merge preserve the loaded window and remove rows from selection when they become active. Show indeterminate real-operation progress and safe-to-leave messaging rather than invented percentages.

The inspector loads the owner-checked five-attempt history lazily. Full attempt history must stay outside the two-second list poll. Lecturer-facing failure detail is localized from stable status/error codes; raw platform messages are not rendered. Transport tuning is not user-controlled. Changes must preserve EN/DE messages, `data-cy` hooks, keyboard/focus behavior, and browser evidence for desktop plus 390 px mobile states, including search/filter, selection/confirmation, empty, active, ready, failed, and replacement-cutover feedback where affected.

KB and resource deletion dialogs explain the two observable phases: the item disappears immediately, while stored files and the external index are removed in the background. Success toasts confirm removal from the lecturer view without claiming that external cleanup has already completed.

KB mutations and their follow-up refreshes are separate outcomes (`packages/kb-management/src/refreshAfterMutation.ts:refreshAfterMutation`). Once a mutation succeeds, show its success state and close/reset the form even if a best-effort list or metrics refresh fails; log that refresh error without converting the successful mutation into an error toast or a retryable mutation.

The KB file picker exposes only the production ingestion contract: PDF, TXT, and MD up to 25 MiB. Markdown is uploaded as `text/plain`; do not re-add DOCX/PPTX until the external ingestion platform supports them. Stable quota error codes are localized rather than exposing worker messages.

`packages/kb-management/src/components/KnowledgeBaseChatbotBindings.tsx:KnowledgeBaseChatbotBindings` owns the single-enabled-KB binding UI. Replacing an existing chatbot binding requires an explicit warning step; detach is available from the current KB. `apps/frontend-manage/src/components/resources/chatbots/ChatbotDetails.tsx:ChatbotDetails` shows the reciprocal linked-KB state or an actionable no-KB warning.

The detail metrics distinguish visible data, quota usage, upload reservations, pending asynchronous cleanup, unknown-size conservative reservations, and linked consumers. Do not present tombstoned storage as already released or treat derived values as mutable counters.

`packages/kb-management/src/components/KnowledgeGraphPanel.tsx:KnowledgeGraphPanel` is the lecturer-facing graph lifecycle boundary. It exposes the per-KB opt-in, standard/high estimate, maximum reservation, billing mode, reservation status, remaining quota, worst-case balance, settled cost, actual token/request usage, and the localized safe status state. Quota amounts use the persisted quota currency, while historical build cost uses its recorded build currency; a persisted quota currency/limit mismatch makes the cost configuration unavailable until reconciled. The rebuild action stays disabled while the KB is opted out, the global graph switch leaves cost configuration incomplete, or a build is active. Display billing and reservation statuses through localized labels rather than raw enum values or backend status prose, keep provider credentials out of the client, and preserve the `data-cy` hooks for the switch, cost block, status, and rebuild action.

## i18n (next-intl)

Namespaces are per-app plus `shared` (`shared`, `auth`, `pwa`, `manage`, `control`). Usage: `useTranslations()` without a namespace argument and full-path keys — `t('manage.settings.userSettings')`, `t('shared.generic.cancel')`; `t.rich` for markup. Messages load per page via `getStaticProps`; the plugin is wired in each `next.config.mjs` (`createNextIntlPlugin`).

## Forms

**Formik + Yup** (not react-hook-form). Design-system `Formik*` field components bind by `name`. Existing modals (e.g. `apps/frontend-manage/src/components/sharing/TransferOwnershipModal.tsx`) are the template.

## Gotchas absorbed from experience

- **Feature flags gate alone.** Don't combine a flag with data-dependent counts (`flag && count > 0`) — that creates chicken-and-egg visibility problems.
  - **Active Feature Flags:**
    - `privatePreview` (User-profile level): Gates advanced beta features such as knowledge-base management, element/activity sharing, microlearning, and administrator panels. Managed via the admin page (`apps/frontend-manage/src/pages/admin.tsx`). The KB service reads the database value per request, so disabling it does not require re-login.
    - `publicPreview` (User-profile level): Gates general preview features like microlearning analytics and new evaluation navigation interfaces.
  - _Interim KB rollout_: GrowthBook is not yet available. `privatePreview` is the temporary per-account gate; the planned course-cohort gate resumes when GrowthBook lands.
- **CSP `frame-ancestors` is set at the proxy, never in Next.js middleware.** Middleware CSP breaks `_next/data` routes in production builds (known Next.js bug). Production: HAProxy ingress annotations (`haproxy.org/response-set-header` in `deploy/charts/klicker-uzh-v3/templates/ingress-*.yaml`); local: Traefik `customResponseHeaders` (`util/traefik/rules_docker.yaml`).
- **Embedded PWA messaging**: use a parent-initiated `postMessage` handshake to capture `event.origin`; no `'*'` target origins and no second per-platform allowlist in page code — embedding permission is enforced by ingress `frame-ancestors`.
- **Local embed testing**: `util/embed-harness/` must target the branch-local PWA (`http://127.0.0.1:3101/...`), not the production PWA — production CSP blocks localhost embedding.

## Verification

UI changes are verified in a real browser (`npx agent-browser` for agents — see [Getting Started](./getting-started.md) agent addendum) with before/after screenshots, not by reading the JSX.
