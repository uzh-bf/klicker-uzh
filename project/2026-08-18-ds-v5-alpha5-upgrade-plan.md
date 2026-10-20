# Upgrade KlickerUZH to @uzh-bf/design-system 5.0.0-alpha.5

**Branch:** `rs/ds-v5-alpha5-upgrade` · **Worktree:** `trees/ds-v5-alpha5-upgrade` · **Base:** `origin/v3`

## Approval summary — 2026-10-20 pilot resumption

**Approval mode:** executable batch, approved by the user on 2026-10-20.

The historical pilot at commit `1de7ad9` has not accepted the final candidate
tarball because its canonical Auth development server returns 404 for the
NextAuth catch-all route before the handler runs. The same source under
Webpack returns the configured providers response. This proposal changes only
Auth’s three development scripts to use Next.js’s documented Webpack option;
production builds and authentication policy remain unchanged.

After that repair, the plan installs the exact design-system tarball identified
below through a temporary relative file reference, checks its installed bytes,
and runs the consumer build plus synthetic browser journeys. It removes a
consumer override only when the candidate and a real interaction prove the
override redundant. Formik support and application-specific layout remain
part of acceptance.

The prior design-system roadmap ruling approved direction and plan construction
only. The user approved the named source work, checks, reviews, commits, normal
push to the existing task branch, and a draft PR targeting `v3`. Merge,
readiness, release, deployment, human-review notifications, and container
replacement remain outside this approval. The 2026-10-20 stop returned
`stopped: true` and routes remain at zero, but Devsy still reports `Busy` and
the `devpod` executable is unavailable. If acceptance requires replacing the
runtime, request that exact effect after completing independent source work.

## Execution details — 2026-10-19 pilot resumption

### Evidence and binding contracts

- The work resumes in this plan, branch `rs/ds-v5-alpha5-upgrade`, at
  `1de7ad918145cf659e547057d04c448fb9a255fd`. No live PR exists. The fresh
  task context reports the primary checkout on `v3-ai` with upstream
  `origin/v3-ai`; the separate task worktree tracks `origin/v3`. For this
  worktree, `v3` is the resolved target: repository guidance says feature
  branches start from `v3`, `origin/HEAD` is `origin/v3`, and the existing plan
  agrees. Keep the primary checkout's 85-commit upstream drift separate from
  this worktree's 15-ahead/454-behind relationship to `origin/v3`. The refs were
  refreshed by the host shortly before this plan update; a sandboxed fetch
  could not write the linked worktree's `FETCH_HEAD`.
- Current `origin/v3` differs in `apps/auth/package.json`, the Group Activity
  wizard, frontend conventions, the root manifest, and the lockfile. Preserve
  the historical baseline through exact-candidate acceptance as the approved
  pilot-first direction requires. Near readiness, make one deliberate merge of
  the refreshed `origin/v3` into this task branch if the overlapping changes
  still materially affect delivery; record the target SHA and re-run affected
  checks and browser acceptance. Preserve the branch history and user changes.
  If a conflict requires a product or behavior choice, pause for that decision.
- The exact candidate is
  `project/_local/ga-qualification-candidate/uzh-bf-design-system-5.0.0-alpha.5.tgz`
  under the design-system repository’s `trees/rs-v5-uzh-alignment` worktree.
  Its expected SHA-256 is
  `f4208e6faebade6d775e663e43cebac8f7e27d46b70ab464a9ce2e3a99ec49a9`.
  The design-system owner has not published this candidate. Recompute its hash
  before install and verify all nine workspace links resolve to the archive-
  backed package. Compare the complete installed file set and hashes against
  the tarball. A matching version string is insufficient. The consumer PR will
  retain registry dependency references, so its body must distinguish the
  local candidate acceptance from the package installed later by CI.
- The binding direction-only ruling is in the design-system repository’s
  `project/2026-08-10-v5-ga-readiness-roadmap.md`, section “Next package —
  Klicker pilot routing and exact-package acceptance”. The candidate’s manual
  procedure is in `project/2026-10-19-v5-ga-qualification-plan.md`, section
  “Candidate and manual acceptance”. Both are read-only inputs owned by the
  design-system task.
