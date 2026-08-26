# Generic ARM64 runner pools

## Goal

- Add two organization-scoped ARM64 runner pools with purpose-based names.
- Use three persistent runners only for same-repository PR jobs in public repositories.
- Reserve two persistent runners for selected private repositories and protected trusted branches.
- Migrate only the KlickerUZH Playwright shard jobs initially and preserve the existing required status.

## Non-goals

- Do not run fork PR code on self-hosted runners.
- Do not move build, filter, status, deployment, publishing, or secret-bearing jobs.
- Do not claim persistent public runners provide ephemeral isolation.
- Do not merge, alter GitHub settings, or execute provisioning or cleanup on the VMs from this session.

## Execution contract

- Authority: local worktree edits, focused verification, local conventional commits, and operator instructions are approved.
- Withheld: merging, changing runner groups, changing repository variables, and executing provisioning or cleanup on the VMs.
- Terminal: a pushed draft PR with reviewed scripts and exact operator commands for safely resetting and reprovisioning the five existing VMs.
- Boundary owner: self.
- Pause: only a changed trust decision, an invalid workflow-routing contract, or unavailable required verification.

## Identity

- Plan: `project/2026-08-26-generic-arm64-runner-pools-plan.md`
- Branch: `rs/arm64-ci-one-pr`
- Target: `v3`
- Pull request: draft PR #5576.
- Historical local work: `project/2026-08-25-hetzner-arm64-runner-provisioning-plan.md` on the earlier private branch; it is not reused.

## Decisions

- Public pool: `public-pr-arm64-01` through `public-pr-arm64-03`, group and capability label `public-pr-arm64`.
- Trusted pool: `trusted-arm64-01` and `trusted-arm64-02`, group and capability label `trusted-arm64`.
- Pool assignment is immutable after generic provisioning. The five dedicated legacy hosts may be converted once with the reset script only when its trust preconditions hold.
- Same-repository PR Playwright shards may use the public pool. Fork PRs and every push use GitHub-hosted runners.
- The public workflow receives no secrets and has read-only repository contents permission.
- The reusable workflow independently checks the event and source repository before requesting a public runner.
- The runner group must allow only selected public repositories and the reusable workflow at `refs/heads/v3`.
- The trusted group must not grant access to public PR workflows.
- Three public runners execute eight Playwright shards in three waves: 3, 3, and 2.

## Security and operations

- GitHub recommends against persistent self-hosted runners for public repositories because PR code can compromise the host.
- The public pool is therefore treated as disposable and isolated from private repositories, deployment workflows, secrets, and private networks.
- Rebuild public hosts on a schedule and immediately after suspicious behavior. Disk cleanup is capacity management, not compromise recovery.
- The reset script is not secure disk erasure. A public target must never have received repository, organization, environment, or external secrets, private data, or private source, and no reset target may have run untrusted code or show compromise indicators.
- The initial migration excludes fork PRs. Supporting them requires ephemeral, fresh-host-per-job runners.
- This changes a trust boundary but does not change product architecture, so no product ADR is created. An ephemeral autoscaling design would re-arm the ADR gate.

## Research

- GitHub Actions documentation confirms runner groups can restrict repository and workflow access.
- GitHub Actions documentation recommends immutable reusable-workflow references and warns against public repositories on persistent self-hosted runners.
- Current repository evidence preserves `test-playwright-status` as a required, always-reporting gate and keeps the build artifact on GitHub-hosted infrastructure.

## Skill routing

- `rs-sliced-development-workflow`: plan, slices, commits, and final review.
- `rs-model-routing`: planner and review routing.
- `klicker-playwright-e2e`: Playwright CI invariants and artifact behavior.
- `klicker-wiki-maintenance`: same-change documentation; this repository intentionally has no wiki log.
- `rs-local-runtime-lifecycle`: no runtime is needed; record that no DevPod or devcontainer was started.

## Planning review

