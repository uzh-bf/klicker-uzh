---
type: Frontend Conventions
title: Frontend Conventions
description: Shared conventions for manage, pwa, control, and auth — design system, Apollo with generated ops, i18n, Formik, data-cy, and CSP rules.
timestamp: '2026-07-29'
tags:
  - frontend
---

# Frontend Conventions

**Every user-visible string is TWO edits, and every interactive element gets a `data-cy`.** New text goes into BOTH `packages/i18n/messages/de.ts` and `en.ts` under the matching namespace, or one locale silently falls back. New buttons/inputs get a `data-cy` attribute — it is the single test hook consumed by _both_ Cypress and Playwright (`playwright.config.ts` sets `testIdAttribute: 'data-cy'`, so `page.getByTestId(...)` reads it). There is no `data-testid` anywhere; don't introduce one.

Scope: `frontend-manage`, `frontend-pwa`, `frontend-control`, `auth` — all Next.js **pages router**. `apps/chat` is the app-router exception with its own conventions: [Chat Platform](./chat-platform.md).

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

## i18n (next-intl)

Namespaces are per-app plus `shared` (`shared`, `auth`, `pwa`, `manage`, `control`). Usage: `useTranslations()` without a namespace argument and full-path keys — `t('manage.settings.userSettings')`, `t('shared.generic.cancel')`; `t.rich` for markup. Messages load per page via `getStaticProps`; the plugin is wired in each `next.config.mjs` (`createNextIntlPlugin`).

English and German message trees must have the same structural keys. `packages/i18n/parity.ts` enforces both directions at compile time, and the `@klicker-uzh/i18n` `check` script is included in the root verification.

## Forms

**Formik + Yup** (not react-hook-form). Design-system `Formik*` field components bind by `name`. Existing modals (e.g. `apps/frontend-manage/src/components/sharing/TransferOwnershipModal.tsx`) are the template.

CODE authoring uses the shared accessible CodeMirror wrapper at `packages/shared-components/src/CodeEditor.tsx`. Keep fixed Python/timeout policy out of Formik state; the form edits starter/sample code, entrypoint, and declarative tests only. JSON argument/output editors use plain-text mode, every editor keeps its `aria-label` and `data-cy`, participant preview receives public tests only, and CODE remains unavailable in template authoring.

The Manage artificial preview updates its GraphQL typename and student response through separate effects. During an element-type transition those discriminants can briefly disagree; narrow the response at strict component boundaries (for CODE, require an actual string before passing it to CodeMirror) instead of trusting the transient enum value alone.

In the participant PWA, CODE stacks use the asynchronous receipt lifecycle instead of the synchronous stack-response mutation. Persist the submitted code and receipt id under a separate activity-and-stack-scoped local-storage key, include and verify the authenticated participant id before restoring either receipt or completion state, recover it after reload, and subscribe with polling fallback while it is active. Terminal receipts are monotonic: a stale active poll or subscription result must not regress `COMPLETED` or `FAILED`, and a `FAILED` receipt must leave the editor enabled for a new attempt.

Practice quizzes derive their local completion directly from the completed receipt. Microlearning is single-submission, so `COMPLETED` instead triggers one fresh `getPreviousStackEvaluation` readback and writes the finalized database evaluation into a participant-scoped `qi-code-*` key before enabling Continue. A failed readback is visible, offers an explicit retry, and never fabricates local points. Participant rendering and readback may show public test inputs, expectations, and results only; hidden test metadata and execution output never cross the participant GraphQL boundary. Manage evaluation uses a plain per-test aggregate table, including hidden test names and counts for authorized lecturers; CODE deliberately does not enter the generic chart selector.

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
