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
   - When an existing button needs a tooltip, do not wrap it with the design-system `Tooltip`, which owns its own button trigger. Use a non-interactive sibling revealed on hover and focus-within, and associate it with the button through `aria-describedby`.
   - Keep element creation available while an activity wizard is open. Hide only the alternative activity choices, and preserve the active wizard when the element modal opens and closes.
   - For shared pagination, keep `All` explicitly opt-in, validate persisted page-size values, reset to page 1 on every page-size change, and verify finite/All/switch-back states in the browser. Keep bounded consumers opted out.
   - Course overview headers keep the participant count beneath the course name so metadata does not compete with actions. Use one contextual primary action and a labelled overflow menu for low-frequency actions; keep visible buttons and the overflow trigger in one action cluster, letting that cluster wrap as a unit across viewports.
   - Keep the course Practice Quiz overview as the combined Practice Pool and individual-quiz entry point, even when one quiz is published. Show the Practice Pool promotion through a standalone semantic link only when `SelfDocument` returns the exact `Participant` role; fail closed for every unresolved or other user state, and preserve the existing individual quiz links.
   - Practice completion returns to the course practice context, never the application home. The Practice Pool resets only its per-round UI progress and refetches before offering another round (server-side spaced repetition state decides the next selection); individual quizzes navigate back to the course Practice Quiz overview, embedded quizzes keep their in-place completion panel.
   - Icon-only actions get an accessible name and a hover/focus tooltip through the app-local `IconActionTooltip` pattern: one non-interactive relative `span.group` wrapper, the existing interactive child unchanged (own `aria-label`, `data-cy`, callbacks, disabled state), and a non-focusable `role="tooltip"` sibling revealed by `group-hover`/`group-focus-within` only. Never wrap a `Button` or `Dropdown` with the design-system `Tooltip` (it renders its own trigger and has no `asChild`), never nest interactive controls, and never use title-only disclosure. Sort toggles disclose the next action (`Sort descending` when ascending). See [docs/frontend-conventions.md](../../../docs/frontend-conventions.md).
   - Browser CSV imports parse files only after the file-selection event, validate required semantic headers and consistent row widths locally, submit generated-operation input types, and preserve row-level backend failures instead of reducing them to one generic batch error. Prefer a small dependency-free parser when the accepted CSV contract is deliberately narrow; verify duplicate headers, quoted fields, BOMs, delimiters, uneven rows, and malformed input in the real browser. Generate PII-free template downloads from canonical header constants. Treat affiliation-domain guidance as advisory when the identity provider is the authoritative verifier; do not replace verified identity claims with a suffix allowlist.
   - App typography comes from the shared local font definitions in
     `packages/shared-components/src/font.ts`; preserve their exports and CSS
     variables so production builds remain independent of external font
     services.
   - Forms: Formik + Yup. Conditional classes: `twMerge`. Feature flags gate alone — never `flag && count > 0`.
   - Normal library Element creation is the only caller that opts into draft-preserving dismissal. Route its modal close button, footer Close, and Escape through one Formik-values flush/readback guard; keep edit, duplicate, and template creation on the Escape-disabled default. See [docs/frontend-conventions.md](../../../docs/frontend-conventions.md).
   - Keep Create Element in the normal creation strip outside an activity wizard. During activity creation or editing, render it once in the centered wizard-navigation slot between the left cancellation controls and the right Continue or Save action; opening and closing the element modal must preserve the wizard. In this mode, keep library cards dense with a one-line content preview, the existing full-content hover/focus tooltip, and horizontal icon actions; retain the normal two-line preview and vertical icon actions outside the wizard. Keep status filters to one-line labels and expose their advisory descriptions through hover/focus tooltips associated with `aria-describedby`. See [docs/frontend-conventions.md](../../../docs/frontend-conventions.md).
   - Explain every Element type before selection: each picker option shows the existing type label plus a concise authoring description from `apps/docs/docs/tutorials/supported_element_types.mdx`, the type label stays the option's `shortLabel` so the selected trigger remains compact, and normal library creation shows one paired-language notice that the type cannot be changed after creation. Preserve existing values, ordering, and `select-question-type-*` `data-cy` hooks; keep edit, duplicate, and template semantics unchanged. See [docs/frontend-conventions.md](../../../docs/frontend-conventions.md).
   - A Boolean the user must decide explicitly stays `boolean | undefined` until chosen: use a design-system `RadioGroup` with stable Yes and No `data-cy` hooks, convert the radio string to a real boolean at the UI boundary, keep Save disabled and block keyboard/form submission while unset, and never send `undefined` to the mutation (no `?? false` fallback). See [docs/frontend-conventions.md](../../../docs/frontend-conventions.md).
   - No Next.js middleware for CSP/headers — that belongs at the proxy layer.
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
- **`apps/chat` is out of scope here** — app router, zustand, assistant-ui; read [docs/chat-platform.md](../../../docs/chat-platform.md) and follow its local conventions instead.
