# DS v5 Component Review — Handoff to the Design-System Project

Date: 2026-08-19 · Branch: `rs/ds-v5-alpha5-upgrade` · Evidence: `@uzh-bf/design-system@5.0.0-alpha.5` compiled `dist/`, the UZH DF redesign bundle (DESIGN.md + preview pages), live browser measurement on the Klicker dev stack, and Klicker usage grep across six apps and two shared packages.

**Guiding principle for this handoff: fix in the DS, not in consumers.** Every recurring Klicker `className` override, `!`-important escape, or wrapper hack is treated as evidence of a missing DS default, variant, or token — the fix is specced DS-side. Klicker-side work is listed only where the issue is genuinely app-specific layout.

This document is continuously expanded during the review. Sections: (A) systemic defects, (B) token-model gaps, (C) component-by-component findings, (D) Klicker-side adherence backlog (what remains after the DS absorbs the rest).

---

## A. Systemic defects (fix before anything else)

### A1. Compiled-CSS delivery breaks DS responsive variants in every consumer

**Live rendering bug.** The compiled `/css` bundle emits the DS's utilities early in `@layer utilities`; the consumer's Tailwind build appends its own generated utilities to the same layer afterwards. Whenever consumer code uses a base utility whose responsive variant exists only in the DS block, the later base rule wins at every viewport.

- Measured: dialog header ships `text-center sm:text-left`; Klicker uses `text-center` in 32 files; the modal title computes `text-align: center` at 1280px. Every modal title renders centered.
- The dialog footer's `sm:flex-row sm:justify-end` survives only because no Klicker file happens to use `flex-col-reverse`. The failure is silent, per-consumer, per-utility.
- The README explicitly tells consumers **not** to `@source` the package, so every consumer following the docs is exposed.

**DS fix:** compile component-critical styles (header alignment, footer direction) into the components layer with media queries baked in, or change the documented consumption model to a mandatory `@source ".../design-system/dist"`.

### A2. Focus ring fires on mouse interaction and modal open

Radix auto-focuses the first focusable element when a dialog opens; browsers apply `:focus-visible` to programmatic focus, so the full focus ring renders on every modal open with no keyboard involved. Measured on the open delete-element modal: auto-focused button carries a white 2px offset + `#0028A5` 2px ring.

**DS fix:** the Modal/Dialog wrapper should move initial focus to the panel (non-interactive) or `preventDefault()` on `onOpenAutoFocus` so the ring appears only when the user actually tabs. Combine with the ring-token fix (B4): the specced ring is translucent `rgba(0,40,165,0.18)`, which would also soften the cases where the ring must appear.

### A3. MIGRATION.md denies the visual delta

"Colors, spacing, and layout are unaffected" — measured against v4.1.8, **30 of 46 UI primitives changed sizing, spacing, or type classes** (input `h-9→h-10, text-base→text-sm`, card insets, dropdown rows, tooltip `text-sm→text-xs`, checkbox 16→18px, accordion trigger to fixed 52px, control ladder 32/40/48). These are the redesign — intentional — but the guide denies them, so every consumer rediscovers them as "something looks broken."

