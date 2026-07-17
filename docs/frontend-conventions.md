---
type: Frontend Conventions
title: Frontend Conventions
description: Shared conventions for manage, pwa, control, and auth — design system, Apollo with generated ops, i18n, Formik, data-cy, and CSP rules.
timestamp: '2026-07-17'
tags:
  - frontend
---

# Frontend Conventions

**Every user-visible string is TWO edits, and every interactive element gets a `data-cy`.** New text goes into BOTH `packages/i18n/messages/de.ts` and `en.ts` under the matching namespace, or one locale silently falls back. New buttons/inputs get a `data-cy` attribute — it is the single test hook consumed by _both_ Cypress and Playwright (`playwright.config.ts` sets `testIdAttribute: 'data-cy'`, so `page.getByTestId(...)` reads it). There is no `data-testid` anywhere; don't introduce one.

Scope: `frontend-manage`, `frontend-pwa`, `frontend-control`, `auth` — all Next.js **pages router**. `apps/chat` is the app-router exception with its own conventions: [Chat Platform](./chat-platform.md).

## Components and styling

- **Design system first**: `@uzh-bf/design-system` provides `Button`, `Modal`, `FormikTextField`, `H1–H4`, `toast`, etc. Design-system components take the test hook as a prop: `data={{ cy: 'save-button' }}`; raw elements use a plain `data-cy` attribute.
- **Tailwind v4, CSS-first**: no `tailwind.config.js` — theme tokens live in each app's `globals.css` (`@theme` block, `--color-uzh-blue`, shadcn-style tokens) and the design system is scanned via `@source "../node_modules/@uzh-bf/design-system/src"`. Conditional classes via `twMerge`.
- **Shared components** (`packages/shared-components`): Loader, DataTable, question renderers, Leaderboard, charts, evaluation. **Deep-import** them (`@klicker-uzh/shared-components/src/Loader`) — there is no barrel index.
- Function components with hooks only; PascalCase files; app-local components under `src/components/` with relative imports.

## Data fetching

Apollo Client with **generated documents only** — `import { UserProfileDocument } from '@klicker-uzh/graphql/dist/ops'`; never inline `gql`. Standard query guard: `if (!data?.field) return <Loader />`. Mutations declare `refetchQueries`. New/changed ops require the codegen ritual ([API layer](./graphql-api-layer.md)). Server state lives in Apollo cache; local state in React hooks. The PWA additionally uses **localforage** as an offline side-channel for live-quiz answers (`apps/frontend-pwa/src/components/liveQuiz/storageHelpers.ts`).

For element package operations, `apps/frontend-manage/src/lib/importExportErrors.ts:getImportExportErrorCode` extracts only generated `ImportExportErrorCode` values from Apollo/GraphQL errors. UI code maps that enum to paired EN/DE recovery strings and uses a localized generic fallback; never render Apollo/GraphQL `message`, a raw code, or package-authored warning text. The full mapping is in the [Import/Export Error Contract](./import-export-error-contract.md).

## i18n (next-intl)

Namespaces are per-app plus `shared` (`shared`, `auth`, `pwa`, `manage`, `control`). Usage: `useTranslations()` without a namespace argument and full-path keys — `t('manage.settings.userSettings')`, `t('shared.generic.cancel')`; `t.rich` for markup. Messages load per page via `getStaticProps`; the plugin is wired in each `next.config.mjs` (`createNextIntlPlugin`).

## Forms

**Formik + Yup** (not react-hook-form). Design-system `Formik*` field components bind by `name`. Existing modals (e.g. `apps/frontend-manage/src/components/sharing/TransferOwnershipModal.tsx`) are the template.

## Element package workflow

Element import is a long-running, cancellable workflow rather than a boolean loading state. `apps/frontend-manage/src/lib/elementImportWorkflow.ts:ElementImportWorkflowState` is the tested discriminated reducer state for idle, upload, validation, review, commit, success, and error. `apps/frontend-manage/src/components/elements/manipulation/useElementImportWorkflow.ts:useElementImportWorkflow` combines `AbortController` cancellation with request-generation guards so close/replacement invalidates stale async completions, owns the import mutation and post-commit refetch, and translates its stable server error codes. `apps/frontend-manage/src/components/elements/manipulation/UploadModal.tsx:UploadModal` is the modal shell and phase renderer. The commit mutation is deliberately non-dismissible: the hook installs a native `beforeunload` prompt and restores/declines Pages Router history pops while the mutation is in flight, in addition to removing modal close controls and Escape. Once commit succeeds, those navigation guards are removed and the best-effort list refresh may be dismissed. Closing or unmounting invalidates that refresh generation so a late completion cannot dispatch, toast, or close a replacement modal. A list-refetch failure shown while the modal remains open is a committed-success warning with no import retry because retrying could duplicate content. `ImportedElementsOverviewTable` owns only selection and presentation.

