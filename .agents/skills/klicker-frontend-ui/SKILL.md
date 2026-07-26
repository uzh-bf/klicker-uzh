---
name: klicker-frontend-ui
description: Build or change UI in the KlickerUZH pages-router frontends (frontend-manage, frontend-pwa, frontend-control, auth). Use for new pages/components, styling, forms, i18n strings, wiring generated GraphQL documents, and the mandatory browser verification of any visible change. NOT for apps/chat (app-router island — see docs/chat-platform.md).
---

# KlickerUZH Frontend UI Work

Conventions (design system, Tailwind v4, Apollo, i18n, CSP): [docs/frontend-conventions.md](../../../docs/frontend-conventions.md). This skill is the work loop.

## Work loop

1. **Find the template** — locate an existing page/component doing something similar in the same app and mirror it (e.g. `TransferOwnershipModal.tsx` for Formik modals). Don't invent structure.
2. **Build** with the checklist:
   - `@uzh-bf/design-system` components first; shared components via deep import (`@klicker-uzh/shared-components/src/<Name>`).
   - Data via generated documents from `@klicker-uzh/graphql/dist/ops` only — a new op means the codegen ritual in `klicker-graphql-api` runs first.
   - Every new user-visible string in BOTH `packages/i18n/messages/de.ts` and `en.ts`, matching namespace; access via full-path keys (`t('manage.…')`).
   - Every new interactive element gets `data-cy` (design-system prop form: `data={{ cy: '…' }}`); pick names consistent with the sibling elements.
   - Forms: Formik + Yup. Conditional classes: `twMerge`. Feature flags gate alone — never `flag && count > 0`.
   - No Next.js middleware for CSP/headers — that belongs at the proxy layer.
3. **Verify in the browser — mandatory, not optional.** Depending on your environment path:
   - **Inside Devcontainer:** Dev servers auto-start in the background. No need to start/stop them. View logs via `tail -f /tmp/dev.log`.
   - **Host-based Setup:** You are authorized to start the dev servers needed for this verification, and must clean up after with `./_down.sh`. Bring-up per [docs/getting-started.md](../../../docs/getting-started.md) (localhost `dev:raw` path works without secrets).
   - On bring-up / server failure → `klicker-environment-doctor`.
   - Open the changed pages with `npx agent-browser` (never bare `agent-browser`), log in via **delegated** access with the AGENTS.md test credentials (not Edu-ID).
   - Capture before/after screenshots of every changed state (including error/empty states you touched); check both locales if strings changed.
   - Iterate on issues you see yourself; hand to the user for manual verification only after your own pass succeeds.
4. **Pre-PR** — `klicker-testing-verification` checklist; attach the screenshots to the PR description.

## App boundaries

- `frontend-manage` (lecturer), `frontend-pwa` (student; also has a localforage offline side-channel for live-quiz answers — don't bypass `storageHelpers.ts`), `frontend-control` (mobile controller), `auth` (login flows — auth changes also need [docs/auth-model.md](../../../docs/auth-model.md)).
- Knowledge-base management is a reusable package mounted by `frontend-manage`: edit `packages/kb-management`, not duplicate app-local components. Verify `/resources/knowledgeBases` plus the detail route at desktop and mobile widths, both locales, and every changed empty/active/success/failure state.
- The knowledge-resource Ingest action accepts only the resource identifier. Do not expose transport tuning in the UI unless the GraphQL and ingestion-platform contracts add a real user-controlled setting.
- **`apps/chat` is out of scope here** — app router, zustand, assistant-ui; read [docs/chat-platform.md](../../../docs/chat-platform.md) and follow its local conventions instead.
