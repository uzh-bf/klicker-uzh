# Upgrade KlickerUZH to @uzh-bf/design-system 5.0.0-alpha.5

**Branch:** `rs/ds-v5-alpha5-upgrade` · **Worktree:** `trees/ds-v5-alpha5-upgrade` · **Base:** `origin/v3`
**Decisions:** [ADR 0011](../docs/adr/0011-uzh-theme-selected-by-root-data-attribute.md),
[ADR 0012](../docs/adr/0012-klicker-declares-token-names-not-values.md)

## Plan identity

| Field | Value |
| --- | --- |
| Plan | `project/2026-08-18-ds-v5-alpha5-upgrade-plan.md` |
| Branch | `rs/ds-v5-alpha5-upgrade` |
| Target | `v3` |
| PR | none yet |
| Ceremony tier | Full path — public contract, theming and styling surfaces across six apps |
| Topology | Single PR. Not stackable: `4.1.8` has no `./primitives` target and v5 removes the `Shadcn*` root exports, so the bump, the import rewrite and the CSS rework have no valid ordering apart from together. |

## Delegation Map

| Workstream | Slices | Owner | Acceptance |
| --- | --- | --- | --- |
| Dependency bump | 1 | main | `pnpm install` clean in-container, syncpack green |
| Mechanical import rewrite | 2 | executor | `pnpm run check` green, no `/ui` or `/forms` specifiers left, each rewrite matched to the door the call site used |
| CSS composition | 3 | main | Single-source artifacts appear once per app; app builds |
| Token audit and bridge | 4 | main | Audit table complete; no bare v5 runtime property redeclared; no utility resolves to an initial value |
| Theme opt-in | 5 | main | `data-theme="uzh"` present in all five shells |
| Visual review | 6 | main | Both variants captured across five apps; each survivor recorded with its reason |
| Verification | 7 | main | `check:all`, `build`, Playwright, computed-style sweep |

Slices 3 to 6 stay in the main session: they are the seam work this plan exists to decide,
and the review already showed the failure modes are silent rather than test-visible. Slice 2
is the one genuinely mechanical workstream with a named check.

## Test portfolio

| Risk | Existing protection | Obligation | Seam | Distinct failure | Slice |
| --- | --- | --- | --- | --- | --- |
| Wrong-door component import | TypeScript accepts both doors | none | `pnpm run check` plus visual review | A root component silently replaced by its primitive twin | 2 |
| Missing utility after token deletion | none | none | Computed-style sweep | `text-uzh-blue-60` resolves to an initial value | 4, 7 |
| Duplicate single-source CSS | none | none | Sentinel count on emitted CSS | Preflight or font-faces emitted twice | 3, 7 |
| Theme not applied | none | none | Visual review | Stock shadcn palette instead of UZH | 5, 6 |
| Existing behaviour regression | Playwright suite | extend existing | Playwright | A journey breaks on a changed component contract | 7 |

`No new test` is the declared outcome for the styling risks: they are computed-style and
visual properties that the existing suites cannot assert and that a bespoke test would
assert less reliably than the sweep and the review.

## Scope

One atomic PR. The upgrade cannot be stacked: `4.1.8` exports only `.`, `./ui` and
`./forms`, so the `Shadcn*` import rewrite has no `./primitives` target before the version
bump, and v5 removes those root exports, so it has no source after it. The bump, the import
rewrite and the CSS rework land together or the tree does not compile.

`apps/docs` is in scope for the version bump and its broken `@source` rule only — syncpack
enforces one exact version across all nine packages, so it cannot be left on `4.1.8`. No
theming, no full visual pass — but one smoke check, because importing the design system's
CSS injects preflight, forms base styles and font-faces into a site that deliberately
imports Tailwind without preflight (`custom.css:4-6`). Note that `custom.css` has no font
tokens at all, so the `--theme-font-primary` removal is a no-op there. Docusaurus sets
`data-theme` itself for its colour mode, which
collides with the design system's theme attribute; the ADR 0011 shell change is therefore
deliberately not applied there. `apps/docs/src/custom.css` is touched by slice 3 only —
its `@source` rule is removed and its `--theme-font-primary` reference goes with the font
change, so docs renders in the design system's neutral theme with v5's fonts. Its own
`@theme` block is out of scope for the slice 4 audit and is left as it is.

The react-hook-form migration is **not** in scope and is not currently possible. See
Deferred below.

## Pass criteria

