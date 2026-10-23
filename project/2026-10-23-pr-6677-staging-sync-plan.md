# Prepare the staging sync for review

## Approval summary

The user approved preparing PR #6677 through conflict resolution, Sonar triage,
CI and final review, stopping before merge. This executable batch updates the
existing sync branch from `v3-ai` into `v3-adaptive-learning`, the configured
staging source. Preserve the knowledge-graph relation support, transactional
email correction, mobile wizard fix and current Next.js/pnpm upgrade from the
source, together with the target's adaptive-learning, audit and logging changes.

Merge the target into the existing sync branch with ordinary history-preserving
Git operations. Resolve only integration differences and demonstrated failures.
Regenerate the lockfile with the source's pinned toolchain. Triage inherited
Sonar findings against the integrated PR's actual new-code analysis rather than
changing quality gates or unrelated source. The controller owns the PR title,
description and forward-sync topology.

Success requires a mergeable sync head containing both recorded parents, a
consistent frozen dependency graph, relevant source and browser checks, passing
hosted CI and a clean final AI review on the same head. Source checks, image
scans, staging promotion and user acceptance remain distinct evidence. Authority
covers local commits, ordinary pushes and fixing verified integration failures;
it excludes merging, deployment, protected-branch writes, force pushes, human
review requests, live settings, real data and paid application calls. A required
change to the trusted default-branch CI policy is a separate decision: preserve
that boundary and complete independent work before reporting it.

## Execution details

- Repository: KlickerUZH; worktree `trees/sync-6677`.
- Branch: `sync/v3-ai-into-v3-adaptive-learning-7e2b765666`; PR #6677.
- Recorded source: `97eaaa1053d7b1bd0ba2aa1e9e5a7a77f8091180`.
- Recorded target: `3aae5214b740dabddcf6d95d5d60036df98a9536`.
- Merge base: `67234d302a6e8ea47aebb205d02650c556f340db`.
- Artifact root: `project/`; private verification and review evidence stays in
  ignored `project/_local/`. Preserve the primary checkout's unrelated work.
- Execution mode: standard; the runtime exposes no exact allowlisted model ID.
- Ceremony: full path because dependency, UI and CI seams meet in this sync.

### Ownership and sequence

1. Main owns integration, dependency resolution, the inherited Playwright
   failure, Sonar gate interpretation, publication and final proof. A bounded
   read-only explorer owns the two-sided `Header.tsx` intent check. A read-only
   planner hardens this draft before its first commit. Acceptance: approval of
   this executable contract and a complete map of the conflicting intent.
2. Main merges the recorded target, resolves each conflict by preserving both
   parents, and generates the pnpm lockfile in a container. Keep the source's
   Next.js 16.4.1 and pnpm 12.11.2 pins. Retain target workspace dependencies,
   exports, tests and the stricter nodemailer override. Acceptance: both parents
   are ancestors; no conflict markers; frozen installation and native package
   policy checks pass; remerge edits contain only justified resolutions.
3. Main triages CI and Sonar against the resulting head. Correct demonstrated
   integration defects without weakening trust or quality gates. Delegate a
   separable settled patch if one emerges; Git integration remains main-owned.
   Allow two repair rounds for distinct demonstrated integration defects. A
   persistent failure becomes an exact blocker after independent checks finish.
   The failing Playwright run resolved trusted CI control at
   `691a63930e303e0f8f8a077aa89433d6ceab27da`; both its reusable workflow and
   build action come from `v3`, whose action still pins pnpm 11.5.0. The sync's
   local pnpm 12.11.2 action cannot update that remote control. Confirm this
   boundary against the fresh integrated run, then report the required trusted
   default-branch change without altering that branch or bypassing the route.
   Acceptance: the actual producing jobs run and pass, or an exact external
   policy/capability blocker is recorded with independent work completed.
4. Main verifies the combined header in the browser, reuses unchanged source
   evidence with its revision stated, and runs the affected native checks.
   Simplification is limited to the integration edits. One independent review
   covers the integrated result; after ordinary CI and feedback settle, invoke
   repository-authorized `/final-review` once at the final head and verify its
   authorize/start/review/finalize jobs actually ran. Acceptance: passing checks,
   no unresolved consequential findings and a quiet readiness check.

