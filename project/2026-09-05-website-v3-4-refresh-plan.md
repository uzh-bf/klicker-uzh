# Website refresh for v3.4

## Approval summary
Prepare the public KlickerUZH website for the upcoming v3.4 release. Keep its visual identity while updating dependencies, homepage information, roadmap presentation and feedback guidance. Approved by the user on 2026-09-05.

Proposed changes: upgrade website dependencies to current stable versions where compatible, make necessary website-only compatibility fixes, remove expired promotion of 2024 courses and v3.2 as the latest release, and present available capabilities, the upcoming v3.4 preview and future work distinctly. Explain the existing public feedback platform and link it directly from the homepage and roadmap. Preserve the distinction between product feedback, classroom real-time feedback and AI formative feedback.

No application-feature implementation, broad redesign, private-service changes, new tracking, legal-policy edits, release tagging, publication, merge, deployment or ClickUp mutation. Detailed lecturer tutorials remain owned by https://github.com/uzh-bf/klicker-uzh/pull/5434.

Key choices: use upcoming-v3.4 wording until release evidence exists; do not advertise every merged or flag-gated feature as generally available. Keep current URLs and existing privacy and tracking boundaries. Latest stable major upgrades are assessed explicitly; unsupported major combinations and monorepo-wide version changes return to the user for a concrete scope decision. Do not silently substitute older targets and call them latest.

Approval permits this session to own the full reversible local workflow: isolated worktree, edits, scoped installation/build and temporary website preview, child implementation and reviews, local commits, and plan progress updates. Terminal condition: locally committed, reviewed website package with verified build and desktop/mobile browser evidence, ready for separately authorized publication. It permits no push, upstream merge/rebase, release action, cluster change or deployment. A new material data boundary, incompatible shared dependency upgrade, unavailable required verification, or unresolved public availability claim pauses the affected work.

Recommended dependency exceptions: retain the existing Font Awesome and Lucide lines required by design-system 4.1.8, and TypeScript 6.0.3. Use PostCSS 8.5.26 and Autoprefixer 10.5.4 because the newest releases are inside the repository cooldown. Approving this plan accepts these explicit limits on the request for latest versions. Website-only Syncpack exceptions for the named shared libraries below are included; changing other application manifests or the shared design system is excluded.

## Identity and baseline
Repository /Users/rschlae/Git/klicker/klicker-uzh; worktree trees/rs/website-v3-4-refresh; branch rs/website-v3-4-refresh; target v3. Baseline fbc5f4fcc2ffa1c8d25695679823134985c5a8d8. Remote refs refreshed 2026-09-05. This worktree starts even with origin/v3; unrelated dirty primary checkout is untouched. No existing website-refresh worktree or PR found. This plan is project/2026-09-05-website-v3-4-refresh-plan.md. Full-path tier: dependencies plus public content and browser-visible changes. One cohesive website PR package; no stacked topology is needed for this bounded single-app refresh.

## Findings and evidence
- apps/docs/package.json pins Docusaurus family ~3.8.1; the researched target is 3.10.2, compatible with React 19 and Node >=20.
- .syncpackrc.mjs enforces shared versions; root lockfile and narrowly justified website version exceptions may be required. A shared application upgrade is not implicitly included.
- apps/docs/src/components/landing/TitleImage.tsx promotes v3.2 as the latest release and links 2024 training. apps/docs/docusaurus.config.ts repeats that training promotion.
- apps/docs/src/pages/development.tsx contains older project-focus tiles; navigation, footer, roadmap feedback paragraph and welcome page already point to the new feedback platform on v3.
- https://www.klicker.uzh.ch/development/ returned an indexed snapshot still showing FeedBear. This is stale-index evidence, not live deployment proof. The feedback platform returned HTTP 200 to a direct GET on 2026-09-05. The main website timed out both inside and outside the sandbox; live content remains unverified.
- The internally maintained release roadmap retains August planning dates and older PR states. Treat them as roadmap intent, not current shipping proof. Do not copy private staffing, financial or operational details into public files.
- project/2026-09-04-v3-release-notes.md describes merged Manage/practice improvements, lecturer chatbot authoring, Chat and beta enrollment. It is a release draft; some recorded source-state details are already stale. Never equate it with published availability.
- Detailed lecturer documentation draft https://github.com/uzh-bf/klicker-uzh/pull/5434 owns tutorials and screenshots; do not duplicate or integrate its branch.

