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
   - Custom modal drawers use a neutral element with `role="dialog"` and `aria-modal="true"`; connect the launcher with `aria-controls` / `aria-expanded` / `aria-haspopup`, move focus into the dialog, trap Tab, restore focus on close, and make the background inert. Portal outside the page root before setting that root `inert` and `aria-hidden`.
   - For shared pagination, keep `All` explicitly opt-in, validate persisted page-size values, reset to page 1 on every page-size change, and verify finite/All/switch-back states in the browser. Keep bounded consumers opted out.
   - Course overview headers keep the participant count beneath the course name so metadata does not compete with actions. Use one contextual primary action and a labelled overflow menu for low-frequency actions; keep visible buttons and the overflow trigger in one action cluster, letting that cluster wrap as a unit across viewports.
   - Browser CSV imports parse files only after the file-selection event, validate required semantic headers and consistent row widths locally, submit generated-operation input types, and preserve row-level backend failures instead of reducing them to one generic batch error. Prefer a small dependency-free parser when the accepted CSV contract is deliberately narrow; verify duplicate headers, quoted fields, BOMs, delimiters, uneven rows, and malformed input in the real browser. Generate PII-free template downloads from canonical header constants. Treat affiliation-domain guidance as advisory when the identity provider is the authoritative verifier; do not replace verified identity claims with a suffix allowlist.
   - App typography comes from the shared local font definitions in
     `packages/shared-components/src/font.ts`; preserve their exports and CSS
     variables so production builds remain independent of external font
     services.
   - Forms: Formik + Yup. Conditional classes: `twMerge`. Feature flags gate alone — never `flag && count > 0`.
   - No Next.js middleware for CSP/headers — that belongs at the proxy layer.
   - KB graph panel: show the per-KB opt-in and localized billing/quota states before the rebuild control. Format current estimates, maxima, and quota values with the current persisted quota currency, and historical settled build cost with its recorded currency; treat persisted quota currency/limit drift as unavailable. Keep rebuild disabled when opt-in, cost configuration, or active-build conditions fail; display actual cost and usage only after settlement; keep provider credentials out of the browser; and map billing enums to localized text.
   - Assessment comparison charts use equal-width categorical bars and a
     labelled 0–100 percentile ruler; keep the exact range/count table and
     highlight the student's containing range.
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
- The KB navigation item is an interim `user.privatePreview` discovery gate. Direct catalog/detail URLs must render the localized `KB_PREVIEW_ACCESS_REQUIRED` service error for a non-preview lecturer; never rely on hidden navigation as authorization.
- The knowledge-resource Ingest action accepts only the resource identifier. Do not expose transport tuning in the UI unless the GraphQL and ingestion-platform contracts add a real user-controlled setting.
- Keep full KB attempt history out of the two-second detail poll. Load the bounded, owner-checked history query only when a lecturer expands a resource, while the parent query carries only the latest run needed for operation status.
- Localize KB failure detail from stable status/error codes. Do not render raw ingestion-platform status text into the EN/DE lecturer UI.
- Replacing a chatbot's enabled KB requires an explicit warning state; verify attach, replace, detach, linked-KB, and no-KB states in both locales and at desktop/mobile widths.
- KB delete copy must distinguish immediate removal from background external/blob cleanup; never claim that asynchronous cleanup completed in the mutation success toast.
- KB uploads expose only PDF, TXT, and MD up to 25 MiB while the ingestion bridge supports PDF/plain text; map Markdown to `text/plain` and do not advertise DOCX/PPTX prematurely. Localize stable quota codes rather than raw service messages.
- KB catalog/detail scale uses server-backed search/filter connections, design-system `SelectField` filters, and explicit load-more controls. While one row is active, poll page zero plus known active pages every two seconds and run a full loaded-window walk every tenth tick; fall back immediately on cursor/page-length drift. Preserve the latest loaded window across action refreshes, use `no-cache` promise queries for background polls, and invalidate in-flight refreshes when filters change. Use indeterminate operation progress, not fabricated percentages. Keep selection bounded to 50 and remove rows from selection when they become active. Keep bulk deletion behind a named confirmation, and expose source, operation-versus-serving state, contextual actions, and lazy history in the keyboard-accessible inspector.
- Treat a KB mutation and its follow-up query refresh as separate outcomes. After mutation success, close/reset and show success even when a best-effort refresh fails; log the refresh failure without surfacing a mutation error or encouraging a duplicate retry.
- KB metrics must distinguish visible data from quota usage, reservations, pending cleanup, unknown-size conservative claims, and linked consumers. Verify these states in EN/DE at desktop and 390 px widths.
- **`apps/chat` is out of scope here** — app router, zustand, assistant-ui; read [docs/chat-platform.md](../../../docs/chat-platform.md) and follow its local conventions instead.
