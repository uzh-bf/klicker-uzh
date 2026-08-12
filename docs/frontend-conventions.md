---
type: Frontend Conventions
title: Frontend Conventions
description: Shared conventions for manage, pwa, control, and auth — design system, Apollo with generated ops, i18n, Formik, data-cy, and CSP rules.
timestamp: '2026-08-12'
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

## Live Quiz response modes

`LiveQuizResponseCollectionMode` is a persisted activity setting, not a
frontend-only preference (`apps/frontend-manage/src/components/activities/creation/liveQuiz/LiveQuizWizard.tsx:LiveQuizWizard`). The wizard defaults to aggregate anonymous collection, forces aggregate collection for assessment courses, and clears gamification when correlated export is selected. Published and ended quizzes keep their existing mode locked. The student page renders the matching privacy notice and selects the corresponding response-api endpoint; correlated mode first calls `InitializeLiveQuizResponseIdentity`, keeps any signed anonymous respondent token in page memory only, and then submits to `AddCorrelatedResponse` (`apps/frontend-pwa/src/pages/session/[id].tsx:handleNewResponse`). The response API prefers participant, temporary, and respondent cookies before accepting the explicit bearer fallback.

The manage evaluation page renders the correlated CSV action only when the
server grants `canExportCorrelatedResponses`; the action includes its privacy
warning and maps the bounded export-service failure messages to localized
toasts (`apps/frontend-manage/src/components/evaluation/CorrelatedResponseExport.tsx:CorrelatedResponseExport`).

## i18n (next-intl)

Namespaces are per-app plus `shared` (`shared`, `auth`, `pwa`, `manage`, `control`). Usage: `useTranslations()` without a namespace argument and full-path keys — `t('manage.settings.userSettings')`, `t('shared.generic.cancel')`; `t.rich` for markup. Messages load per page via `getStaticProps`; the plugin is wired in each `next.config.mjs` (`createNextIntlPlugin`).

## Forms

**Formik + Yup** (not react-hook-form). Design-system `Formik*` field components bind by `name`. Existing modals (e.g. `apps/frontend-manage/src/components/sharing/TransferOwnershipModal.tsx`) are the template.

## Gotchas absorbed from experience

- **Feature flags gate alone.** Don't combine a flag with data-dependent counts (`flag && count > 0`) — that creates chicken-and-egg visibility problems.
  - **Active Feature Flags:**
    - `privatePreview` (User-profile level): Gates advanced beta features such as element/activity sharing, microlearning, and administrator panels. Managed via the admin page (`apps/frontend-manage/src/pages/admin.tsx`).
    - `publicPreview` (User-profile level): Gates general preview features like microlearning analytics and new evaluation navigation interfaces.
  - _Tradeoff Rationale_: We intentionally skip a dedicated feature flag platform (e.g., Unleash/GrowthBook) to avoid infra complexity for a 2-4 developer team. User-profile fields are our standard flagging mechanism.
- **CSP `frame-ancestors` is set at the proxy, never in Next.js middleware.** Middleware CSP breaks `_next/data` routes in production builds (known Next.js bug). Production: HAProxy ingress annotations (`haproxy.org/response-set-header` in `deploy/charts/klicker-uzh-v3/templates/ingress-*.yaml`); local: Traefik `customResponseHeaders` (`util/traefik/rules_docker.yaml`).
- **Embedded PWA messaging**: use a parent-initiated `postMessage` handshake to capture `event.origin`; no `'*'` target origins and no second per-platform allowlist in page code — embedding permission is enforced by ingress `frame-ancestors`.
- **Local embed testing**: `util/embed-harness/` must target the branch-local PWA (`http://127.0.0.1:3101/...`), not the production PWA — production CSP blocks localhost embedding.

## Verification

UI changes are verified in a real browser (`npx agent-browser` for agents — see [Getting Started](./getting-started.md) agent addendum) with before/after screenshots, not by reading the JSX.