**DS fix:** per-primitive before/after table in MIGRATION.md (a starter table exists in Klicker's `project/2026-08-18-ds-v5-alpha5-upgrade-plan.md`).

---

## B. Token-model gaps

### B1. Interaction states packed into the tint ladder

The redesign defines semantic interaction tokens — `primary-hover #3062FF`, `primary-pressed #001E7C`, `primary-container #CCD4ED`. v5 instead re-valued tint-ladder slots (`uzh-blue-80 := #001E7C`, `uzh-blue-60 := #3062FF`), breaking every consumer use of the ladder as tints (84 usages in 45 Klicker files) while the button still delivers neither the hover nor any pressed state (`hover:bg-primary-100/90` opacity trick, no `active:`).

**DS fix:** introduce `--primary-hover`, `--primary-pressed`, `--primary-container` tokens; restore the ladder to mechanical 25% fades; wire button/link/menu states to the new tokens.

### B2. Neutrals hardcoded as hex inside components

`border-[#E0E0E0]`, `text-[#666666]`, `hover:bg-[#FAFAFA]`, `text-[#111111]`, `bg-[#EFEFEF]` are baked into dist component class strings while a parallel shadcn oklch semantic set (`--border`, `--muted`, …) coexists. Consumers cannot re-theme neutrals, and the two systems drift.

**Scale, measured across the compiled dist (top-level + ui + forms): 168 arbitrary-hex occurrences** — `#111111` ×53, `#FAFAFA` ×39, `#E0E0E0` ×28, `#666666` ×24, `#EFEFEF` ×10, `#A3A3A3` ×6, plus off-spec one-offs `#333333` ×5 and `#252525` ×3 (colors that appear in no token spec at all). 20 dist files additionally bypass tokens with Tailwind `slate/gray/zinc` classes, and the DS's own class strings carry `!important` escapes (`text-foreground!`, `border-border!`, `bg-background!` ×5 each) — a sign the wrapper layer is fighting its own primitives.

**DS fix:** tokenize the DESIGN.md neutral set (`#111111/#3A3A3A/#666666/#A3A3A3`, `#FAFAFA` surface, `#E0E0E0` border, `#EFEFEF` divider) and reference tokens in components; ban arbitrary hex in component sources (a lint rule on the DS repo makes this permanent).

### B3. Only 2 of 7 corporate hue ladders shipped

`uzh-blue` and `uzh-berry` exist as ladders; grey, yellow, light green, dark green, turquoise (specced accents with 100/80/60/40/20 tints) are absent. Klicker mirrors them in `packages/shared-components/src/theme.css` as a stopgap — that mirror should be deletable.

### B4. Focus ring is solid primary instead of specced translucent

`--ring: var(--theme-color-primary)` (solid `#0028A5`) vs the spec's `rgba(0,40,165,0.18)` 3px. Klicker additionally overrides `--default-ring-width: 3px` in `theme-app.css` — both overrides should die once the DS ships the specced ring.

### B5. Open color questions shipped without a ruling

`GAPS-RESOLVED.md` names six questions needing a human design owner; v5 pre-empted two: berry `#BF0D3E` as secondary (spec said "unruled, avoided as fill pending a ruling"; DESIGN.md says secondary = `#DC6027`) and warning `#ffc845` (spec: gold `#F3AB00`). Needs an explicit ruling, then consistent tokens.

### B6. Type scale not exported

`.text-md` is baked once into the compiled CSS but not exported as a token/utility consumers can use; the compact heading scale (24/20/18/17) exists only implicitly in components.

---

## C. Component-by-component findings

Method: every `import { X } from '@uzh-bf/design-system'` across 860 source files was tallied, and every `className={{ slot: ... }}` override on a DS component was aggregated. A recurring override is read as a missing DS default or variant. Usage counts: Button 201, UserNotification 137, Modal 80, toast 78, headings H1–H4 ~114, Tooltip 36, Formik* fields ~90, Checkbox 23, Select/SelectField 39, Switch 14, Tabs 11+, Dropdown 9, Badge 9, Progress 9, Card 8, Accordion 6.

### Override economics (the headline numbers)

| Component | Usages | Overrides | Dominant pattern | DS remedy |
|---|---|---|---|---|
| Button | 201 | 138 (69%) | manual downsizing `h-7/h-8/h-9`, square icon buttons, semantic border colors | expose sizes consumers actually need (C2) |
| UserNotification | 137 | 99 (72%) | `text-base` bumps (19×), margin add-ons | larger default type, spacing guidance (C7) |
| Tooltip | 36 | 32 (89%) | `text-sm` bumps, `max-w-*` constraints | bigger default type + default max-width (C8) |
| Modal | 80 | 39 | width presets (`max-w-lg…5xl`, `w-full!`), `pb-*` fixes | `size` prop; conditional footer (C1) |
| FormikTextField | 35 | 61 slots | `tooltip: z-20` (15×), width plumbing | portal the label tooltip (C9) |
| H1–H4 | ~114 | 72 | `mb-0`/`m-0` (30+×) | drop baked-in heading margin (C11) |

Klicker adopts the DS `size` prop **zero** times — every density fix is a hand-rolled `h-*` override. Partly adherence debt, but the missing sizes below are real DS gaps.

### C1. Modal / Dialog

- Chrome matches the redesign (white, `#E0E0E0` border, `rounded-lg`, `p-6`, 520px, shadow) ✅.
- Title renders centered at all widths — systemic defect A1.
- The redesign preview's signature **full-bleed `#FAFAFA` footer band** (`padding:14px 22px; border-top:1px #EFEFEF`, panel `overflow:hidden`) is absent; v5 ships only an inset divider. The redesign bundle itself is split (preview has the band, its `Modal.jsx` doesn't) — DS should rule once; the band would align modal and card footers.
- `Modal.js` renders `DialogFooter` unconditionally → actionless modals draw a stray divider. **DS fix:** render footer only when actions exist.
- Auto-focus ring on open — systemic defect A2.