## Product meaning
No product primitive changes. Reuse existing course chatbot, beta enrollment and activity semantics when describing them. Feedback platform is existing external user-initiated intake, distinct from classroom feedback and formative learning feedback. Preserve no-personal-or-course-data guidance; no automatic requests or embedded feedback widget. Website status labels describe evidence of availability, not changes to product lifecycle. No ADR: reversible presentation and dependency maintenance introduce no architecture decision; new data flow or infrastructure ownership would reopen that gate.

## Execution and checks
1. Dependency baseline and upgrade: capture current and target stable versions and compatibility. Establish the existing docs build result first. Upgrade the Docusaurus family together, then website-only dependencies, with lockfile changes. Preserve shared app versions unless explicitly scoped. Check frozen install, docs production build, the focused type/lint/format checks listed below, syncpack and exact lockfile importer scope. Report inherited errors separately; fix only blockers needed by this website package. Commit package and lockfile together.
2. Current public content: update homepage, announcement, roadmap, feedback CTA and affected welcome links. Organize roadmap around Available, Coming with v3.4 preview, and Planned; use only evidenced claims, omit unconfirmed dates. Add a plain explanation of the feedback platform without promising unsupported features. Keep existing identity, routes, legal text and analytics. Address concrete keyboard, heading, image-alt and mobile layout defects in these changed components. Browser-check desktop and mobile screenshots, keyboard links, navigation, feedback destination and changed pages for overflow and errors. No new tests pin prose.
3. Integrated delivery: build the complete site, compare broken links/anchors to baseline and require no new ones. Verify important changed internal routes and asset loading in the production preview. Run native commit checks, inspect every diff hunk and public-data hygiene, and complete simplifier plus bounded dependency risk review and final review. Stop temporary task-owned preview after screenshots. If a managed runtime is touched, apply its lifecycle skill and stop/verify that exact runtime. Record unresolved hosting configuration and separately authorized deployment proof as delivery follow-up; local readiness is not live delivery.

Use existing scripts and toolchain. No application database or full app stack is required for a static website. Browser tooling follows repo agent-browser instructions. Runtime command choice must follow actual available docs build environment, not start unrelated services. Any host/container check split is documented.

## Verification portfolio
| Risk | Evidence | Test change |
| --- | --- | --- |
| Dependency incompatibility | frozen install, production docs build, type/lint checks, syncpack | none |
| Broken navigation/assets | build diagnostics versus baseline; changed-route browser checks | none |
| Inaccurate release claims | claim-by-claim source and availability ledger in this plan | none |
| Responsive and keyboard regressions | desktop/mobile before-after screenshots and keyboard checks | none |
| Shared-package regression | lockfile scope and peer review; affected native checks | add only for a reproduced consequential regression |

## Routing
Dependency research: researcher; website mapping: explore failed with provider 400 before useful work, then trusted Luna/max executor used as exploration continuity. Parent owns public-claim decisions and shared dependency scope because these are unresolved product and integration boundaries. Implementation: executor with disjoint bounded ownership after approval. Planning: one planner pass. Simplifier and dependency slice reviewer run on committed implementation; final reviewer after integrated checks. Writing-for-agents governs this plan; rs-prose governs audience-facing copy; product-primitives pass found no semantic change. Public-only evidence for external roles; private ClickUp content stays with parent.

## Progress
User approved the focused refresh, public feedback platform and dependency exceptions on 2026-09-05. Content, its simplification and the dependency/config changes are committed locally. Remote refs are refreshed; the branch has four local commits; origin/v3 advanced by one unrelated Playwright CI commit during review. The unchanged-key hook override was explicitly approved and staged gitleaks passes. Dependency risk review passed with one non-blocking deprecation warning; integrated final review follows. Verification evidence and limitations are recorded below. No publication, integration, deployment, application services or credentials are involved.