1. Every app builds and renders, `pnpm run check:all` green.
2. Tailwind output compiles without duplicates, scoped to what can actually be
   deduplicated. The design system ships a full Tailwind build, so single-source artifacts
   must appear exactly once in each app's final CSS: preflight (`text-size-adjust`),
   `@font-face` declarations, and the design system's runtime token blocks. Plugin
   utilities are **excluded** from this criterion — Tailwind generates them on demand from
   each consumer's own sources, so overlap between the design system's build and Klicker's
   is inherent and value-identical. A sentinel like `.prose` or `--color-red-500` is
   therefore unachievable at 1 and is not used; counting it would fail a correct build and
   pass an incorrect one.
3. No missing styles — no Klicker-authored class resolves to an empty or initial computed
   value, and every token v5 needs is declared and applied.
4. Playwright green (`testIdAttribute: 'data-cy'`).

## Slices

### 1. Version bump and dependency reconciliation

Bump the nine `package.json` pins from `4.1.8` to `5.0.0-alpha.5`
(`apps/{auth,chat,docs,frontend-control,frontend-manage,frontend-pwa}`,
`packages/{markdown,shared-components,transactional}`). v5 externalises its peers, so add
any of `react`, `react-dom`, `formik`, `dayjs`, `lucide-react`,
`class-variance-authority`, `clsx`, `tailwind-merge`, `@fortawesome/*` that a consumer now
needs directly. Re-check `packages/next-config/index.js:54` — `transpilePackages` still
lists the design system, which is likely wrong now that it ships dist-only ESM.

Peers to check beyond the component libraries: `tw-animate-css`, `tailwindcss`,
`@tailwindcss/postcss` and `postcss` are all declared peers of v5.

*Check:* `pnpm install` clean, syncpack green.

### 2. Import rewrite to `./primitives`

Move the ~215 `Shadcn*` occurrences to the `./primitives` subpath under their new names.
The hazard is silent: `Collapsible`, `FormLabel`, `Label`, `Progress`, `Table`, `Button`,
`Checkbox`, `Select`, `Slider`, `Switch`, `Tabs` and `Tooltip` exist at **both** the root
and `./primitives` as different components, and TypeScript does not error on the wrong
door. Every rewrite is checked against which of the two the call site actually used.

Known non-problems, already verified: the root `Table` composite is unused, so its
`data`→`rows` / `dataAttributes`→`data` rename is moot; `dataAttributes`, `ThemeProvider`
and `customTrigger` have zero usages; tabs already carry both `id` and `data.cy`, so the
v5 change dropping caller ids from the DOM does not affect the 95 `getByTestId('tab-*')`
usages.

*Check:* `pnpm run check` green with no `@uzh-bf/design-system/ui` or `/forms` specifiers
left.

### 3. CSS entry rework

In each of the six stylesheets (`apps/{auth,frontend-control,frontend-manage,frontend-pwa}/src/globals.css`,
`apps/chat/src/app/globals.css`, `apps/docs/src/custom.css`):

- Delete `@source "../node_modules/@uzh-bf/design-system/src";`. v5 publishes `dist` only,
  and MIGRATION.md says delete the rule rather than re-point it at `dist`.
- Import `@uzh-bf/design-system/css` **first**, before Tailwind's own imports, and pin
  every import to an explicit layer (`layer(theme)`, `layer(utilities)`) the way
  `apps/docs/src/custom.css:5-6` already does. Import order is load-bearing for the font
  bridge in slice 4 and must not be left implicit.
- Stop emitting a second preflight: import `tailwindcss/theme.css` and
  `tailwindcss/utilities.css` rather than bare `tailwindcss`, and let the design system
  supply preflight once.
- Drop **only** `tailwindcss-animate`, the legacy plugin superseded by `tw-animate-css`.

**Keep every other plugin.** Tailwind plugins generate utilities on demand from the
consumer's own sources, so a precompiled `dist` can never cover Klicker's usage and the
overlap is not duplication in any meaningful sense. Typography is the clearest case: `dist`
contains no `prose-base`, `prose-lg`, `prose-xl` or any `prose-p:`/`prose-img:` modifier,
while Klicker uses `prose-p:` in 17 files and `prose-img:` in 14
(`packages/markdown/src/Markdown.tsx:200` and across shared-components, pwa, manage, chat).
Dropping it would silently unstyle every Markdown surface. The same argument keeps
`tw-animate-css`, which v5 declares a peer dependency precisely because consumers compile
their own usage. Aspect-ratio and container-queries stay because the design system does not
provide them.