### C2. Button (legacy wrapper + ui/button)

- Borderless/basic variant paints `hover:bg-primary-20` — a filled, button-like hover overlay on things consumers use as plain links (Klicker: activity "quiz evaluation" links, navbar items; the `basic` variant appears in 50 files, 74 usages in manage alone). With `px-0` usages the overlay has vertical extent but no horizontal padding. **DS fix:** no filled hover on borderless buttons, or ship a true `link` variant; hover color belongs to `primary-container`/hover tokens (B1), not the ladder.
- Primary hover is `bg-primary-100/90` opacity, no pressed state — B1.
- Sizes: `sm/default/lg` = 32/40/48 exist and match the spec ladder, but **`icon` exists only at `size-10`** — Klicker hand-rolls `h-9 w-9` (7×) and `h-8 w-8` (4×) square buttons. **DS fix:** `icon-sm` (`size-8`) variant.
- Consumers hand-roll semantic outline buttons (`border-red-400`, `border-green-700` confirm/deny pairs in Klicker grading UI). **DS fix:** `destructive-outline` and `success` variants so status buttons don't bypass the token system.

### C3. Accordion

- v5 `AccordionTrigger` is a fixed `h-[52px]` — a six-section filter sidebar spends 312px on headers alone. No density/size variant exists. **DS fix:** size variants (`sm` ≈ 36–40px) or content-height trigger with padding tokens.

### C4. Checkbox

- Re-tuned to `size-[18px] border-[1.5px] rounded-[4px]` solid primary fill. Looks clunky in dense lists, amplified by the fat focus ring (A2/B4). Hex border via B2. **DS fix:** confirm 18px is the redesign intent, tokenize colors, and pair with the softened ring.

### C5. DropdownMenu

- v5 label restyled to 11px bold uppercase `#666` (`label-caps` treatment). Consumers that put usernames/dynamic content in the label slot get them capitalized ("TESTUSER1"). **DS fix:** reserve uppercase for a dedicated eyebrow slot or opt-in prop; don't transform arbitrary label content.
- Items: `h-9`, `focus:bg-[#FAFAFA]` — hex via B2.

### C6. Tabs

- Underline tabs match the redesign, but `TabsList` ships `inline-flex w-fit ... border-b` — the underline track only spans the tabs' content width, so any container wider than the tabs shows an abruptly ending rule (PWA login). **DS fix:** default the list to full-width with a spanning `border-b` track (opt-out available).


### C7. UserNotification (137 usages — Klicker's alert workhorse)

- v5 default is `p-2 text-sm`; Klicker bumps to `text-base` in 19+ places and adds `mt-/mb-` margins in ~30. **DS fix:** raise the default to the redesign alert spec (`padding: 12px 16px`, body-sm/base type) or ship a `size` variant; document stacking spacing.
- v5 fills use tinted status backgrounds (`bg-warning-background` etc.); DESIGN.md says alert backgrounds **stay white** with colored text/icon only, while the bundle's own `Alert.jsx` uses tinted fills — same internal split as the modal footer band. Needs one ruling (ties into B5 status-hue question).

### C8. Tooltip

- v5 re-tuned to `text-xs` on `bg-[#252525]` with no max-width. Klicker overrides with `text-sm`/`md:text-base` plus `max-w-*` in 29 of 36 usages — a 89% override rate is a wrong default, not consumer preference. **DS fix:** `text-sm` default, a default `max-w` (~20rem), size variant for the rare compact case; tokenize `#252525` (B2).

### C9. Form fields (Formik + plain)

- The label tooltip in `forms/TextField.js` renders inline with `z-10`; Klicker raises it to `z-20` in 15+ places because it loses to sticky toolbars and modal chrome. **DS fix:** render the label tooltip through the portaled `ui/tooltip` (`z-50`) like every other overlay, and delete the inline z-index.
- Width plumbing (`root: w-full`, `label: w-36`, `field: w-96`) is repeated ad hoc; a `fullWidth` prop and a documented horizontal-label layout would absorb most of it.

### C10. Modal sizes

- v5 `Modal` exposes only `fullScreen`; consumers hand-roll widths (`max-w-lg`, `max-w-2xl`, `max-w-3xl`, `max-w-5xl`, `xl:w-220`, `w-full!` — 15+ distinct width overrides in Klicker). **DS fix:** `size="sm|md|lg|xl|full"` presets on the 520px base, so consumer modals stay consistent.

### C11. Headings H1–H4

