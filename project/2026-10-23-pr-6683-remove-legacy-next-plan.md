# Remove the legacy Next.js dependency paths

## Approval summary

Revise [PR #6683](https://github.com/uzh-bf/klicker-uzh/pull/6683) so the backend dependency graph no longer retains Next.js 15. Upgrade the transactional email tooling to React Email 6, migrate its component imports, and remove the unused `next-auth` declaration from the backend package. Regenerate the workspace lockfile and remove the Next.js 15 override and its release-age exceptions only after the graph no longer needs them. Retain the independent `@graphql-tools/utils` 12.0.2 fix.

The user approved this executable batch. Preserve the auth application's NextAuth 4.24.15 dependency, cookie names, JWT verification, email wording, link parameters, template names, and existing export command. React Email's Tailwind migration may affect rendered spacing, colors, and borders; compare all three templates before and after the change. Correct only migration-caused differences. Keep the application's direct Next.js 16 upgrade in its existing separate PR.

Success means a consistent frozen lockfile without Next.js 15, successful template export and type checking, verified synthetic links and placeholders, inspected desktop and narrow browser captures, and an updated draft PR with independent review and explicit remaining CI limitations. Do not send email, publish templates, mark the PR ready, merge, or deploy.

## Execution details

Worktree: `trees/kg-image-scan-patches`; branch: `fix/kg-image-scan-patches`; target: `v3-ai`. The fetched target is `7e2b76566644d786de295dc7bf1d4e9e51e04aaf`; the initial patch is `7377cae0652d3668ee8b7e2fc0172e561308079d`. Use this branch and `project/` as the single artifact root. Keep synthetic captures and review reports under ignored `project/_local/`.

Execution mode is standard because the runtime does not expose an exact allowlisted solo model ID. The main session owns integration, registry selection, lockfile generation, browser evidence and publication. The main session also owns the seven mechanical import edits: dispatch overhead exceeds this small coupled change. No parallel writer is needed. A read-only planner reviews this plan, and one integrated final review covers the revised package. Reuse the earlier GraphQL-only smoke evidence when its resolved graph is unchanged.

### Scope and contracts

- Update `packages/transactional/package.json` to React Email 6 and its matching preview UI, using explicit versions within the approved major. Remove the obsolete components package and align React DOM if required by declared peers. Exact release-age exceptions may admit only reviewed packages required by this migration; preserve `minimumReleaseAge`, `minimumReleaseAgeStrict`, and `minimumReleaseAgeIgnoreMissingTime`. Require compatible resolved React, React DOM and Next peer contexts for the selected CLI/UI versions without changing application manifests.
- Migrate the six existing TSX files in `packages/transactional/src/components/` and `src/emails/`, plus the `TailwindConfig` type import in `src/components/tailwind.config.ts`, to the unified exports. Preserve existing content and behavior. Changes to Tailwind configuration or classes require a demonstrated rendering or compatibility regression.
- Remove only the unused backend `next-auth` dependency from `apps/backend-docker/package.json`. Source inspection finds cookie-name literals and independent JWT verification, with no package imports. Do not change either authentication implementation.
- Regenerate the three tracked `packages/transactional/out/*.html` artifacts with the existing export command; the Prisma seed consumes them. Preserve their substitution tokens and include the generated changes in this package. Regenerate `pnpm-lock.yaml` with the pinned Node 24.21.0 and pnpm 11.5.0 in a disposable container. Remove the Next.js 15 override and related exceptions from `pnpm-workspace.yaml` when no required dependency path remains. Restore unrelated generated churn.
- Preserve `@graphql-tools/utils` 12.0.2 and its direct GraphQL manifest alignment. No new product primitive or ADR is needed: this is a tooling migration and dependency cleanup with existing contracts retained.

### Research

Current registry metadata shows React Email 6.11.3 has no direct Next dependency, while its matching UI uses Next 16.4.1. NextAuth 4.24.15 is the latest stable release and already supports Next 16. Auth.js v5 changes cookie conventions and is outside scope. Confirm the exact selected versions against registry metadata before installation.

The [React Email 6 migration](https://resend.com/blog/react-email-6) unifies components and rendering under `react-email` and moves the preview package to `@react-email/ui`. Its [updating guide](https://react.email/docs/getting-started/updating-react-email) and current CLI documentation retain `email export`. Follow the repository's dependency-override and screenshot-gallery procedures.

### Ownership and test portfolio

| Outcome | Owner | Dependency | Acceptance |
| --- | --- | --- | --- |
| Plan hardening | planner | frozen plan | APPROVED |
| Baseline, migration, graph and export checks | main | approved plan; baseline before edits | checks in steps 1–3 |
| Browser and exported CSS verification | main | rendered outputs | checks in step 4 |
| Integrated review | final reviewer | committed range and verification | no unresolved consequential findings |
| Draft update and runtime shutdown | main | integrated review | step 5 and stopped owned processes |

New maintained test obligation: none for this dependency migration. Execution evidence covers four distinct risks: retained vulnerable dependency paths (frozen graph and closures); template compile failures (actual export and typecheck); broken substitution (default tokens and synthetic multi-parameter URLs after HTML decoding); changed presentation (exported CSS and browser comparisons). Do not create content-pinning tests.

Temporary verification files are `project/_local/verification/email-migration/render-check.mts`, `inspect-export.py`, `graph-check.cjs`, and `serve.mjs`, plus captured outputs and a screenshot manifest in that directory. They contain only test-owned synthetic inputs and remain ignored.

### Sequence and verification

1. Capture the existing email renderer's output using synthetic links and a synthetic course name. Preserve the baseline revision and dependency versions. Use a standalone container and loopback server; no application services or secrets are required.
2. Apply the manifest, import and lockfile changes. Verify zero Next 15 package records and snapshots, removal of the backend NextAuth importer, and retention of NextAuth in the auth app. Run frozen install, the repository specifier-mismatch checker, syncpack, formatting and diff checks. Review every newly resolved package and required Node version.
3. Run the transactional package's export command and TypeScript check. Exercise all three templates with test-owned synthetic values; verify a supplied URL with multiple query parameters reaches the action and fallback anchors after HTML decoding, default `[LINK]` and `[COURSE_NAME]` tokens survive export, and no content is accidentally omitted. Do not pin prose, translation strings, snapshots or hashes as maintained tests.
4. Capture before/after HTML at desktop and narrow viewports for all three English templates. Compare emitted CSS for custom colors, pixel spacing and fonts, borders, and `max-w-3xl`; inspect unresolved variables and newly emitted CSS constructs separately from browser appearance. Check clipping, colors, borders, spacing and actionable links. Exercise the native React Email preview and its template selection. Browser evidence does not claim Gmail or Outlook acceptance. Use synthetic captures only and publish them through the same repository's authenticated forge route when supported.
5. Inspect the complete diff, scan staged content for secrets and real data, commit, run the integrated review, resolve concrete findings, and update the existing draft PR with ordinary non-force pushes. Keep hosted full-workspace checks and a fresh affected-image scan as separate readiness evidence. Stop and verify every owned container, server and browser session.

No maintained test is planned for mechanical imports or version strings. The meaningful checks are frozen graph consistency, actual template compilation/export, the link substitution contract and browser rendering. Compare the auth importer and its complete resolved dependency/peer closure against the starting revision before reusing authentication evidence. Compare the GraphQL closure as well. Changed relevant resolutions require affected existing checks; unchanged source or version alone is insufficient. Full application build and hosted CI results must be reported honestly rather than inferred from the focused email checks.

Pause only for a required authentication behavior change, an unavoidable email redesign, new paid service or data boundary, or an unavailable required review/runtime capability after its permitted recovery. Routine migration corrections remain inside the approved batch.

## Progress

Implementation and focused verification are complete; integrated review and draft update remain. React Email and its UI are pinned to the 6.11.3 patch line, the backend NextAuth declaration is removed, and no Next.js 15 packages or exceptions remain. The independent GraphQL utilities patch is retained. Exact release-age entries were combined by package because pnpm 11.5.0 does not honor duplicate selectors for different versions of one package.

Frozen workspace installation, the actual transactional build and TypeScript check pass. All 902 manifest specifiers match; syncpack, formatting and dropped-override checks pass. The auth and GraphQL runtime dependency closures match the starting patch exactly. Newly introduced package engines admit the pinned Node 24.21.0. Unrelated deprecation and dependency-resolution churn was restored.

All three tracked default HTML exports preserve the substitution tokens. Six test-owned renders preserve synthetic action/fallback URLs with multiple query parameters. Emitted CSS has no unresolved variables; section padding moves into table cells. The six desktop/narrow before-after captures are identical, and the actual workspace preview loads and selects templates. Captures retain existing narrow-screen overflow. Preview props-editor automation did not establish editable-state persistence; synthetic substitution is proven through the renderer. No email-client or send acceptance is claimed.

The initial three-file independent review is superseded for this expanded scope. Required final review covers the whole branch, including generated HTML and this plan. Full workspace build/typecheck and fresh affected-image scans remain platform readiness gates. Host Git hooks are split from focused container checks; the blanket application hooks were not run. No new maintained tests were added. Required terminal remains the revised draft PR, published captures and stopped owned processes.
