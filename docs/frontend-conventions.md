---
type: Frontend Conventions
title: Frontend Conventions
description: Shared conventions for manage, pwa, control, and auth — design system, Apollo with generated ops, i18n, Formik, data-cy, and CSP rules.
timestamp: '2026-08-23'
tags:
  - frontend
---

# Frontend Conventions

**Every user-visible string is TWO edits, and every interactive element gets a `data-cy`.** New text goes into BOTH `packages/i18n/messages/de.ts` and `en.ts` under the matching namespace, or one locale silently falls back. New buttons/inputs get a `data-cy` attribute — it is the single test hook consumed by Playwright (`playwright.config.ts` sets `testIdAttribute: 'data-cy'`, so `page.getByTestId(...)` reads it). There is no `data-testid` anywhere; don't introduce one.

Scope: `frontend-manage`, `frontend-pwa`, `frontend-control`, `auth` — all Next.js **pages router**. `apps/chat` is the app-router exception with its own conventions: [Chat Platform](./chat-platform.md).

Course overview headers keep the participant count beneath the course name so metadata does not compete with actions. Keep the contextual action primary and place low-frequency actions in one labelled overflow menu. Keep the visible buttons and overflow trigger in one action cluster; let that cluster wrap across viewports without separating or shrinking the ellipsis control or duplicating controls (`apps/frontend-manage/src/components/courses/CourseOverviewHeader.tsx`).

Assessment participant administration follows that rule: managers reach the dedicated invitation page from the course overflow menu (`CourseOverviewHeader.tsx:courseActionMenuItems`). The page parses CSV files with a small dependency-free browser parser only after file selection, then sends typed rows through generated GraphQL operations (`apps/frontend-manage/src/components/courses/participantInvitations/ParticipantInvitationCsvUpload.tsx:handleFileSelection`). The canonical browser-generated template contains only `email,matriculationNumber`; uploaded files may use comma or semicolon delimiters and supported matriculation-header aliases, but required semantic headers must be unique and every non-empty record must match the header width. Reject malformed quoting locally while preserving server-side per-row email errors and partial success. The affiliation notice is advisory: only a verified Swiss Edu-ID affiliation can establish the identity match, so do not infer or enforce affiliation from a domain suffix. Keep per-row import failures visible, show `PENDING` and `ACCEPTED` as distinct table states, and expose deletion only on pending rows (`ParticipantInvitationsTable.tsx:ParticipantInvitationsTable`).

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

Assessment comparison charts treat privacy-preserving score ranges as
categorical groups. Render equal-width bars in the export and verification
surfaces, highlight the group containing the student's score, and retain the
exact range/count table for accessible detail. Show percentile as a 0–100
ruler with a marker at the student's inclusive percentile rank; do not imply
that the score groups form a normal or continuous distribution. The comparison
remains omitted below the existing cohort threshold, and the stored V1 report
contract is unchanged.

## Next.js tooling

- All five Next.js 16 apps use Turbopack for development and `build:test`. Auth exposes `dev:webpack` as a fallback if its Pages Router login page stalls during a cold Turbopack compile in the monorepo. Auth and chat use Turbopack for production. Control, manage, and PWA keep Webpack only for production while `@ducanh2912/next-pwa` generates their service workers. Each script selects exactly one bundler; never combine `--webpack` with `--turbopack`.
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
- **Pinned list controls**: pagination / entries-per-page controls must never scroll away with their list. On a page, make the container `flex flex-col`, give the scrolling list its own `min-h-0 flex-1 overflow-y-auto` child, and keep the pager a `flex-none` sibling below it (`pages/index.tsx`, `pages/activities.tsx`). Inside the design-system `Modal` — whose content is itself `overflow-y-auto` — neutralize that with `className.content: 'overflow-visible'` and cap the list with `max-h-[...] overflow-y-auto` so it is the single scroll boundary (`ExistingElementSelectionModal.tsx`, `courses/CourseVerifiableCredentialsModal.tsx`).

## Markdown and Video Embeds

- **Plain-link trigger**: Any plain, unformatted markdown link labelled `video` or `embed` (case-insensitive, trimmed) with a supported URL is rendered as a responsive iframe. The player uses a block-styled phrasing wrapper so links keep the original interception behavior inside paragraphs, lists, headings, and tables without producing invalid `<p><div>` markup. Formatted labels, unsupported hosts, malformed IDs, and other link labels stay regular links.
- **YouTube URLs**: Allowlisted `youtube.com/watch`, `youtu.be`, and `youtube.com/embed` links are supported. Video IDs must contain exactly 11 valid characters.
- **Kaltura URLs**: MediaSpace, legacy `entryId` / `partner_id` / `uiConfId`, and PlayKit `/p/{partnerId}` / `/uiconf_id/{uiConfId}` forms are supported. Entry IDs require `0_` or `1_` plus 8 alphanumeric characters; partner/UI configuration defaults to `106` / `23449004`. Generic Kaltura origins intentionally normalize to the UZH SWITCHcast player for now.
- **Player behavior**: YouTube and Kaltura render immediately with the original 16:9 responsive dimensions, accessible provider title, lazy loading, and fullscreen support.

