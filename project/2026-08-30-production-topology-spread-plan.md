# Production Topology Spread Plan

## Goal

Prepare one independent chart PR against current `v3` that renders the five
existing production topology-spread policies into the intended pod specs and
corrects the assessment frontend selector. The PR ends as a reviewed, verified
draft PR and does not synchronize any environment.

## Settled contract

- Render topology-spread constraints for:
  - general Hatchet worker;
  - response-processor Hatchet worker;
  - assessment response-processor Hatchet worker;
  - assessment frontend;
  - assessment backend.
- Keep production scheduling intent unchanged apart from making the existing
  values effective.
- Both assessment frontend anti-affinity and topology-spread selectors must match
  `app.kubernetes.io/component: frontend-assessment`.
- Empty chart defaults omit the field cleanly.

## Non-goals

- Do not change replica counts, autoscaling, pod disruption budgets, resource
  requests, affinity intent, or staging values.
- Do not add Chat high-availability settings.
- Do not deploy, run ArgoCD sync, patch live Deployments, or establish cluster
  connectivity.
- Do not merge or edit the chatbot authoring stack.

## Plan identity and authority

- Plan path: `project/2026-08-30-production-topology-spread-plan.md`
- Branch: `rs/production-topology-spread`
- Target branch: `v3`
- Base: `origin/v3` at
  `acf56b5331a24d4f53729046d9784d4aed006f65`
- Worktree: `trees/rs/production-topology-spread`
- Delivery: one independent draft PR targeting `v3`
- Current authority: planning and reversible local preparation only
- Approval terminal: in-scope chart/docs edits, rendered-manifest checks,
  required reviews, conventional commits, push, and draft PR creation
- Withheld actions: upstream integration, merge, deployment, ArgoCD sync, and
  every cluster write

## Current findings

- Production values define five topology-spread constraint blocks.
- None of the corresponding deployment templates renders those values.
- The two assessment blocks are nested beneath `affinity` in production
  values, so they cannot become pod-spec fields.
- The assessment frontend block selects
  `frontend-pwa-assessment`, while the Deployment pod label is
  `frontend-assessment`.
- Prior live evidence showed no spread constraints on the assessment
  Deployments. This plan treats that only as prior runtime evidence; source
  verification does not claim live reconciliation.

## Product and architecture decisions

- This is a declarative delivery correction with no product-primitive or ADR
  impact.
- Keep the values API consistent: each affected workload gets
  `topologySpreadConstraints: []` in chart defaults and templates render it at
  `spec.template.spec`.
- Add a focused rendered-manifest assertion because values-only inspection did
  not detect the omitted template wiring.
- Update `docs/ci-and-deployment.md` with the chart contract and the separate
  source, desired-state, and live-proof boundaries.

## Planning-stage review

- Reviewer: Sol planner `Hypatia`, read-only, on the exact current base.
- Verdict: `DONE_WITH_CONCERNS`.
- Accepted findings:
  - Merging this PR is itself a production action because production Argo tracks
    mutable `v3` with auto-sync. Source completion does not authorize merge.
  - Correct both assessment frontend selectors, not only the spread selector.
  - Add one no-new-dependency rendered-manifest assertion for the complete
    five-workload contract.
- No planning concern requires another product decision.

## Execution slices

### Slice 1: Commit the approved plan

Do:

- Incorporate the planning review and final user rulings.
- Commit only this plan after explicit approval.

Commit:

- `docs(project): plan production topology spread fix`

### Slice 2: Render and verify the five policies

Do:

- Add empty defaults for all five workload values.
- Render each non-empty value at the pod-spec level after affinity.
- Move assessment constraints out of affinity in production values.
- Correct the assessment frontend anti-affinity and topology-spread selectors.
- Add a no-new-dependency focused Node assertion that invokes `helm template`,
  parses with existing repository libraries, and identifies Deployments by
  their component label.
- Update the deployment wiki.
- Update `.agents/skills/klicker-testing-verification/SKILL.md`.

Check:

- `helm lint` passes with chart defaults and production values.
- A production `helm template` render contains exactly one intended
  constraint list on each of the five Deployment pod specs.
- Each constraint selector matches its Deployment pod label.
- A default-values render omits empty constraint fields.
- Rendered YAML passes a client-side schema or structural parse check available
  in the supported environment.

Commit:

- `fix(deploy): render production topology spread constraints`

### Slice 3: Review and open the draft PR

Do:

- Run chart-focused checks and applicable repository format checks.
- Complete the required simplifier and infrastructure-risk slice review on the
  committed chart range.
- Complete one integrated final review.
- Inspect the diff for unrelated environment changes and secret values.
- Push this branch and open one draft PR targeting `v3`.

Check:

- The PR reports rendered-manifest evidence and explicitly withholds a live
  rollout claim.

## Test portfolio

| Risk | Smallest observing check |
| --- | --- |
| Values remain ignored | Render and parse the production manifest |
| Wrong nesting | Assert the field exists at `spec.template.spec` |
| Selector mismatch | Compare each constraint selector with pod labels |
| Empty defaults emit invalid YAML | Render chart defaults and parse all documents |
| Unrelated scheduling changes | Diff the five rendered Deployments before and after |

## Rollout and proof boundary

1. Merge authority is separate from this plan.
2. Because production Argo auto-syncs mutable `v3`, merging this PR requires
   explicit production-change authority, an approved window, and monitoring.
3. Before Argo sync, capture the exact source SHA, chart render, target image
   annotations, and current drift.
4. After sync, prove the exact Deployment generations and pod specs contain the
   constraints.
5. Confirm pods distribute across the available zone and hostname topology
   keys without blocking scheduling.
6. Roll back through desired state if scheduling becomes unsatisfiable; do not
   live-patch Pulumi or Argo-managed objects.

## Pause conditions

- Stop if any spread rule targets a label not present on the same pod template.
- Stop if the fix requires replica, PDB, autoscaling, affinity, or staging
  changes.
- Stop if durable rendering verification requires a new dependency or CI
  redesign; report the gap and retain focused local render proof.
- Stop before upstream integration if `origin/v3` moves after implementation;
  report drift and request the one integration approval.

## Delegation and review ownership

- The main session owns implementation because defaults, templates, production
  values, selectors, and render assertions form one small integration.
- No implementation slice is delegated.
- The committed chart slice receives simplifier and rollout/configuration
  review. One final reviewer covers the integrated branch.
- The main session verifies every finding and retains integration ownership.

## Progress

- [x] Refreshed remote refs and created a clean worktree at current `origin/v3`.
- [x] Revalidated all five values blocks and both assessment defects.
- [x] Disposition the independent planning review.
- [ ] Receive one-time approval for this execution plan.
- [ ] Commit the plan and implement Slice 2.
- [ ] Run rendered-manifest checks and required reviews.
- [ ] Push and open the draft PR.