- The prior same-source diagnostic used Next.js `16.2.10`: Turbopack returned
  404 from `/api/auth/providers` without entering the catch-all handler, while
  Webpack returned the existing providers JSON and entered it. The
  [Next.js development guide](https://github.com/vercel/next.js/blob/v16.2.9/docs/01-app/02-guides/local-development.mdx)
  documents `next dev --webpack`; its versioned docs are `16.2.9`, the nearest
  Context7 release available during planning. The change therefore uses a
  supported dev-only option and does not edit the NextAuth handler or auth
  options.
- Current runtime evidence is preserved in the ignored local report
  `project/_local/reviews/2026-10-19-ds-v5-alpha5-pilot-runtime-diagnostic.md`.
  This checkout reports legacy/full runtime mode. Devsy reports the exact
  workspace `Busy`, and devrouter reports zero routes. The exact canonical stop
  completed on 2026-10-19 (`stopped: true`, zero routes freed); a fresh
  source-path workspace readback shows `ownerStatus: present`, `devpodStatus:
  owned`, `routeCount: 0`, and no hosts. Devsy still reports `Busy`, so provider
  state is not verified `stopped`; do not claim runtime release complete. Exact
  stopped containers retain references to a Compose network that the prior
  diagnostic reported absent.
  Devrouter `0.5.2` documents `ensure --repair` for retained managed runtimes;
  the tagged [`workspace-ensure.ts`](https://github.com/rschlaefli/devrouter/blob/v0.5.2/src/core/workspace-ensure.ts)
  path does not start or recreate a provider workspace for this checkout’s
  legacy configuration. Normal `ensure` may trigger provider recreation, so it
  is not treated as a non-destructive repair. Do not delete or replace its
  containers, network, volumes, or workspace without separate approval.
- Context7’s devrouter resolver still returns an unrelated library after the
  user added devrouter. Planning used the official versioned CLI source and
  current lifecycle guide directly; this lookup limitation does not change the
  runtime authority boundary.

### Research

- Question: can the Auth catch-all use a documented bundler option without
  changing production behavior? The Next.js 16.2.9 guide documents
  `next dev --webpack`; the app is pinned to 16.2.10. The same-source browser
  differential is the exact consumer evidence. Research owner: main session.
- Question: does current repair safely restore this runtime? Context7 still
  resolves an unrelated library. The official Devrouter 0.5.2 source and
  lifecycle guide show `ensure --repair` is for retained managed runtime state;
  this checkout reports legacy mode and no managed state. Research owner: main
  session. No provider mutation or container recreation is inferred from this
  documentation lookup.
- Question: how can the repository checks bypass Turbo's cache? The pinned root
  build script invokes `turbo run build`; the official [Turborepo run
  reference](https://turborepo.dev/docs/reference/run) documents `--force` and
  `TURBO_FORCE`, and [pnpm 11 script
  docs](https://pnpm.io/11.x/cli/run) confirm that arguments after the script
  name are forwarded to it. Use `TURBO_FORCE=true pnpm run check:all` and
  `pnpm run build --force`. Research owner: main session.

### Scope, invariants, and exclusions

- Change `apps/auth/package.json` scripts `dev`, `dev:offline`, and `dev:test`
  from `--turbopack` to `--webpack`. Keep `build` and `build:test` on
  Turbopack. Update `docs/frontend-conventions.md` to record the Auth
  development exception.
- Preserve the catch-all route, credentials provider, callback/session
  configuration, cookie names, middleware, and all authorization behavior.
  Do not add an auth bypass, dependency, migration, major upgrade, or route
  handler workaround.
- Use only the local seeded lecturer and synthetic course/activity data. Do
  not reset the database or inspect real application content.
- Keep Formik wrappers and application-specific layout. Inspect the existing
  tooltip `z-20` overrides in
  `apps/frontend-manage/src/components/activities/creation/groupActivity/GroupActivitySettingsStep.tsx`;
  remove them only if they are redundant with both the exact candidate and the
  dependency source restored for the consumer PR. If they work only with the
  unpublished tarball, retain them until that candidate is published. Retain
  width, density, and layout overrides unless an equivalent behavior is
  demonstrated at both widths.
- Initial acceptance qualifies the historical pilot baseline. After the single
  target integration, recheck the Auth route and Group Activity flows on the
  integrated PR head. This does not qualify the whole current `v3` trunk, all
  consumers, GA, Safari, screen readers, or physical devices.
- Existing ADRs 0011 and 0012 remain accurate. This development-tool routing
  fix changes no product primitive or public contract and does not require a
  new ADR.

### Ownership and sequence

| Workstream | Owner | Dependency | Acceptance |
| --- | --- | --- | --- |
| Auth development routing and its local-workflow documentation | One executor after plan approval | None | Three Auth development scripts use Webpack; build scripts and auth source are unchanged; route and delegated login checks pass |
| Candidate install, consumer checks, and browser acceptance | Main session | Runtime available and Auth routing change applied | Exact archive installed and byte-verified; Auth and Manage resolve it; builds and synthetic journeys pass |
| Override retirement, when supported by both candidate and delivered dependency | Main session | Browser comparison complete | Each removed override is shown redundant with the resolved package that the PR will install |
| Integration, review, and draft delivery | Main session | Accepted checks and reviewer findings | Reviewed source, exact-head CI disposition, accurate draft PR, screenshots published and read back |

#### Commit boundaries

- `fix(auth): restore local catch-all route` contains the three Auth development
  script changes, the frontend conventions update, and the approved resumption
  plan section. It does not change the NextAuth handler or policy.
- If the candidate and the delivered registry dependency both prove specific
  overrides redundant, `enhance(design-system): remove proven redundant
  overrides` contains only those override removals and their progress update.
  Omit this commit when no override meets that evidence condition.
- After draft creation, update the same plan with its PR link and final status
  in a normal documentation commit. No plan-only PR is created.

The main session owns plan integration, the Auth/runtime seam, the exact
candidate and data boundary, acceptance, reviews, and final proof. The finite
sequence is:

1. Change only the three Auth development scripts and
   `docs/frontend-conventions.md`. If this fails to restore the documented
   catch-all route, stop before editing the handler, middleware, auth options,
   or another source file. That would change the approved seam.
2. Once the exact devcontainer is available, copy the supplied tarball into the
   ignored consumer path under `project/_local/ga-qualification-candidate/`.
   Temporarily change the nine existing design-system dependency entries to
   the relative
   `file:../../project/_local/ga-qualification-candidate/uzh-bf-design-system-5.0.0-alpha.5.tgz`
   reference. Generate a temporary lock resolution with pnpm 11.5.0, then run
   `pnpm install --frozen-lockfile`. Verify each of the nine workspace links
   resolves to the archive-backed package, then compare the complete installed
   file set and hashes with the archive. Restart only the Auth and Manage app
   processes through the supported runtime helper, then confirm their resolved
   package entries point to the candidate-backed install. Keep the temporary
   references and exact candidate installed through browser acceptance. Record local
   candidate evidence separately from registry-package CI evidence.
3. Use the required `agent-browser` against the exact routed checkout with
   synthetic local data. Verify `/api/auth/providers` and `/api/auth/csrf`
   return normal JSON responses, record status and response shape without
   printing provider options or the CSRF token, then complete delegated login.
   In the Manage Group Activity wizard, open a synthetic draft, cancel it,
   reopen and confirm its default values, then submit an invalid date interval
   and confirm no activity is created. Create one valid synthetic activity.
   Use the completion step’s “Create another activity” action to verify form
   reset, then exit without creating a duplicate. Reopen the synthetic activity
   in edit mode, change and save it, and confirm the persisted state after
   reload. Exercise the `FormikDatetimePicker` help/picker, focus return, and
   the three tooltip overrides in `GroupActivitySettingsStep`. Open the
   read-only `ActivityDetailsModal` for keyboard entry, Escape dismissal, and
   compact table scrolling; use `CourseGamificationInfos` for tab-arrow
   navigation. The relevant implementations are
   `GroupActivityWizard.tsx`, `CompletionStep.tsx`,
   `GroupActivitySettingsStep.tsx`, `ActivityDetailsModal.tsx`, and
   `CourseGamificationInfos.tsx`. Capture the changed states at `1440x900` and
   `390x844` in English and German.
4. Build and inspect the screenshot manifest at
   `project/_local/ds-v5-alpha5-pilot-gallery/manifest.json`. Record source
   revision, runtime, viewport, locale, synthetic-data status, interaction
   results, and any coverage gap. Keep screenshots out of Git.
5. After browser acceptance and gallery capture, restore only the nine
   temporary dependency specifiers to their post-source baseline and restore
   `pnpm-lock.yaml` from that baseline; preserve Auth script changes. Do not
   reinstall, because that would replace the exact candidate in `node_modules`.
   Verify the installed links still resolve to the candidate, the package
   specifiers and lock match their baseline, no tracked local `file:` reference
   remains, and all three Auth scripts still use Webpack. Run
   `TURBO_FORCE=true pnpm run check:all` and a fresh
   `pnpm run build --force` in the exact devcontainer while the candidate
   remains installed. These checks prove the source tree against the local
   candidate; they do not prove what the registry will serve. Stage explicit
   source paths and run gitleaks on staged content on the host. The host hooks
   invoke those same pnpm commands, but container-dependent checks must stay in
   the devcontainer. After equivalent checks and the host secret scan pass,
   set `HUSKY=0` only for host commit/push operations. Record this hook split;
   do not skip equivalent checks or CI secret scanning.
6. Commit the Auth fix as
   `fix(auth): restore local catch-all route`. Include the plan resumption
   section with this slice. Review the immutable Auth commit with the configured
   slice reviewer and simplifier in parallel. Apply valid findings, run affected
   checks, and re-review the corrected commit. Keep all dependency overrides
   for now.
7. At readiness, fetch `origin/v3` on the host, record its exact SHA, and begin
   one `git merge --no-commit --no-ff <target-sha>` into the task branch. Resolve
   conflicts only from verified source evidence and stop for any behavior
   decision. Once conflicts are resolved, preserve the resulting manifests and
   lockfile under the ignored `project/_local/merged-dependency-baseline/` path.
   If candidate dependencies need reinstalling, temporarily use the same
   archive references, regenerate the temporary lock resolution with pnpm
   11.5.0, then run `pnpm install --frozen-lockfile` and repeat the full file
   and hash comparison at all nine consumer resolutions. Run the affected Auth
   checks and Group Activity browser acceptance on the integrated tree, then
   restore temporary dependency references and lockfile changes to the resolved
   merged baseline while retaining the verified candidate installation.
   Reconfirm its bytes. Run `TURBO_FORCE=true pnpm run check:all` and
   `pnpm run build --force` in the devcontainer against this integrated tree.
   Run gitleaks and inspect all staged content. After these checks pass, create
   the merge commit with `HUSKY=0` for that host Git operation.
   If the exact registry dependency is available, install it from the restored
   merged baseline with `pnpm install --frozen-lockfile`, verify the resolved
   package bytes, and compare it to the local candidate. Perform the relevant
   browser checks in both viewports and locales before considering override
   removal; otherwise retain every override. If an override is proven redundant
   with both packages, run `TURBO_FORCE=true pnpm run check:all`,
   `pnpm run build --force`, and its browser checks against the registry package
   before a separate commit and staged-content scan.
   Review the integrated task changes with the configured slice reviewer and
   simplifier in parallel, then run one integrated final reviewer on the
   complete committed result after all findings, corrections, and checks are
   complete. The runtime stays active through integration, correction, build,
   and browser checks. Then stop the exact owned runtime with canonical
   `devrouter stop` and verify provider state `stopped` and exact route count
   zero. No container replacement is authorized here.
8. Inspect the full branch delta against the resolved `v3` target. Push normally
   to the existing task branch and create/update one draft PR using
   `rs-mr-description-writer`. State that the candidate tarball SHA was tested
   locally while the PR restores registry dependency references. Publish the
   inspected synthetic gallery through the existing project and verify the
   uploaded images. Commit and push the final plan progress with the PR link,
   then wait for exact-head hosted CI and ordinary feedback to settle. Run the
   repository-authorized `/final-review` on that settled head. For any finding,
   correct the source, resume the exact runtime only if an existing workspace
   can be reused without replacing containers, rerun invalidated checks and
   reviews, settle CI on the corrected head, and stop/verify the runtime again.
   If runtime resumption requires container replacement, stop at that concrete
   authority gate. If CI cannot install the registry package because it is
   unpublished, keep the PR draft and record that dependency blocker. Do not
   request human reviewers or mark the draft ready.

### Verification portfolio

| Risk | Existing evidence | Test obligation | Required check | Distinct failure |
| --- | --- | --- | --- | --- |
| Auth catch-all is absent in canonical local development | Same-source Webpack/Turbopack differential | None — use direct API and browser checks | Providers and CSRF HTTP/JSON checks plus synthetic delegated login | Route returns 404 or handler does not enter |
| Wrong design-system artifact is installed | Supplied SHA-256 and package version | None — verify package bytes | Recompute archive SHA; compare all consumer resolutions, installed files, and Auth/Manage process resolution | Installed files differ despite `5.0.0-alpha.5` label |
| Formik and changed defaults regress a real consumer flow | Existing package builds and prior historical screenshots | None — use real synthetic journeys | Frozen install, forced `TURBO_FORCE=true pnpm run check:all`, fresh `pnpm run build --force`, and browser journeys | Type/build failure, invalid-state loss, failed save/reload, clipping, or broken keyboard interaction |
| A consumer override is removed too early | Existing overrides and old screenshots | None — do not add snapshot assertions | Before/after browser evidence at both widths and locales, against the candidate and delivered dependency when available | Tooltip layering, modal sizing, or application layout regresses |
| Runtime cleanup is overstated | Source-path status and route listing | None | Canonical stop plus fresh Devsy/provider and route readback | Provider remains Busy or exact routes remain |

No maintained test is planned: direct API and real-browser interactions cover
the affected contracts better than a new test pinning package copy or prose.
The screenshot table is required for the visible candidate defaults and Auth
login flow. A missing runtime or browser leaves those checks blocked; a source
build alone cannot satisfy acceptance.

### Authority and terminal

**Boundary owner:** main session.

**Authority:** the user approved on 2026-10-20 the named Auth development fix,
exact-artifact qualification, evidence-supported override removals, one
readiness integration of refreshed `origin/v3` into the task branch, the listed
reviews, commits, normal push to the existing task branch, and a draft PR
against `v3`. This is one executable batch.

**Withheld:** container/workspace deletion or replacement, force/protected or
default-branch pushes, merging the task branch into its target, ready state,
release, deployment, production access, real-environment content, and human
reviewer notifications. The one readiness integration of refreshed `origin/v3`
into the task branch is part of this plan; it does not authorize merging the
task branch into `v3`. If the only runtime recovery requires replacing existing
containers, ask separately after the independent source work is complete.

**Terminal:** a reviewed consumer draft with exact-artifact installation
evidence, Auth route/login proof, build/check results, synthetic browser
acceptance and inspected screenshot evidence, restored temporary configuration,
and a stopped/verified owned runtime; or one concrete runtime-capability or
authority blocker after all independent source work is complete. Stop only
after Devsy reports `stopped` for this exact source checkout and devrouter
reports zero routes; the current `Busy` result fails this lifecycle condition.

**Pause:** if the pilot cannot resume without replacing its exact containers,
finish independent source work and request that exact target/effect before
runtime-dependent checks.

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

**Resolved 2026-08-19 by review against the UZH DF redesign bundle.** The component
re-tune and the ramp re-valuation are v5's partial implementation of the department's
component redesign: the new ramp slots 80/60 hold the redesign's *pressed/hover* state
colors, packed into tint-ladder positions instead of dedicated tokens. Klicker accepts the
new component scale (it is the redesign) and does not pin old values. The ramp defect is
handed back to the design-system project as item 01 of the gap review (introduce
`--primary-hover/-pressed/-container`, restore the 100-20 ladder as true tints), together
with six further token-level items. Klicker-side follow-ups (migrate 84 ladder usages,
delete the theme.css mirror block and ring override) are queued behind the corresponding
DS items. Accepting is the smaller change and matches the ratified
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

### Planning review and progress — 2026-10-20

- Plan reviewer: rounds 1–3 returned `REVISE`; round 4 approved after all
  findings were addressed on 2026-10-19. Review and arbitration evidence is in
  the ignored local record. The approved target remains `v3`.
- Current code commit: `1de7ad918145cf659e547057d04c448fb9a255fd`; source edits: none.
- Host refs were refreshed on 2026-10-20: `origin/v3` is
  `d6eac932f336407de4b77d6ec31ae0e0d7c38219`; this branch is 15 ahead and 455
  behind it. No live PR exists.
- Candidate SHA rechecked on 2026-10-19 and matched the supplied digest.
- The user approved the executable batch on 2026-10-20. Execution mode is
  `standard`; the first action is to commit this plan, then implement the Auth
  development routing and documentation slice.
- Completed: branch/PR target resolution, routing differential review, exact
  runtime diagnosis, target-drift review, plan construction, planner approval,
  plan approval, and all plan-review corrections.
- Runtime after the exact stop: `devrouter stop` returned `stopped: true` and
  zero routes; fresh source-path metadata confirms `routeCount: 0` and no
  hosts. Devsy still reports `Busy`, and `devpod` is unavailable, so provider
  shutdown is unverified. Container replacement remains separately gated.
- Remaining: plan commit, Auth source/doc change, exact-artifact install/builds,
  browser acceptance and screenshots, required implementation reviews, target
  integration near readiness, and draft delivery.
- Next: commit the approved plan as the first new branch commit, then delegate
  the Auth source/doc slice. If runtime-dependent acceptance needs replacement,
  finish independent source work first and request that exact effect.