*Check:* one copy of each **single-source** artifact per app — preflight
(`text-size-adjust`), font-face declarations, and the design system's runtime token blocks.
Overlapping on-demand plugin utilities are expected and value-identical; they are not a
defect and are not counted.

### 4. Token audit and shared bridge

Create one `packages/shared-components/src/theme.css` imported by all five themed apps,
using `@theme inline` for bridges. The directive is settled rather than experimental: v5
uses `inline` for exactly this job, and with theme state only ever on `:root` the two
directives are behaviourally identical for every current consumer while `inline` avoids
emitting a redundant `:root` property.

**Re-derive the audit table from scratch — do not work from an enumeration in this plan.**
The input is all 146 tokens in the four identical app blocks, plus `apps/chat`'s 93, and
every token gets a row with its verdict and evidence. The rule:

| Bucket | Verdict |
| --- | --- |
| Value override — v5 owns the token *and* Klicker's Tailwind does not need the name | Delete; v5's value wins |
| Namespace bridge — Klicker has live utilities for the name | Keep the name, value it `var(--theme-…)` |
| Extension — v5 does not ship it | Keep, usage count as justification |

The discriminator between the first two buckets is **whether Klicker's own build must emit
the utility**, not whether v5 declares the token. The compiled `dist` emits utilities only
for classes the design system's own source happens to use, so v5 declaring a token is not
evidence the utility exists.

`--color-uzh-blue-*` is the trap and must stay in bucket 2. `dist` emits only five uzh-blue
utilities — `bg-uzh-blue-20`, `bg-uzh-blue-100`, `border-uzh-blue-80`, `fill-uzh-blue-100`,
`text-uzh-blue-100` — while Klicker uses ten, including `text-uzh-blue-60` (5),
`text-uzh-blue-80`, `bg-uzh-blue-80` and the bare `text-/bg-/border-uzh-blue`. Deleting the
five names strands those with no build error. Keep the names, take v5's values.
`--theme-color-primary-*` genuinely deletes, because the `--color-primary-*` bridges carry
the 159 `-primary-N` usages across 105 files.

Fonts are the second trap. `--font-sans` is not a v5 runtime property — v5's runtime is
`--theme-font-sans` and its own bridge is `--font-sans: var(--theme-font-sans, …)`. Deleting
Klicker's `--font-sans` makes `@apply font-sans` fall back to Tailwind's system stack and
renders the entire UI in the system font while every stated check stays green. The shared
file must mirror v5's bridge for both `--font-sans` and `--font-mono`; the stale
`var(--mono-space-font)` first entry goes, which is what loses JetBrains Mono otherwise.
`packages/shared-components/src/font.ts` and its **six** call sites come out — the sixth is
`apps/frontend-manage/src/components/user/DelegatedAccessPassword.tsx`.

`apps/chat` needs separate treatment beyond its `@theme` block. It carries 32 shadcn runtime
tokens in an unlayered `:root:root` block (`globals.css:83-124`) whose elevated (0,2,0)
specificity deliberately out-ranks assistant-ui's `:root`. v5's `[data-theme="uzh"]` block is
unlayered at (0,1,0), so once slice 5 lands, chat's stock-zinc values beat v5 on every token
they share — the exact defect this slice claims to fix, in the one place the original audit
did not look. Re-value the block against `var(--theme-*)` while keeping its specificity;
delete it only on proof that assistant-ui no longer ships `:root` tokens.

Extensions carry real values and stay. The six UZH colour families beyond blue and berry are
extensions in effect but **not** Klicker-owned in origin: v5 declares all six at
`src/tailwind.css:50-91` with values identical to Klicker's and merely compiles them away as
unused. They should track v5's source rather than drifting from it. Usage: grey 114, red 77,
darkgreen 43, yellow 42, turqoise 35, lightgreen 35.

*Check:* no bare v5 runtime property name redeclared anywhere in Klicker, chat's
`:root:root` block included; and every Klicker-authored utility class resolves to a
non-initial computed value.

### 5. Theme opt-in

Add `data-theme="uzh"` to `<html>` in the four Pages Router `_document.tsx` files and in
`apps/chat/src/app/layout.tsx`, keeping the `dark` class handling as-is. Not applied to
`apps/docs` (see Scope).

### 6. Dual-variant visual review

