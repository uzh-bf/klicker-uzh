# Upgrade KlickerUZH to @uzh-bf/design-system 5.0.0-alpha.5

**Branch:** `rs/ds-v5-alpha5-upgrade` · **Worktree:** `trees/ds-v5-alpha5-upgrade` · **Base:** `origin/v3`

## Approval summary — 2026-10-20 pilot resumption

**Approval mode:** executable batch, approved by the user on 2026-10-20.

**Current status:** startup works and the user confirmed Manage in Browser.
The compact wizard action overlap and details-modal focus return now have
focused source corrections and browser proof. The resolved v3 merge remains
ready to commit after the integrated checks passed. The user approved the narrow
Office plugin parser metadata repair; frozen installation and Office lint pass.
The existing approved delivery sequence remains active. See the latest Progress
entry for current evidence.

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

The user approved the source work, exact-candidate acceptance, checks, reviews,
commits, ordinary task-branch push, and a draft PR targeting `v3`. After the
bounded provider recovery attempts failed, the user explicitly approved
removing the eight verified inactive containers while preserving named volumes,
then one canonical ensure. That recovery succeeded. The existing post-create
hook completed its approved reset, schema push and synthetic seed. The runtime
is active for acceptance and will be stopped and verified after its final check.

Historical-pilot acceptance and source checks are recorded in
[Progress](#exact-recovery-and-acceptance-progress--2026-10-20). Current `v3`
integration and its acceptance remain pending. Merge into the target, readiness,
release, deployment and human-review notifications remain outside approval.

## Execution details — 2026-10-19 pilot resumption

### Evidence and binding contracts

- The work resumes in this plan, branch `rs/ds-v5-alpha5-upgrade`, at
  `1de7ad918145cf659e547057d04c448fb9a255fd`. No live PR exists. The fresh
  task context reports the primary checkout on `v3-ai` with upstream
  `origin/v3-ai`; the separate task worktree tracks `origin/v3`. For this
  worktree, `v3` is the resolved target: repository guidance says feature
  branches start from `v3`, `origin/HEAD` is `origin/v3`, and the existing plan
  agrees. At the latest host fetch, the task branch is 16 ahead / 457 behind
  `origin/v3` (`3b19ca4226473af4899e5896932c306637f1a412`). The primary checkout
  is on `v3-ai`, 0 ahead / 89 behind `origin/v3-ai`; keep that relationship
  separate from this task worktree's resolved `v3` target. The refreshed target
  contains the `waitFor` fix from `c942cd246d`.
- Current `origin/v3` differs in `apps/auth/package.json`, the Group Activity
  wizard, frontend conventions, `.devcontainer/devcontainer.json`, the root
  manifest, and the lockfile. The target already has
  `"waitFor": "postCreateCommand"`, added by `c942cd246d` on 2026-08-29. This
  task's historical baseline predates that commit. Preserve the historical
  baseline through exact-candidate acceptance as the approved pilot-first
  direction requires. Near readiness, make one deliberate merge of refreshed
  `origin/v3` into this task branch if the overlapping changes still materially
  affect delivery; record the target SHA and re-run affected checks and browser
  acceptance. Preserve the branch history and user changes. If a conflict
  requires a product or behavior choice, pause for that decision.
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
- The 2026-10-19 Context7 lookup returned an unrelated library. On 2026-10-20,
  Context7 resolved `/rschlaefli/devrouter`; its catalog exposes no version IDs.
  Current docs say a missing retained network needs reconciliation and managed
  ensure will not silently rebind or recreate that network. Those pages do not
  pin the installed 0.5.2 legacy-workspace behavior, so the tagged source and
  exact local runtime evidence remain the basis for the separate authority
  gate.
- The task baseline's missing `waitFor` is stale configuration, not a current
  `v3` defect. Commit `c942cd246d` added the exact setting on 2026-08-29. The
  user authorized carrying that one line into this historical worktree and one
  exact runtime retry. The retry passed config validation, then failed before
  readiness because retained containers reference a missing Compose network.
  The post-create reset hook did not run. After the failed attempt, canonical
  stop returned `stopped: true` and zero routes, while fresh Devsy status still
  reported `Busy`; provider shutdown is therefore unverified. A subsequently
  authorized Devsy recreation also failed on the missing network. Container
  timestamps prove that only the app was replaced; dependencies retained their
  old identities and network attachment. Its conditional ensure did not run.
  All named volumes remain present, no project container is running, and exact
  routes remain zero. Further container replacement requires new authority.

### Research

- Question: can the Auth catch-all use a documented bundler option without
  changing production behavior? The Next.js 16.2.9 guide documents
  `next dev --webpack`; the app is pinned to 16.2.10. The same-source browser
  differential is the exact consumer evidence. Research owner: main session.
- Question: does current repair safely restore this runtime? The installed
  Devrouter 0.5.2 source limits `ensure --repair` to retained managed runtime
  state; this checkout reports legacy mode and no managed state. Context7 now
  resolves current documentation but exposes no version-specific release, and
  its managed-network guidance does not establish the legacy effect. Ordinary
  `ensure` may invoke provider startup or exact-runtime recreation. Research
  owner: main session. No provider mutation or container recreation is inferred
  from this documentation lookup.
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
- Use only the local seeded lecturer and synthetic course/activity data.
  Database reset authority was limited to the explicitly approved recovery
  attempts and is now consumed. Do not inspect real application content.
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
  script changes, the exact `waitFor: postCreateCommand` carry-forward from
  current `v3`, the frontend conventions update, and the slice progress update.
  It does not change the NextAuth handler or policy.
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
   Temporarily change the seven dependency/devDependency entries to the relative
   `file:../../project/_local/ga-qualification-candidate/uzh-bf-design-system-5.0.0-alpha.5.tgz`
   reference. The other two entries are semver peer contracts; preserve them
   and add temporary development entries for that same archive in Markdown and
   Shared Components. pnpm 11.5.0 rejects `file:` peer specifiers. Reuse only the
   44 exact Radix age exceptions already approved for the pilot; restore the
   saved policy bytes after acceptance. Generate a temporary lock resolution
   with pnpm 11.5.0, then run
   `pnpm install --frozen-lockfile`. Verify each of the nine workspace links
   resolves to the archive-backed package, then compare the complete installed
   file set and hashes with the archive. Restart only the Auth and Manage app
   processes through their existing Next config watchers, then confirm their
   resolved ESM package entries point to the candidate-backed install. Also
   inspect served CSS: installed bytes alone do not invalidate retained Next
   output. If stale, temporarily isolate output with `distDir`, preserve the
   original config bytes and output, and repeat affected visual checks. Keep the temporary
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
5. After browser acceptance and gallery capture, restore all nine saved
   manifests, the lockfile, exact age-policy bytes and any temporary Next config
   to their post-source baseline; preserve Auth script changes. Do not
   reinstall, because that would replace the exact candidate in `node_modules`.
   Verify the installed links still resolve to the candidate, the package
   specifiers and lock match their baseline, no tracked local `file:` reference
   remains, and all three Auth scripts still use Webpack. Run
   `pnpm_config_verify_deps_before_run=false TURBO_ENV_MODE=loose TURBO_FORCE=true pnpm run check:all`
   and a fresh `pnpm_config_verify_deps_before_run=false TURBO_ENV_MODE=loose pnpm run build --force`
   in the exact devcontainer while the candidate
   remains installed. In pnpm 11, the old `npm_config_` prefix is ignored;
   use the documented `pnpm_config_` prefix. Turbo must forward it into nested
   pnpm commands; `TURBO_ENV_MODE=loose` supplies that forwarding while force
   keeps caches bypassed. Reverify installed bytes after checks so no automatic
   registry reinstall can masquerade as candidate proof.
   These checks prove the source tree against the local
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
   zero. No additional container replacement is authorized by this integration
   step; the single recovery attempt recorded under Authority is separate and
   already consumed.
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

**Authority:** the user approved the Auth development fix, exact-artifact
qualification, evidence-supported override removals, one readiness integration
of refreshed `origin/v3`, reviews, commits, normal task-branch push and a draft
PR against `v3`. The user separately approved the exact `waitFor` carry-forward,
bounded ensure/provider attempts, possible local post-create reset, then removal
of the eight verified inactive containers and one canonical ensure. The final
recovery succeeded while preserving named volumes. Its post-create hook reset,
pushed and reseeded the local DB. The user then approved the reviewed integrated
runtime transition, including create-only disposable database provisioning,
removal of the eight current containers, one ensure and its failure-stop branch.
That attempt is consumed: provisioning and removal completed, but lifecycle
admission blocked ensure before startup. Named volumes remain; no project
containers remain. Provider state is NotFound and stale routes remain, so runtime
release is incomplete. Further recovery, deletion or reset is not authorized.

**Withheld:** another runtime recovery attempt or any unapproved database reset,
container/workspace deletion, force/protected or default-branch pushes, merging
the task branch into its target, ready state, release, deployment, production
access, real-environment content, and human reviewer notifications. The one
readiness integration of refreshed `origin/v3` into the task branch is part of
this plan; it does not authorize merging the task branch into `v3`.

**Terminal:** a reviewed consumer draft with exact-artifact installation
evidence, Auth route/login proof, build/check results, synthetic browser
acceptance and inspected screenshot evidence, restored temporary configuration,
and a stopped/verified owned runtime; or one concrete runtime-capability or
authority blocker after all independent source work is complete. Runtime release
requires Devsy `stopped` for this exact source checkout and zero devrouter routes.
The current runtime is unavailable after the failed integrated transition.

**Pause:** stop at a concrete unmet acceptance, capability or new authority
boundary after independent work is complete. The missing-network blocker is
resolved. Keep exact-candidate checks distinct from registry-package checks;
stop and reverify if pnpm replaces the candidate.

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

### Planning review — 2026-10-20

Plan reviewer rounds 1–3 returned `REVISE`; round 4 approved after all findings
were addressed on 2026-10-19. The user approved the executable batch on October
20. Evidence is in the ignored review record. Execution mode remains `standard`;
resolved task target is `v3`. Plan commit: `17cc9da64aa336a797b650d89f6ec3ee3c1cc281`.

### Exact recovery and acceptance progress — 2026-10-20

- Exact inactive-container removal and the single canonical ensure succeeded;
  all named volumes were retained. Post-create completed its approved synthetic
  reset/push/seed. The runtime remains active only for this acceptance sequence.
- Exact archive SHA-256 matched; all nine consumer resolutions matched all 248
  archive files. Two peer declarations required temporary development entries
  with unchanged semver peer ranges. The same previously approved 44 exact Radix
  age exceptions were used and original policy bytes preserved.
- Auth provider/CSRF JSON returns 200; fresh synthetic delegated login succeeds.
  Synthetic cancel/reopen reset, invalid interval prevention, one creation,
  Create another reset, and edit/save/reload succeed. Gamification arrows move
  selection and focus. Modal keyboard entry/Escape returns focus to actions.
- Captures 01–08 are diagnostic: retained development CSS was stale despite
  exact installed package bytes. Temporary isolated Next output supplied current
  candidate CSS; captures 09 onward cover English/German and desktop/compact
  modal, tooltip and picker states. Existing compact navigation overflow remains.
  No consumer override has been removed.
- The first forced check invocation auto-reinstalled registry dependencies
  because pnpm 11 ignores `npm_config_verify_deps_before_run`. That run was
  stopped and is not candidate evidence. Reinstallation uses the documented
  `pnpm_config_verify_deps_before_run=false`; reverify bytes before and after
  the forced checks. Turbo strict mode also filtered the corrected pnpm setting
  from nested scripts, leaving interrupted install links; that check was stopped.
  Frozen reinstall restored the exact preserved candidate lock. All nine complete
  file sets pass again before the corrected forced run with `TURBO_ENV_MODE=loose`.
  Force/cache bypass stays enabled. Saved manifests, lock, policy and config are
  restored; no temporary archive reference remains in tracked configuration.
- One read-only explorer mapped current journey controls and identified a stale
  unrelated test helper; no maintained test was changed. One artifact executor
  owns the planned screenshot manifest. Main owns runtime, source, acceptance,
  integration and delivery because those seams share the exact candidate.
- Refreshed `origin/v3`: `e48fc5c29f71613bbc7278f2292f08fb94d1a2ef`;
  task branch is 16 ahead / 460 behind. Target remains `v3`.

- Corrected historical-baseline check result: `check:all` passed with 24/24
  typecheck tasks, 7/7 lint tasks and zero Turbo cache hits. Formatter check of
  touched Markdown passed. After-run byte verification again passed all nine
  complete 248-file candidate resolutions. The fresh production build passed
  all 22 tasks with zero cache hits in 1m43s; existing translation/page-size
  warnings remain. After-build byte verification is recorded separately.
  Host gitleaks found no staged leak. No new maintained test was added.

### Readiness integration — 2026-10-20

- Historical Auth slice committed as `abf02f148b72dbbaa214149e2dd87bb9e6d9a749`.
  Independent slice review approved with no findings; simplifier found no code
  reduction and one repeated plan paragraph, now consolidated. Private reports
  record exact scope and limitations. Host hooks were split: equivalent container
  checks/build and host staged gitleaks passed before `HUSKY=0` commit.
- Began the one approved readiness merge of
  `e48fc5c29f71613bbc7278f2292f08fb94d1a2ef`. Conflicts preserve current target
  dependency versions, behavior, IDs and accessibility while applying v5 imports,
  tokens, callback refs, modal sizing and the three Auth development commands.
  Newly introduced target call sites receive the same mechanical migration.
- Merged registry baseline is preserved before temporary archive installation.
  All nine integrated candidate resolutions again match every archive file.
  Temporary refs and exact age exceptions are restored to the merged baseline.
- Runtime qualification blocker: the retained image has Node 24.16.0 while the
  integrated image pins 24.21.0; it lacks the new per-workspace dependency mounts.
  Read-only exact Postgres metadata confirms the restricted test role and both
  marked disposable databases are absent. Current guarded bootstrap cannot use
  this historical database without separate provisioning/replacement authority.
  Do not rerun post-create or bypass guards. Integrated browser/DB acceptance
  remains unperformed.
- Integrated type checks passed 34 of 35 tasks before finding three obsolete
  Button props in two newly introduced target files. Their minimal v5 API
  correction passes the focused Manage check. All six non-Office lint tasks
  pass. Office lint fails on an undeclared parser required by its unchanged
  plugin; the public registry archive confirms the same implementation. No
  unrelated dependency change was made; the complete root gate is not green.
- A fresh integrated production build passes 23 of 23 tasks, with zero cache
  hits. The first build found duplicate generated development/production Next
  types. The owned development process was stopped through its delivered
  helper, and development output was preserved outside the compiler inputs.
  The successful rerun took 2m9.937s. Existing build warnings remain visible.
- Changed-file formatting, syncpack, agent-document checks, removed-artifact
  policy, Prisma schema synchronization and five Git identity checks pass.
  Host-only launcher checks pass 52 of 52; source-only CI checks pass 97 of 97.
  Final byte readback again passes all nine complete 248-file resolutions.
  All temporary manifests, lock and age policy match the merged registry
  baseline. All consumer overrides remain in place.
- Main completed the historical gallery after the executor's image route
  reported unsupported input. Twelve captures were inspected and rendered;
  the local HTML loads every image at desktop and compact widths. The manifest
  records the Auth viewport discrepancy, compact application overflow, missing
  variants, unproven modal scrolling and lack of integrated browser acceptance.
- Canonical shutdown failed with `Initial managed stop requires the drained
  ensure's recorded profile.` Fresh exact-source provider readback remains
  running, with eight containers and ten routes. The development process is
  stopped; provider release is incomplete. No configuration downgrade, raw
  fallback stop, further container removal or extra ensure was performed.
- Source conflicts are resolved and the readiness merge remains uncommitted.
  A new create-only disposable-database and exact-container transition is
  recorded privately, with one top-level ensure and explicit bootstrap retry
  bounds. Integrated acceptance, the merge commit, integrated reviews, push and
  draft PR remain pending; no PR exists yet.

### Integrated runtime transition — 2026-10-20

- The user approved the reviewed transition. Its source and identity checks
  passed. The create-only helper provisioned the restricted role and marked
  disposable databases; the eight pinned containers were stopped and removed
  without force or volume-removal flags. All original named volumes remain.
- The single canonical ensure failed before provider startup because lifecycle
  admission retained phase `stopping` with desired state `stopped-by-user`.
  The failed assumption was that removing the old containers would let ensure
  reconcile the historical stop state. It does not clear that admission gate.
- The approved failure branch attempted canonical non-deleting stop, which
  again refused the missing drained-profile proof. No containers remained for
  the validated Docker-stop fallback. Fresh provider state is NotFound, exact
  project container count is zero, and ten stale routes remain. No runtime
  readiness or complete lifecycle release is claimed.
- The attempt and its authority are consumed. No second ensure, registration
  deletion, journal edit, volume operation or further recovery was performed.
  A supported data-preserving lifecycle repair is now the capability blocker.
  Source and candidate acceptance remain at the prior recorded evidence; the
  resolved merge is staged and uncommitted, with no push or draft PR.
- The refreshed target advanced by one unrelated review-tool documentation and
  script change. The approved integration remains held at
  `e48fc5c29f71613bbc7278f2292f08fb94d1a2ef`; drift alone does not add another
  integration or recovery attempt.

### Latest source and Devrouter update — 2026-10-20

- The user requested current source and Devrouter. The pending merge now targets
  refreshed `origin/v3` at `c58e111ea3d606b3a99dd0664351b5df97fd90c8`. Its additional
  review-tool prompt and documentation changes are exact upstream content.
  The complete resolved tree was preserved before renewing the merge metadata;
  no conflict resolution or user change was discarded. No unmerged paths remain.
- Host Devrouter is upgraded through Volta from 0.5.2 to the latest published
  stable release, 0.5.4. Registry integrity and the installed bundle match the
  published archive. The CI installer also selects 0.5.4. The repository minimum
  remains 0.5.1 because selected Playwright jobs use the trusted `v3` installer;
  raising the minimum before that installer reaches `v3` would block those jobs.
- The 0.5.4 adaptation has no configuration migration. Diagnostics confirm the
  existing Devsy 1.19.0 agent is ready. Profile resolution and source syntax
  checks pass. Runtime smoke and integrated acceptance remain unavailable.
- Published 0.5.4 source retains the same initial-stop and stopping-admission
  guards. Independent bounded source inspection confirms journal settlement
  does not clear this phase or create the missing stop proof. A canonical
  non-deleting stop on 0.5.4 still returns the missing drained-profile error.
  No ensure, reset, deletion, journal edit or new runtime recovery was attempted.
- The version/source refresh is complete in the pending tree. The merge remains
  staged and uncommitted until integrated acceptance; there is still no PR.
  The next required capability is a supported lifecycle repair that preserves
  retained data and proves the absent runtime before clearing its stale routes.

### Startup repair and integrated acceptance — 2026-10-20

- The user requested startup repair and Claude consultation. Runtime source
  matches current `v3`; the fault was a stale per-worktree stopping record.
  The journal retained its ensure profile history, but the latest operation
  was an exec, which the published initial-stop guard cannot reconcile.
- Claude Fable 5.1 assessed a synthetic conceptual recovery description and
  returned `DONE_WITH_CONCERNS`. Main verified the actual reducer and live
  ownership evidence. Private source consultation was unavailable after
  automatic approval review rejected that payload; the accepted consultation
  contained no private paths or artifacts.
- An ignored, exact-checkout recovery adapter used the installed CLI's lifecycle
  locks, ownership/absence readers and stop-proof reducer. It preserved the
  registration, volumes, operation history and identity; removed only stale
  routes after repeated absence proof; and settled the stopping record.
  No installed CLI or application runtime configuration was modified.
- Canonical startup then exited successfully with a managed stop baseline,
  healthy services and no runtime drift. Bootstrap completed under the already
  approved marked disposable database boundary. Node 24.21.0 and pnpm 11.5.0
  match the integrated toolchain. Providers/CSRF and synthetic delegated login
  pass. Warm canonical ensure also succeeds without container replacement.
- Bootstrap initially installed registry alpha.5, whose bytes differ from the
  review candidate. The same temporary archive references and exact age
  exceptions restored the candidate. All nine complete 248-file resolutions
  match before/after process restart and after checks/build. All eleven saved
  public dependency input files are restored to the merged registry baseline.
- Integrated browser journeys pass cancel/discard/reopen, invalid-interval
  blocking, date-picker Escape focus return, single synthetic creation, empty
  create-another reopening, edited save/reload and gamification arrow navigation.
  Fifteen current captures cover English/German and desktop/compact states.
  All 27 current/historical gallery images load; provenance distinguishes them.
- Acceptance remains incomplete: compact wizard actions overlap, a menu-launched
  detail modal returned focus to the page body, and this fixture did not provoke
  horizontal table scrolling. Every consumer override is retained.
- The host launcher checks pass 41/41 and CI contracts pass 97/97. Forced
  container typecheck passes 35/35 and production build passes 23/23 with zero
  cache hits. Root checks remain blocked by the pre-existing Office lint plugin's
  undeclared parser dependency; its manifest/config are identical to current
  target. The aggregate's host-only checks pass when run on the required host.
- The merge remains resolved, staged and uncommitted pending the remaining
  acceptance/check gates. No push or draft PR has occurred. Private receipts
  and the exact repair are in the existing ignored evidence directory.
- Final canonical stop succeeds using the new retained baseline. Fresh exact
  source-path readback confirms provider `Stopped`, zero routes and stopped
  containers; original named volumes and registration remain. The runtime is
  released, and both browser sessions and the gallery browser are closed.


### Remaining acceptance corrections — 2026-10-20

- The user confirmed the running Manage app in Browser. The exact checkout is
  retained for manual use and pinned against the host's enabled idle sweep.
  The pin is task-specific; no global idle-stop policy changed. This explicit
  keep-running request supersedes the earlier stop-after-acceptance terminal
  for the current manual session. Revisit it at the next lifecycle checkpoint.
- Startup had refreshed the registry alpha.5 installation. Reinstalled the same
  approved archive, verified all nine complete 248-file resolutions, and
  restored all eleven public dependency inputs to their merged baseline.
  Current captures and source checks again use the exact candidate. A later
  ordinary startup can reinstall registry bytes; a version label alone remains
  insufficient evidence of candidate identity.
- Reproduced compact navigation overlap with real button rectangles. The
  existing two-column grid squeezed Cancel beneath Continue. A one-line change
  stacks action groups below the small breakpoint and retains the desktop row.
  English/German checks at 390x844 and 1440x900 confirm non-overlapping actions,
  including the description step's Back button. The correction affects the
  shared activity wizard navigation; labels, validation and submit handlers are
  unchanged. One bounded read-only explorer mapped the layout; main verified
  its recommendation against the running app and owns integration.
- Reproduced menu-launched Activity Details returning focus to BODY. This
  controlled modal has no mounted dialog trigger, and its opening menu item is
  removed. ActivityListEntry now remembers the persistent menu button and
  restores focus after the modal unmounts. English desktop and German compact
  keyboard entry, Tab, Escape and focus readback pass against the candidate.
- The existing seeded assessment quiz supplies a genuinely wider table. At
  compact width it overflows within a 306-pixel scroll container; German
  scrolling reaches the rightmost columns with scrollLeft 392. No fixture or
  database change was needed. Existing compact page/navigation overflow remains
  outside these corrections.
- Manage typecheck and repository ESLint pass; existing ESLint warnings remain.
  Biome formatting passes for both corrected files. An extra whole-file Biome
  lint invocation reported existing static-click accessibility findings outside
  the changed hunks; no unrelated cleanup was applied. No maintained test was
  added, changed or removed. The existing real-browser portfolio covers these
  consequential interaction regressions.
- Office lint still fails before source analysis because its published plugin
  imports @typescript-eslint/parser without declaring the dependency. The
  parser version already resolved by typescript-eslint is 8.63.0. The user approved the one-entry pnpm package-extension scope extension.
  It declares the plugin's parser dependency at the already resolved 8.63.0.
  Regeneration adds the dependency edge and peer-context snapshots, with no
  package-version additions or upgrades. Frozen installation and Office lint pass.
- Ten inspected new captures extend the same ignored gallery to 37 images.
  Captures 36-45 document the before/after action layout, both locales, focus
  return and actual table scrolling. Earlier evidence remains explicitly
  historical where a correction changes its contract. The forced production
  build passes 23/23 tasks with zero cache hits in 1m50.701s after preserving
  development output outside compiler inputs. All 37 images load in the
  rendered gallery at desktop and compact widths; long source hashes remain
  in manifest metadata while the visible revision label stays readable.
  The pending merge is still held at c58e111ea3d606b3a99dd0664351b5df97fd90c8;
  target drift alone does not trigger another integration. No push or PR exists.

- Post-build candidate verification passes: all nine consumers resolve to three
  complete package directories, each matching every archive file. The first
  canonical resumption stalled after Prisma Rollup reported output complete;
  no app process started. Canonical non-deleting stop interrupted the operation,
  preserved containers/data and removed the eleven routes. Read-only archive
  copies from that stopped exact container proved the post-build package bytes.
  Canonical retained repair restored the user's requested pinned stack without
  recreation. An OIDC guard compared service:app with its resolved container
  network namespace. Normalizing that single field to the exact existing app
  container reproduced the stored Compose hash. A temporary equivalent source
  declaration allowed canonical repair; the original source was restored in a
  finally block. Readiness and Manage HTTP 200 pass. This registry startup is
  separate from the completed candidate browser/build evidence.
- Host staged gitleaks passes. The new corrections remain unstaged while the
  existing resolved merge is staged. No commit is attempted while the full
  check gate is blocked. The Office plugin parser package-extension repair is now explicitly approved.
  Reviews, commit, push and draft creation follow after its required checks pass.

### Integrated checks after parser repair — 2026-10-20

- The exact candidate was reinstalled with the approved parser metadata repair.
  All nine consumers match every archive file before and after checks. All
  eleven public dependency inputs are restored, including the approved extension.
- Forced type checks pass 35/35 tasks and lint passes 7/7 tasks, both with zero
  cache hits. Staged formatting, syncpack, agent documents, removed-document
  policy and Prisma synchronization pass. Unchanged host-only Git identity,
  launcher and CI-contract checks retain their passing evidence. The aggregate
  is split by its required execution environment because the host launcher
  deliberately rejects execution inside a container.
- The production build after the UI corrections remains valid at 23/23 tasks
  with zero cache hits. The parser metadata extension changes only the lint
  plugin's dependency graph; it does not change application build inputs.
  The 37-image gallery remains valid for the recorded application source.
- Gitleaks and net staged whitespace checks pass. Incoming v3 content is exact
  upstream except for recorded conflict resolutions and task changes. No
  synthetic screenshots, temporary archive references or ignored recovery
  artifacts are staged. The original Compose network declaration is restored.
- Proceed with the resolved integration commit, its simplifier and slice review,
  then the integrated final review and approved draft delivery. The runtime
  remains retained and pinned for the user's manual Browser session.