Record head, base, tested checkout tree and trusted control SHA from the actual
Playwright receipt, alongside job outcomes. If the controller advances the head,
reconcile once and repeat only affected evidence and mandatory exact-head CI.
Further movement that prevents convergence is a blocker; retain completed proof
and report the moving identities rather than chasing source indefinitely. New
consequential failures require a bounded portfolio amendment before adding tests.

No parallel writer touches dependency manifests, lockfiles or merge state.
The main retains those paths because Git integration is coupled to their parent
intent. No new product primitive, schema migration or feature is introduced.

### Verification portfolio

| Risk | Existing protection and chosen check | New test obligation |
| --- | --- | --- |
| A parent contribution disappears | Two-sided diffs, ancestry checks and remerge-diff review | None for mechanical merging |
| Dependency/toolchain mismatch | Frozen install; native override scripts `scan-spec-mismatch.mjs` and `verify-dropped.mjs`; syncpack; `.github/scripts/pnpm-toolchain-pins.test.cjs` and `.agents/skills/klicker-dependency-overrides/scripts/lockfile-readers.test.mjs`, all in a container | None for this integration |
| Combined navigation regresses | `playwright/tests/W4-activity-wizard-safety.spec.ts`; browser proof for `apps/frontend-manage/src/components/common/Header.tsx` at narrow and desktop sizes: reachable controls, competence-tree navigation and Resources active state | None for this integration |
| Source Sonar failure is misclassified | Current PR analysis, exact gate conditions, rule/location review against source and target | None for scanner output |
| A skipped job is claimed as validation | Hosted run job/step inspection, actual final-review receipt and same-head status | None |

Keep synthetic screenshots and provenance in ignored evidence. Preserve original
upstream screenshots as historical evidence; attach new evidence only within the
existing repository audience where needed. The controller-managed sync body is
not a destination for a manually maintained gallery. Stop the exact local runtime
after its final dependent check and verify shutdown. No cluster access is needed.

## Progress

- Approved executable batch recovered from the current conversation.
- Task worktree created on the existing sync branch; no duplicate PR created.
- The source advanced to include its already-merged Next.js/pnpm upgrade before
  implementation. The target and branch identity remain unchanged.
- Explorer found compatible header changes: preserve the target's competence-tree
  menu and active-route handling plus the source's shrinkable scrolling container.
- Incoming source delta is 896 added and 199 removed substantive lines across 78
  files, excluding lockfiles, generated exports, fixtures and project/docs text.
  This is the repository's existing maintained forward-sync package; preserve its
  topology and inherited changes rather than splitting an integration branch.
- The inherited Playwright build fails before compilation because pnpm setup
  selects 11.5.0 while the checked-out package requires 12.11.2. Its trusted control
  checkout is a different revision; determine whether the integrated head can
  resolve that mismatch without crossing the default-branch policy boundary.
- Sonar source-branch findings are captured privately for bounded gate triage;
  no finding has yet been declared fixed or waived.
- Planning review approved after one correction round. No new maintained tests.
- Local merge `03e21cd4e9` preserved both parents. A concurrent remote merge and
  pnpm workflow fix advanced the published branch to `2e71ccb589`; reconciled
  once without overwriting those changes. Its source tree is retained, including
  structured chat logging and the smaller regenerated lockfile.
- Frozen pnpm 12.11.2 lockfile validation, specifier/override policy, syncpack,
  lockfile-reader tests and the host Git-dependent toolchain contract pass.
  Container equivalents cover the focused checks; broad commit hooks are replaced
  by these checks, identity validation and a staged secrets scan.
- PR Sonar quality gate passes. The three remaining empty-CSS notices concern
  generated email HTML; no gate or suppression was weakened.
- Browser verification remains pending after managed runtime startup failed at
  dependency verification. Runtime recovery and exact shutdown remain tracked
  privately. Hosted Playwright still uses trusted `v3` control with pnpm 11.5.0.
- Independent integration review and final committed-range review remain pending.
  Hosted CI, exact-head final AI review and readiness remain unestablished.
- PR: https://github.com/uzh-bf/klicker-uzh/pull/6677. Stop before merge.