The two variants are the bridge file's override rows present or absent, so this is two
builds of the same tree. Capture the same screen set for each across the five themed apps:
login, course list, a live quiz, an evaluation view, and one form-heavy editor.

This is a decision gate, not a screenshot exercise. Default is v5-native. A Klicker value
returns only where the review shows v5 is worse, and each survivor is recorded in the audit
table with its reason.

### 7. Verification

`pnpm run check:all`; `pnpm run build`; Playwright; preflight sentinel count per app; a
computed-style sweep over the UZH and primary utility classes proving none resolves to an
empty or initial value. Browser verification runs via `agent-browser` against this
worktree's own devcontainer stack, logging in with delegated access.

## Deferred — react-hook-form

Blocked upstream, not merely postponed. Klicker uses ten Formik wrappers across 221 call
sites; v5 alpha.5 ships only four RHF wrappers (`RhfTextField`, `RhfNumberField`,
`RhfSelectField`, `RhfMultiSelect`). Fifty-nine call sites have no RHF equivalent at all:
Switch 22, Datetime 12, Textarea 11, Pin 6, Date 4, Color 2, AlphaNumericPin 2. The
precondition for stage 2 is six further design-system wrappers.

There is no forcing function meanwhile — the Formik wrappers are `@deprecated` in v5 but
exported and functional, and `formik` remains a peer. They are removed in v6, which is when
this becomes urgent.

## Not covered by the six stylesheets

`packages/transactional` renders email templates through its own react-email pipeline and
uses `bg-uzh-blue-100` outside the app CSS entirely. It takes the version bump and nothing
else; leave its styling alone.

## Progress

- [x] Grilling complete, decisions ratified 2026-08-18
- [x] ADRs 0011 and 0012 written
- [x] Blocker cleared: `alpha: 5.0.0-alpha.5` published 2026-08-18T19:30Z
- [x] Independent plan review 2026-08-18: five blocking findings accepted and folded in
      (uzh-blue ramp stranding, typography and `tw-animate-css` drops, chat's `:root:root`
      block, the `--font-sans` bridge)
- [x] Slice 1 — dependency bump. Nine pins at `5.0.0-alpha.5`; lockfile carries 22
      alpha.5 references and zero 4.1.8. `@uzh-bf/design-system` stays in
      `transpilePackages`: removing it was tried and reverted in slice 2 (see below).
      No peers added by hand — `pnpm peers check` reports no design-system peer issue.
      Evidence: `pnpm install` clean, `pnpm install --frozen-lockfile` up to date,
      `syncpack list-mismatches` 788 valid with only the two pre-existing ignored groups.
      Test delta: 0 added / 0 changed / 0 removed.
      Simplifier: not required — mechanical version and config edits, 14 added / 13
      removed excluding lockfile and project docs.
      Slice review: not required — the only risk-adjacent edit is the
      `minimumReleaseAgeExclude` entry, which follows the convention already documented
      in `pnpm-workspace.yaml`, names one exact first-party version, and leaves the
      14-day policy intact for every other package. Escalate if that call is wrong.
- [x] Slice 2 — v5 API migration. 215 `Shadcn*` identifiers across ten files rewritten to
      the `@uzh-bf/design-system/primitives` entry point; six genuine v5 breakages fixed:
      `ForwardRefButton`'s props now omit `ref` and `asChild` (v5's `ButtonProps` is a
      union discriminated on `asChild`), two react-dnd connectors wrapped so the callback
      ref discards its return value (React 19 rejects a returning callback ref), two
      `size="icon"` props dropped where the call site already sized the root, three
      `variant="ghost"` replaced by `basic`, and three accessibility props added that v5
      now requires (`ariaLabel` on two icon-only header controls, `triggerAriaLabel` on
      the course colour picker).
      `@uzh-bf/design-system` restored to `transpilePackages` — without it Next treats
      the dist-only package as external, the server build loads formik's CommonJS copy
      while the app bundles ESM, and the two `FormikContext` objects fail prerender with
      `Cannot read properties of undefined (reading 'getFieldProps')`.
      Evidence: `pnpm run build` 22/22, `pnpm run check:all` 24/24.
      Test delta: 0 added / 0 changed / 0 removed — every change is a compile-checked
      call-site signature fix already covered by the build.