Every independently scrollable import/export review region is keyboard-focusable and named, including the element preview, answer-collection entries, didactic answer pools, and selected-export list. Keep the visible focus ring when adding another bounded overflow container; a pointer-scrollable list without a focusable descendant is not an accessible review surface. Native `<summary>` controls retain `display: list-item` so their disclosure marker remains visible on touch and pointer devices.

The generic ZIP/image drop target lives in `components/common/FileUploadDropzone.tsx`; feature workflows configure it, while `MediaLibrary.tsx` owns only media listing and the SAS/upload/finalization flow. Package-to-form conversion in `lib/elementImportPreview.ts` derives its answer-collection model directly from the generated operation instead of importing a presentation-component type.

Import review state comes from the current Formik selection. Duplicate and answer-collection summaries update with every selection change, bulk actions share the same values, and one semantic list serves desktop and mobile layouts. The inline didactic review renders all applicable solutions, feedback, scoring settings, restrictions, criteria/cases, and complete answer pools for the nine supported element types (`apps/frontend-manage/src/components/elements/details/ImportedElementDidacticReview.tsx:ImportedElementDidacticReview`, `apps/frontend-manage/src/components/elements/manipulation/PackageAnswerCollectionOverview.tsx:PackageAnswerCollectionOverview`). Tags are intentionally absent because the package contract excludes them.

These modals keep the copyright/solutions and uncalibrated/no-psychometric-history notices visible. Successful validation focuses the named disclosure region before the selectable rows. Async regions and dynamic package warnings use `aria-busy` plus polite live status; import selections have labels and 44-pixel targets; the dropzone is keyboard-operable; and close restores focus to the originating import/export trigger (`apps/frontend-manage/src/components/common/FileUploadDropzone.tsx:FileUploadDropzone`, `apps/frontend-manage/src/pages/index.tsx:Index`). Export preview is fail-closed, retry restores a useful focus target, and closing aborts both link creation and package transfer. The interactive import preview stays outside the native commit form, exposes trigger state with `aria-controls`/`aria-pressed`, focuses its named region when opened, restores the originating trigger when closed, and resets preview-local pagination when another element opens. English and German messages use ICU plurals for counts.

Direct media upload has two success boundaries: blob upload plus authenticated fingerprint finalization is durable success, while refreshing the media-library query is best-effort cache synchronization. Finalization uses at most three calls with the same server-created media ID and short bounded backoff; retry both a `false` result and a rejected call because the mutation is idempotent. Invoke the editor callback exactly once after finalization and never turn a later refetch failure into an upload-failure retry. The dropzone declares PNG, JPEG, and GIF by their valid MIME types and explains unsupported selections locally. Create-only upload SAS tokens require the Azure SDK's single-request path, so `apps/frontend-manage/src/lib/mediaUpload.ts:DIRECT_MEDIA_UPLOAD_MAX_BYTES` caps direct uploads at 256 MiB and the dropzone rejects larger files before requesting SAS credentials.

## Gotchas absorbed from experience

- **Feature flags gate alone.** Don't combine a flag with data-dependent counts (`flag && count > 0`) — that creates chicken-and-egg visibility problems.
  - **Active Feature Flags:**
    - `privatePreview` (User-profile level): Gates advanced beta features such as element/activity sharing, microlearning, and administrator panels. Managed via the admin page (`apps/frontend-manage/src/pages/admin.tsx`).
    - `publicPreview` (User-profile level): Gates general preview features like microlearning analytics and new evaluation navigation interfaces.
    - `canUseElementImportExport` (server-computed runtime capability): Combines the import/export kill switch, assessment mode, full-access scope, and authoritative `privatePreview`. The profile-level capability fails closed to `false` if its persisted preview lookup is unavailable, so this optional feature cannot break the Manage shell or expose dependency text. The Manage element library fails closed while it is loading, hides both controls and modal state when false, and dynamically imports the package modals only when permitted. Do not gate this feature directly on `privatePreview` or a `NEXT_PUBLIC_*` environment variable.
  - _Tradeoff Rationale_: We intentionally skip a dedicated feature flag platform (e.g., Unleash/GrowthBook) to avoid infra complexity for a 2-4 developer team. User-profile fields are our standard flagging mechanism.
- **CSP `frame-ancestors` is set at the proxy, never in Next.js middleware.** Middleware CSP breaks `_next/data` routes in production builds (known Next.js bug). Production: HAProxy ingress annotations (`haproxy.org/response-set-header` in `deploy/charts/klicker-uzh-v3/templates/ingress-*.yaml`); local: Traefik `customResponseHeaders` (`util/traefik/rules_docker.yaml`).
- **Embedded PWA messaging**: use a parent-initiated `postMessage` handshake to capture `event.origin`; no `'*'` target origins and no second per-platform allowlist in page code — embedding permission is enforced by ingress `frame-ancestors`.
- **Local embed testing**: `util/embed-harness/` must target the branch-local PWA (`http://127.0.0.1:3101/...`), not the production PWA — production CSP blocks localhost embedding.

## Verification

UI changes are verified in a real browser (`npx agent-browser` for agents — see [Getting Started](./getting-started.md) agent addendum) with before/after screenshots, not by reading the JSX.