## Data fetching

Apollo Client with **generated documents only** — `import { UserProfileDocument } from '@klicker-uzh/graphql/dist/ops'`; never inline `gql`. Standard query guard: `if (!data?.field) return <Loader />`. Mutations declare `refetchQueries`. New/changed ops require the codegen ritual ([API layer](./graphql-api-layer.md)). Server state lives in Apollo cache; local state in React hooks. The PWA additionally uses **localforage** as an offline side-channel for live-quiz answers (`apps/frontend-pwa/src/components/liveQuiz/storageHelpers.ts`).

The participant account settings page keeps research and learning-analytics
choices in a dedicated section outside the profile form
(`apps/frontend-pwa/src/components/participant/DataUseSettings.tsx`). Each
account-wide choice has its own mutation and pending state. The controls wait
for `GetParticipantDataUse`, which uses `network-only` on every mount so the
singleton browser cache cannot expose a previous participant's choices after an
account change. After a successful mutation, each control updates only its own
fields in that query cache so concurrent choices cannot overwrite one another.
They never infer a choice from missing or nullable query data.

The manage Elements and Activities lists use the shared `Pagination` control
with finite `10`, `20`, and `50` page sizes plus an opt-in `All` value. `All`
keeps the active filters and sort, resets to page 1, omits `numEntries` and
`offset`, and hides page navigation. It loads the current filtered result and
does not select records; the existing list checkbox remains the explicit
select-all action. Page-size preferences accept only those four values when
read from local storage. The verification-record modal keeps the shared
control's default opt-out because its backend fetch remains capped at 100
records (`apps/frontend-manage/src/components/common/Pagination.tsx:Pagination`,
`apps/frontend-manage/src/pages/index.tsx:Index`,
`apps/frontend-manage/src/pages/activities.tsx:Activities`).

Assessment participant invitations use the same control with finite `10`, `20`,
and `50` page sizes and no `All` option. The page requests the additive
`assessmentParticipantInvitations` operation with `numEntries` and `offset`,
shows the server-provided total, and resets to page 1 after an import or delete.
CSV selection rejects files above 1 MiB and imports above 200 data rows before
submitting a mutation (`apps/frontend-manage/src/pages/courses/[id]/assessment/invitations.tsx:AssessmentParticipantInvitations`).

## i18n (next-intl)

Namespaces are per-app plus `shared` (`shared`, `auth`, `pwa`, `manage`, `control`). Usage: `useTranslations()` without a namespace argument and full-path keys — `t('manage.settings.userSettings')`, `t('shared.generic.cancel')`; `t.rich` for markup. Messages load per page via `getStaticProps`; the plugin is wired in each `next.config.mjs` (`createNextIntlPlugin`).

## Forms

**Formik + Yup** (not react-hook-form). Design-system `Formik*` field components bind by `name`. Existing modals (e.g. `apps/frontend-manage/src/components/sharing/TransferOwnershipModal.tsx`) are the template.

## Gotchas absorbed from experience

- **Feature flags gate alone.** Don't combine a flag with data-dependent counts (`flag && count > 0`) — that creates chicken-and-egg visibility problems.
  - **Legacy active preview fields:**
    - `privatePreview` (User-profile level): Gates advanced beta features such as element/activity sharing, microlearning, and administrator panels. Managed via the admin page (`apps/frontend-manage/src/pages/admin.tsx`).
    - `publicPreview` (User-profile level): Retained in Prisma and the public GraphQL schema, but no longer selected by Manage's user-profile query or used for learning analytics.
  - `@klicker-uzh/feature-flags` is the shared GrowthBook integration. Manage's `learning-analytics` flag defaults to false and leaves analytics controls visible but disabled. Use stable internal actor IDs for targeting, and never treat a flag as authorization. See [Feature Flags](./feature-flags.md) and [ADR 0008](./adr/0008-use-growthbook-for-feature-flags.md).
- **CSP `frame-ancestors` is set at the proxy, never in Next.js middleware.** Middleware CSP breaks `_next/data` routes in production builds (known Next.js bug). Production: HAProxy ingress annotations (`haproxy.org/response-set-header` in `deploy/charts/klicker-uzh-v3/templates/ingress-*.yaml`); local: Traefik `customResponseHeaders` (`util/traefik/rules_docker.yaml`).
- **Embedded PWA messaging**: use a parent-initiated `postMessage` handshake to capture `event.origin`; no `'*'` target origins and no second per-platform allowlist in page code — embedding permission is enforced by ingress `frame-ancestors`.
- **Local embed testing**: `util/embed-harness/` must target the branch-local PWA (`http://127.0.0.1:3101/...`), not the production PWA — production CSP blocks localhost embedding.

## Verification

UI changes are verified in a real browser (`npx agent-browser` for agents — see [Getting Started](./getting-started.md) agent addendum) with before/after screenshots, not by reading the JSX.