- [x] Slices 3-5 — CSS entry rework, shared token bridge, theme opt-in (`335d65563`)
      All six stylesheets now import `@uzh-bf/design-system/css` first and unlayered,
      then Tailwind's theme and utilities without preflight, so the base reset is emitted
      once. The dead `@source` scan of the package source is gone.
      The four byte-identical 166-line `@theme` blocks collapsed into
      `packages/shared-components/src/theme.css` (bridges plus the Klicker-only UZH
      families) and `theme-app.css` (ring and animation tokens the four Pages Router apps
      want but chat does not).
      `data-theme="uzh"` set on all five document roots; v5 defaults to `neutral`.
      Evidence: `pnpm run build` 22/22, `pnpm run check:all` 24/24, and for all five apps
      the built CSS emits the preflight exactly once, contains the `[data-theme=uzh]`
      block, and has zero self-referential custom properties.
      Test delta: 0 added / 0 changed / 0 removed — the assertions live on the built CSS
      and the rendered page, neither of which a unit test reaches.
- [x] Slice 4 (fonts) — `font.ts` and its six call sites removed (`35a12c138`)
      Each app's CSS now carries exactly the design system's six `@font-face` rules and
      no `next/font` duplicates; the browser still resolves Source Sans 3 with
      `document.fonts.check` true. The webfont assets under `shared-components/src/fonts`
      are now unreferenced and left in place pending a decision.
- [x] Slice 6 — dual-variant visual review
      Captured under `uzh`: auth login, manage library/activities/courses, PWA
      login/start/practice/course/microlearning/question flow, control, chat. Captured
      under `neutral`: manage library. Both variants render correctly and the neutral
      switch is live (primary turns black, font falls back to the system stack).
- [x] Slice 7 — verification (`ca3646566`)
      **Docs site repaired.** `apps/docs` was the sixth stylesheet and was missed: it has
      no `build` script, so `turbo run build` never covered it, and its `@source` pointed
      at the design system source tree v5 no longer publishes. Its Button, heading, Prose
      and Tag components were rendering unstyled. It now imports the published stylesheet
      and the shared bridges. Docusaurus owns `data-theme` on the html element for its own
      light/dark switch, so the UZH palette is selected by assigning the ten
      `--theme-color-*` variables on an unlayered `:root` instead. `docusaurus build`
      succeeds and every token class the site uses resolves.
      **Duplicates.** Each app emits every token utility exactly once — `.bg-primary-100`,
      `.text-primary-100` and `.bg-uzh-blue-100` all appear a single time. The 100-145
      repeated selectors per app are Tailwind 4's own output: breakpoint variants of
      `.container` and `@supports`-guarded `color-mix` fallbacks for opacity modifiers.
      Not attributable to the upgrade.
      **Missing styles.** Sweeping every `bg|text|border|ring|fill|…`-prefixed token class
      used across the six apps plus `shared-components` and `markdown` against each built
      stylesheet leaves eight unresolved, all in `frontend-manage` and `docs`, and all
      referencing numeric primary steps (30, 50, 200, 500-800) that Klicker's ramp has
      never had — `origin/v3` defines only 20 through 100. Pre-existing dead classes,
      untouched by this work.
      **Dark mode.** The design system's compiled CSS contains no `prefers-color-scheme`
      rule, so its components cannot flip dark on a viewer's OS setting while
      Klicker-authored surfaces stay light. The ratified class-gated variant holds.
      **Overlays, focus and mobile.** The user menu and the sort select render correctly
      as popovers (surface, border, radius and accent all resolving); a focused input
      carries the intended 3px ring; the PWA start screen, practice list, quiz start and
      question flow all render correctly at 390x844.
      **The auth consent checkbox is not a regression.** Its red border is app-authored —
      `!tosChecked ? 'border border-red-500 bg-red-100'` in `apps/auth/src/pages/index.tsx`
      — and is byte-identical to `origin/v3`.
- [ ] Final review of the integrated branch.

#### v5 re-tunes the component scale, and its migration guide understates it

Raised by review of the slice 6 captures: the screens look like the old design with the
spacing subtly off. That reading is correct, and the cause is the design system, not the
integration.

`MIGRATION.md` states "Colors, spacing, and layout are unaffected" and lists only two
entries under *Visual changes to verify* (`AvatarFallback` and `Tabs`). Comparing v4.1.8's
published `src/ui/*` against v5's `dist/ui/*` shows **30 of 46 primitives changed their own
sizing, spacing or type classes**. Verified against the literal class strings:

