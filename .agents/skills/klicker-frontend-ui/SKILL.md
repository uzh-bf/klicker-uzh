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
   - CODE: reuse `packages/shared-components/src/CodeEditor.tsx`; keep fixed Python/timeout policy outside authoring Formik state, preserve editor `aria-label`/`data-cy`, expose public tests only, and keep template authoring unsupported. Element-editor autosaves contain full authoring data, so store them in a versioned envelope bound to the authenticated lecturer id; reject and clear legacy, malformed, or mismatched entries before offering recovery or loading Formik. Artificial-preview type changes are effect-driven, so require a string response at the CodeMirror boundary rather than trusting the transient response discriminator alone. In the PWA, keep the submitted code plus receipt id in separate activity/stack-scoped storage, verify the authenticated participant id before recovery, reject stale active results after a terminal state, advance only on `COMPLETED`, and leave `FAILED` attempts editable. Practice quizzes may derive local completion from the completed receipt; microlearning must refetch the finalized participant evaluation once per completed receipt and write it to a participant-scoped `qi-code-*` key before enabling Continue. Show readback failures with an explicit retry instead of fabricating local points. Manage CODE evaluation is a simple per-test table; do not map it into generic chart types.
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
- **`apps/chat` is out of scope here** — app router, zustand, assistant-ui; read [docs/chat-platform.md](../../../docs/chat-platform.md) and follow its local conventions instead.