## Dependency targets and exceptions

Registry dist-tags, peer manifests and publication timestamps were checked on 2026-09-05. Keep repository tilde/caret conventions and exact design-system version; the lockfile records exact resolved versions. Recheck release-age eligibility at installation without widening these target versions automatically.

| Dependency | Current range | Target | Disposition |
| --- | --- | --- | --- |
| `@docusaurus/core` | `~3.8.1` | `3.10.2` | Upgrade |
| `@docusaurus/faster` | `~3.8.1` | `3.10.2` | Upgrade |
| `@docusaurus/module-type-aliases` | `~3.8.1` | `3.10.2` | Upgrade |
| `@docusaurus/plugin-client-redirects` | `~3.8.1` | `3.10.2` | Upgrade |
| `@docusaurus/plugin-ideal-image` | `~3.8.1` | `3.10.2` | Upgrade |
| `@docusaurus/preset-classic` | `~3.8.1` | `3.10.2` | Upgrade |
| `@docusaurus/theme-classic` | `~3.8.1` | `3.10.2` | Upgrade |
| `@docusaurus/theme-common` | `~3.8.1` | `3.10.2` | Upgrade |
| `@docusaurus/tsconfig` | `~3.8.1` | `3.10.2` | Upgrade |
| `@docusaurus/types` | `~3.8.1` | `3.10.2` | Upgrade |
| `@fortawesome/fontawesome-svg-core` | `~6.7.2` | `6.7.2` | Retain: shared design-system peer contract |
| `@fortawesome/free-brands-svg-icons` | `~6.7.2` | `6.7.2` | Retain: shared design-system peer contract |
| `@fortawesome/free-regular-svg-icons` | `~6.7.2` | `6.7.2` | Retain: shared design-system peer contract |
| `@fortawesome/free-solid-svg-icons` | `~6.7.2` | `6.7.2` | Retain: shared design-system peer contract |
| `@fortawesome/react-fontawesome` | `~0.2.2` | `0.2.2` | Retain: shared design-system peer contract |
| `@mdx-js/react` | `~3.1.0` | `3.1.1` | Upgrade |
| `@tailwindcss/postcss` | `~4.1.11` | `4.3.3` | Upgrade; docs-only Syncpack exception |
| `@tailwindcss/typography` | `~0.5.19` | `0.5.20` | Upgrade; docs-only Syncpack exception |
| `@types/react` | `^19.2.17` | `19.2.18` | Upgrade; docs-only Syncpack exception |
| `@uzh-bf/design-system` | `4.1.8` | `4.1.8` | Already current |
| `autoprefixer` | `~10.4.20` | `10.5.4` | Latest eligible after 14-day cooldown; docs-only Syncpack exception |
| `cross-env` | `~7.0.3` | `10.1.0` | Upgrade; docs-only Syncpack exception |
| `docusaurus-plugin-matomo` | `~0.0.8` | `0.0.8` | Already current |
| `lucide-react` | `~0.522.0` | `0.522.0` | Retain: shared design-system peer contract |
| `nodemon` | `~3.1.14` | `3.1.14` | Already current |
| `npm-run-all` | `~4.1.5` | `4.1.5` | Already current |
| `postcss` | `~8.4.47` | `8.5.26` | Latest eligible after 14-day cooldown; docs-only Syncpack exception |
| `postcss-import` | `~16.1.0` | `17.0.0` | Upgrade; docs-only Syncpack exception |
| `react` | `~19.2.7` | `19.2.8` | Upgrade; docs-only Syncpack exception |
| `react-dom` | `~19.2.7` | `19.2.8` | Upgrade; docs-only Syncpack exception |
| `react-medium-image-zoom` | `~5.2.14` | `5.4.9` | Upgrade |
| `react-spring` | `~10.0.3` | `10.0.4` | Upgrade |
| `recharts` | `~3.0.2` | `3.10.1` | Upgrade; docs-only Syncpack exception |
| `rehype-katex` | `~7.0.1` | `7.0.1` | Already current |
| `remark-math` | `~6.0.0` | `6.0.0` | Already current |
| `tailwind-merge` | `~3.3.1` | `3.6.0` | Upgrade; docs-only Syncpack exception |
| `tailwindcss` | `~4.1.11` | `4.3.3` | Upgrade; docs-only Syncpack exception |
| `typescript` | `~6.0.3` | `6.0.3` | Retain: TS7 is a separate toolchain migration |