| Primitive | v4 | v5 |
| --- | --- | --- |
| `input` | `h-9 … text-base` | `h-10 … text-sm` |
| `table` cell | `p-2 px-2`, header `h-10` | `px-4 py-[13px]`, header `px-4 py-3 text-xs uppercase tracking-[0.06em] bg-muted` |
| `button` | `py-1.5 px-6 size-9 gap-1.5` | `h-8 / h-10 / h-12 px-4 px-5 text-sm` |
| `card` | `py-6 pt-6 gap-6` | `py-3.5 pt-3 pt-5 pb-2 pb-5 gap-1 gap-2` |
| `dialog` | `p-5` | `p-6 pt-4` |
| `dropdown-menu` | `px-2 py-1.5` | `px-2.5 py-0 h-9 pl-4 pt-1.5 pb-1` |
| `textarea` | `min-h-16 text-base` | `min-h-20` |
| `tooltip` | `text-sm` | `text-xs` |

Inputs and buttons get taller, table cells get roomier with smaller uppercase headers, and
cards get tighter. This is v5 doing it deliberately — it is not drift introduced here.

What was ruled out as a cause, each by measurement rather than inference: the design
system's compiled CSS is properly layered (`theme` / `base` / `components` / `utilities`),
so the apps' own utilities still win ties; its `base` layer is the complete Tailwind 4
preflight; every app's root `font-size` is unchanged at 16px; and an audit of the manage
question pool covering 160 elements and 560 property checks found zero spacing utilities
resolving to anything other than their declared value.

**Open decision.** Accept v5's new component scale as the product's new baseline, or pin
the previous values per primitive. Accepting is the smaller change and matches the ratified
rule that v5's values win; pinning means carrying overrides for roughly thirty primitives,
which is the maintenance burden this upgrade exists to shed.

#### Decisions taken during slices 3-5

- **The bridge must not reference its own name.** `@theme inline` still emits a `:root`
  row, so `--color-uzh-blue-60: var(--color-uzh-blue-60)` is self-referential and
  therefore guaranteed-invalid, silently blanking every utility built from it while the
  build, type check and linter all stay green. This was caught by grepping the built CSS,
  not by any check the repository runs. Every bridge now points at a distinct upstream
  (`--theme-color-primary*`, `--theme-color-secondary*`, the bare shadcn names, `--radius`).
- **UZH blue is mirrored, not bridged.** The design system declares the ramp as literals
  with no intermediate variable, so there is nothing to point at. `theme.css` therefore
  repeats v5's five values with a note to keep them in sync.
- **v5 re-values the ramp** — `#3353b7 → #001e7c` at the 80 step, and similarly down the
  scale, so the 80 step is now *darker* than the 100 step rather than a tint of it. Taken
  per the ratified rule that v5's values win; MIGRATION.md documents the escape hatch
  (override the five `--theme-color-primary*` on `:root[data-theme='uzh']`) if the ramp
  is judged worse. Secondary likewise moves from UZH red `#dc6027` to UZH berry `#bf0d3e`.
- **Chat's `:root:root` block was removed rather than re-valued.** Its documented purpose
  was to outrank shadcn defaults shipped by a dependency stylesheet, but the only vendor
  stylesheets chat loads today — `@assistant-ui/react-markdown`'s `dot.css` and katex —
  declare no such tokens. Keeping literals there would instead shadow the active
  `data-theme` and de-brand the app, which is the defect slice 5 exists to prevent.

### Notes carried into later slices

- `pnpm` enforces `minimumReleaseAge: 20160` (14 days). alpha.5 needed an exact-version
  entry in `minimumReleaseAgeExclude`, following the repository's existing convention and
  replacing the spent `4.1.8` entry. The lockfile is validated before resolution, so both
  versions had to be excluded during the transition via the union form the `ai` and
  `@ai-sdk/*` entries already use; the transitional half was removed once the lockfile no
  longer referenced 4.1.8.
- `apps/analytics` lint failed once under `turbo` while passing standalone: concurrent
  tasks raced on its `uv` virtualenv. Not a code failure; rerun before investigating.
- The `analytics` navigation item in `Header.tsx` carries an `as NavigationItemProps`
  cast that suppresses v5's new icon-only `ariaLabel` requirement. Removing the cast is
  a real accessibility fix but out of this slice's scope — decide with the user.
- `devrouter ensure` fails at `post-start` on the chat local MCP fixture
  (`localhost:1417` never becomes healthy). Unrelated to this upgrade on the evidence so
  far, but confirm it reproduces on `v3` before slice 7 depends on the runtime.