- Reviewer: planner `01a03e02-40b1-7c63-a4de-3c6ca0f324fa`.
- Status: `DONE_WITH_CONCERNS`.
- Accepted: exact pool names and sizes, independent reusable-workflow guard, exclusive routing, hosted fork fallback, unchanged status name, all eight artifacts, and rebuild requirements.
- Residual concern: persistent public runners remain less isolated than ephemeral runners; the package documents and limits that risk rather than hiding it.

## Test portfolio

| Consequential behavior | Existing evidence | Obligation | Owning slice |
| --- | --- | --- | --- |
| Exactly one shard path runs | Current single matrix job | Add workflow-expression validation and inspect all event branches | Public PR routing |
| Fork PRs remain hosted | Current hosted matrix | Add explicit same-repository gate and hosted fallback | Public PR routing |
| Eight shard artifacts retain names | Current Playwright uploads | Preserve matrix and artifact expressions in both paths | Reusable shards |
| Required status remains stable | `test-playwright-status` | Preserve job name and aggregate both possible shard results | Public PR routing |
| Pools cannot be mixed | Fresh-host provisioning validation | Validate exact profile-specific names, group, and labels | Generic provisioning |
| Legacy hosts are reset without weakening access controls | Existing dedicated runner state | Preserve admin access and hardening while deleting runner and Docker state | Host reset |
| Documentation matches operations | Existing CI wiki and Playwright skill | Update both in the same change set | Operations documentation |

## Delegation map

- Trust-boundary design and workflow integration: main session; security-sensitive and tightly coupled.
- Provisioning profile changes: main session; shares the trust contract and prior recovery logic.
- Planner review: planner specialist; complete.
- Final integrated review: final-reviewer specialist after committed verification.

## Slices

### Slice 1: Generic, disjoint provisioning profiles

- Do: remove Klicker-specific registration and names from the private provisioning script; add exact `public-pr` and `trusted` profiles.
- Check: `bash -n`, ShellCheck, offline `--check` behavior, and exact diff inspection.
- Commit: `ci(runners): add generic ARM64 runner profiles`.

### Slice 2: Public PR Playwright shard routing

- Do: add a reusable shard workflow on the public runner group and preserve a hosted path for pushes, forks, and disabled rollout.
- Check: YAML parsing, workflow-expression checks, eight-shard artifact parity, and status aggregation logic.
- Commit: `ci(playwright): route internal PR shards to public ARM64 runners`.

### Slice 3: Operations documentation

- Do: document the pool split, enablement order, trust boundary, rebuild policy, and CI routing in the wiki and Playwright skill.
- Check: wiki validation, Prettier, and fact-check against workflow and script.
- Commit: `docs(ci): document ARM64 runner pool operations`.

### Slice 4: In-place legacy host reset

- Do: add a fail-closed cleanup script for the five dedicated local-disk hosts and let the provisioner accept its profile-bound reset marker.
- Check: Bash syntax, ShellCheck, destructive-target inspection, reset-marker contract, documentation, and bounded security review.
- Commit: `fix(ci): support sanitized runner host reuse`.

## Progress

- Status: draft PR published; in-place host reset correction in progress.
- Active slice: in-place legacy host reset.
- Completed: fresh worktree, current `v3` baseline, documentation research, planner review, generic provisioning commit `3ad4b98d2`, public PR Playwright routing commit `046b56e6b`, documentation commit `bd70de85e`, isolation corrections commit `c7d8ac3df`, integrated local verification, and the final review correction pass.
- Final review: `DONE_WITH_CONCERNS`; all source-level security and operational findings are resolved. Live GitHub scheduling and container behavior remain unproved until the merged workflow is canaried.
- Remaining: reset-script review and publication, operator cleanup and reprovisioning, runner-group and repository-variable changes, live canary, and token revocation.
- Delivery layer: draft PR #5576; merge and live actions remain withheld.
- Runtime: none started.