Docusaurus 3.10.2 and its matching packages accept React 19 and Node >=20. Keep Faster disabled while migrating `experimental_faster` to the supported config name if required; do not opt into v4 future flags. Read the official 3.9 and 3.10 notes during compatibility implementation. `postcss-import` 17 and `cross-env` 10 are explicit website-only major targets, supported by Node 24; validate their current usage before bumping. The design-system manifest still declares Node =22, a pre-existing mismatch with this repository's Node 24; do not modify the shared package, and pause if the focused install/build cannot work under existing repository policy.

The Syncpack exception is limited to `@klicker-uzh/docs` and these exact dependency names: `@tailwindcss/postcss`, `@tailwindcss/typography`, `@types/react`, `autoprefixer`, `cross-env`, `postcss`, `postcss-import`, `react`, `react-dom`, `recharts`, `tailwind-merge`, `tailwindcss`. It permits the static site to evolve without upgrading runtime apps. Keep dependency ranges compatible with design-system peers; a peer or shared-resolution failure pauses the upgrade rather than bypassing validation. Preserve the 14-day release-age policy and all trust/build-script controls. Explain every lockfile change outside the docs importer, including required shared transitive resolutions.

Sources: [Docusaurus 3.10](https://docusaurus.io/blog/releases/3.10), [Docusaurus 3.9](https://docusaurus.io/blog/releases/3.9), [core registry manifest](https://registry.npmjs.org/@docusaurus/core/3.10.2), [design-system manifest](https://registry.npmjs.org/@uzh-bf/design-system/4.1.8). Context7 research used `/websites/docusaurus_io`; its retrieved migration guide did not establish TypeScript 7 support. The parent's primary-source checks corrected the researcher's missing cross-env engine constraint and verified cooldown dates.

## Public-claim ledger

| Proposed claim | Evidence and availability | Restriction | Wording rule |
| --- | --- | --- | --- |
| v3.4 release | User says upcoming; source release notes are a draft | No published stable-release proof | Say preparing for v3.4; never say released |
| Live quizzes, practice, microlearning and groups | Existing public site and use-case documentation | Preserve existing account/Catalyst qualifications | Describe established capabilities without new release claims |
| Lecturer chatbot authoring and beta enrollment | Merged v3 source and public release draft | Entitlements, publication approval and feature gates remain | Describe upcoming or beta capability, not universal access |
| AI question generation and learning analytics | Existing roadmap intent; future delivery and availability unverified | Do not transfer dates or release promises from old internal plans | Planned development; no fixed release/date commitment |
| Public feedback platform | Current source links plus public GET HTTP 200 | Existing external destination; no personal/course data | Invite ideas, experiences and problems; no claim about voting, accounts or public status tracking until verified |

If a claim cannot meet its row, omit it or retain the explicitly planned status. A new commitment requires user input. Preserve the distinct meanings of classroom real-time feedback and AI formative feedback. The primary request is interpreted as public product-feedback intake unless the optional user answer changes it.

## Exact paths and ownership

| Work | Owner | Allowed files | Acceptance and boundary |
| --- | --- | --- | --- |
| Dependency upgrade | Main session: shared dependency coupling | `apps/docs/package.json`, `apps/docs/docusaurus.config.ts`, `apps/docs/postcss.config.js`, `apps/docs/tsconfig.json`, necessary compatibility fixes inside `apps/docs/src/`, `pnpm-lock.yaml`, named `.syncpackrc.mjs` exception | Frozen install, docs build, scoped checks; no other app manifests |
| Public content | Executor | `apps/docs/src/pages/index.tsx`, `apps/docs/src/pages/development.tsx`, `apps/docs/src/components/development/RoadmapTile.tsx`, `apps/docs/src/components/landing/TitleImage.tsx`, `apps/docs/src/components/landing/CTA.tsx`, `apps/docs/docs/getting_started/welcome.mdx` | Approved claim ledger and desktop/mobile acceptance; no tutorial duplication |
| Announcement/config integration and final proof | Main session | `apps/docs/docusaurus.config.ts`, this plan, conditional website-related correction in `docs/ci-and-deployment.md` only if a durable build contract changes | Whole-package verification, reviews, commits; no publication |

Serialize dependency compatibility edits before executor content work. Parent retains lockfile and config ownership. Commit boundaries: approved plan; dependency upgrade plus lockfile; website content; necessary reviewed corrections. No artificial commit splitting for individual packages. Dedicated simplifier after each substantive implementation slice; dependency slice review covers compatibility and supply-chain impact. Final review covers correctness, plan compliance, maintainability and bounded dependency security. Architecture review is not armed unless the approved boundary changes.

## Executable verification and environment

Use Node 24.16.0 and pnpm 11.5.0 in a task-owned disposable build container, with this worktree mounted and a loopback-only production preview port. No database, credentials or full app stack. Do not reuse another task's runtime. If the pinned runtime cannot be provided, report the concrete capability blocker. This plan permits the local image/toolchain setup required for that scoped container; it does not authorize changes to agent configuration or host-wide tooling.

Run from the worktree inside the container:

```sh
pnpm install --frozen-lockfile
pnpm --filter @klicker-uzh/docs run build:docs
pnpm --filter @klicker-uzh/docs exec tsc --noEmit
pnpm run check:syncpack
```

For the intentional dependency update, regenerate the lockfile using pnpm with existing policy, then run the frozen install. Use `pnpm exec biome check <changed-code-paths>` and `pnpm exec prettier --check <changed-markdown-paths>` with explicit paths. Complete `pnpm run check:all` as required before commits and document the host Git/container hook split. No general `build`/`check` script exists for the docs package; root Turbo success does not replace `build:docs`. If baseline docs typechecking fails, record its diagnostics and fix only errors on the changed dependency/rendering seams; unresolved check failures prevent claiming a fully passing package.

Serve the resulting output with `pnpm --filter @klicker-uzh/docs run serve --host 0.0.0.0 --port 5500` in the container, publishing to a free localhost port only. Host agent-browser verifies `/`, `/development/`, `/getting_started/welcome/`, navbar/footer routes, feedback link, docs search and a representative MDX/math/image page. Capture 390px and 1440px before/after screenshots, keyboard navigation, mobile menu, absence of new console errors and horizontal overflow. Do not submit feedback or enable analytics features. Save synthetic/public screenshots under the plan's artifact directory. Stop and verify the exact preview/container after acceptance.

Build logs currently report broken links without failing. Compare baseline and final broken-link/anchor diagnostics; require no new failures, and fix failures on changed links. Existing unrelated link debt is recorded, not silently converted into a full documentation rewrite.

## Audit disposition

The trusted continuity audit returned DONE_WITH_CONCERNS. Accept the stale project framing, mixed roadmap statuses, dated links and incorrect GitHub Issues support label as this package's content fixes. Add a reviewed date to the roadmap and meaningful alt text and safe new-tab links in changed components. Preserve historical funding attribution only as history; do not imply continued funding without evidence.

New role-based quickstarts and a full self-hosting guide are separate documentation work, outside this website refresh and the existing tutorial owner's scope. No dedicated docs build/deployment workflow was found in the bounded workflow search. Report this coverage gap with the local build evidence; adding CI/deployment tooling requires a separate concrete approval. Do not copy old workflow command names from the audit: use the scripts verified in Executable verification above.

### Execution checkpoint

The baseline frozen website install and production build pass. Baseline docs typechecking reports 35 existing errors in older chart, use-case and form components. The required root check was run and fails because the deliberately scoped container lacks other applications' dependencies and generated build artifacts; it is not a full-monorepo qualification environment. Host staged gitleaks and Git identity checks and container Markdown formatting pass for the plan commit. The host hook is split from container checks via HUSKY=0 for that local commit; no passing root check is claimed.

Before screenshots cover homepage and roadmap at 390px and 1440px. The existing Matomo script stalls load completion; its requests are blocked only in the local test browser for subsequent interaction checks. Baseline assets and application JavaScript load successfully.

The first lockfile resolver exhausted Node's default heap before writing. It is retried with a 4608MB heap inside the existing 6GB task container. pnpm 11 check/exec commands can trigger automatic installs while manifests are dirty; two unintended auto-install children were stopped and interim checks use installed binaries. Syncpack and the three dependency/config source checks pass. Content draft and edits use the same executor; the parent owns dependency and configuration edits.

### Verification and commit checkpoint

Content is committed as `1540272d25af110f74cfee81f72c5040040ee3d6`. The dedicated simplifier returned one accepted reduction: require the tag array that every roadmap tile already supplies. Its report is in `project/_local/reviews/2026-09-05-website-content-simplifier.md`. No content-only correctness risk required a separate slice review; the dependency risk review and integrated final review remain pending the complete dependency/config commit.

Docusaurus 3.10.2 production build passes after the final public copy. Frozen filtered installation passes. All non-docs lockfile importers and pre-existing package snapshots remain unchanged. The lockfile combines the original graph with the docs importer and its reachable additions from pnpm resolution; this avoids pnpm changing unrelated application peer resolutions. Syncpack and changed-file Biome/Prettier checks pass. Website typechecking reports exactly the same 35 baseline diagnostics, with no additions or removals. Build link and anchor diagnostics add no new failures. Root check remains unqualified in this website-only container because other application dependencies and generated artifacts are unavailable.

Browser checks cover desktop 1440px and mobile 390px, homepage/roadmap/welcome, keyboard activation of the hero roadmap link, mobile menu navigation, search results for a public microlearning query, and grading documentation with 21 rendered math expressions and successfully loaded images. Changed pages have no horizontal overflow or nested buttons in links; no page JavaScript errors were observed. Matomo is blocked only in the test browser after the baseline request stalled; analytics behavior is not qualified. Screenshots and verification logs remain local in the gitignored `project/_local/website-v3-4-refresh/`. Feedback links use the existing public destination and safe new-tab attributes; no feedback was submitted.

The automatic data-hygiene hook rejected the dependency/config commit because `apps/docs/docusaurus.config.ts` contains an existing Algolia API-key field. Values-free comparison confirms both credential-like configuration lines are unchanged. The source diff only changes the Docusaurus future-option name and release announcement. User approved the hook's explicit override, and dependencies/config were committed together as `36a78072ff966b0c09a723bbcb09a925fce35e40`. The staged gitleaks scan passes. Remaining authorized action: complete dependency risk review and integrated final review, disposition findings, and finish the local package. No push, integration, PR, merge or deployment is authorized.

The task browser is closed and `klicker-website-v34-refresh` is verified stopped (`exited`). Dependency changes are mechanical manifest/config migration and generated resolution updates; no additional simplifier is armed beyond the completed content simplification. The dependency reviewer covers compatibility, lockfile scope and bounded supply-chain risk. Host hooks remain split from the previously completed container checks; the unchanged root-check limitation remains explicit.

Upstream interaction check: `dd305b7c26` changes Playwright CI caching, timing feedback and its engineering notes. It does not overlap the website source, manifests, lockfile or scoped build contracts. Existing verification remains valid on the approved baseline; no upstream integration was performed.

Dependency slice review: DONE_WITH_CONCERNS, no blocking findings. Report: `project/_local/reviews/2026-09-05-website-dependencies-slice-review.md`. The existing onBrokenMarkdownLinks setting gains a Docusaurus v4 deprecation warning; defer its migration until the v4 compatibility update. Current 3.10.2 build and broken-link diagnostics are verified. Dependency policy checks do not constitute an advisory/CVE audit.