- Every heading bakes in `mb-[0.2em]`; app UIs manage spacing with layout `gap`, so Klicker zeroes the margin 30+ times (`mb-0`, `m-0`). **DS fix:** UI headings default to `mb-0`; the 0.2em rhythm belongs to `Prose`/long-form contexts only.
- `H4` uses `text-md` — the one place the custom token exists — but the token itself is not exported for consumers (B6).

### C12. Badge

- v5 default badge = solid `bg-primary` white text, `rounded-sm`. The redesign specs the badge as **container tint** (`#CCD4ED` fill, primary text, `rounded-lg`) — and "badge default fill" is one of the six explicitly unruled questions in GAPS-RESOLVED.md. v5 shipped a third option instead. **DS fix:** get the ruling, then implement it; container tint is the spec-consistent recommendation.

### C13. Navigation

- Disabled items use `text-slate-400!` — a non-token neutral (B2 violation) with an `!important` escape inside the DS itself. **DS fix:** `--disabled` token (`#A3A3A3` per spec).

### C14. Table

- Header treatment matches the redesign (uppercase 12px, tracked, muted band) ✅.
- Every body cell ships `whitespace-nowrap` — long content can't wrap, forcing consumer-side overflow handling. Worth revisiting as a default; `py-[13px]` is also an off-scale one-off value.

### C15. Dual API surface: 35 legacy wrappers beside 53 `ui/` primitives

v5 ships the legacy component set (`Modal.js`, `Button.js`, `Dropdown.js`, `UserNotification.js`, `Formik*.js`, …) in parallel with the shadcn-derived `ui/*` primitives. All 860 Klicker files import the legacy names. Consequences:

- Most defects in this review live in the wrapper layer (Modal's unconditional footer, Button `basic` hover overlay, TextField's inline `z-10` tooltip), not in the primitives.
- Straight duplication exists: `UserNotification` (legacy) and `ui/alert` (new, with the redesign's variant treatment) are two alert systems with different looks.
- The two layers even render visibly different controls: legacy `Switch` sizes are `w-10/12/16` × ~21–30px against `ui/switch`'s `w-8 h-[1.15rem]`; legacy `Progress` is `h-7` against `ui/progress`'s `h-2`. A consumer mixing layers gets two different design languages on one page.
- **DS fix:** a convergence plan — pick the canonical layer per component, align wrapper styling with the primitive underneath, publish deprecation guidance (ideally codemods) for the rest. Without it, consumers integrate against the layer that gets the least design attention.

---

## D. Klicker-side adherence backlog

Remains Klicker's own work after the DS absorbs the above:

1. **Now, independent of DS:** adopt `size="sm"`/`size="icon"` Button props in place of the ~30 hand-rolled `h-7/h-8/h-9` overrides (DS `sm` = 32px exists and is unused); remove the eight dead numeric primary classes (`primary-30/50/200–800`); sweep app-authored slate/gray chrome toward DS neutrals; replace the PWA header dropdown's fake separator (`item: 'h-1.5!'`) with the DS separator and move the username out of the label slot.
2. **Batch-operations modal** (`frontend-manage`): fixed-width column layout overflows with v5's larger controls — responsive re-layout.
3. **Dense surfaces adopt `sm` sizes** (32px ladder) where v5's 40px default costs too much screen: question pool tables, filter sidebar, control app.
4. **After B1:** migrate the 84 ladder usages — selected/hover surfaces to the new state tokens, true tints back to the restored ladder.
5. **After B3:** delete the ladder mirror in `packages/shared-components/src/theme.css`.
6. **After B4:** drop the `--default-ring-width/color` override in `theme-app.css`.
7. **After B5:** confirm or revert berry secondary across Klicker surfaces.
8. **After A1:** re-verify all DS responsive variants render (modal titles left-align).

---

## Evidence log

- Utility-ordering proof: live stylesheet scan on manage, 2026-08-19 — `[@layer utilities][(min-width:40rem)] .sm\:text-left` precedes `[@layer utilities] .text-center` in the same compiled sheet.
- Modal measurements: computed styles on the open delete-element modal (panel 800px via Klicker override `w-full! max-w-200`, padding 24, radius 8, border `#E0E0E0`, footer transparent + `border-t #EFEFEF` inset, title 18/600 centered).
- Primitive delta: 30/46 primitives changed vs 4.1.8 (`npm pack` diff), table in `project/2026-08-18-ds-v5-alpha5-upgrade-plan.md`.
- Published visual evidence: 23 screenshots (contact sheet + redesign reference vs live modal), gap-review artifact (9 items) — internal links in session notes.
