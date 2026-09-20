# Production Topology Spread Plan

## Goal

Make the declared production scheduling policies reach the Kubernetes pod
specifications as one narrow deployment-correctness fix on current `v3`, and
carry the same `deploy/` revision to `v3-ai` so a later chart promotion cannot
drop it. The PR ends as a reviewed, verified draft and synchronizes no
environment.

## Settled contract

- Render topology-spread constraints for the three Hatchet workers, the
  assessment frontend, and the assessment backend. The two MCP servers keep the
  constraints their templates already render.
- Both assessment frontend selectors — the preferred pod anti-affinity term and
  both spread constraints — match
  `app.kubernetes.io/component: frontend-assessment`.
- Production scheduling intent is unchanged: soft `ScheduleAnyway` constraints
  with `maxSkew: 1` across zone and hostname.
- Empty chart defaults render no spread field at all.
- The verifier asserts the scheduling settings rather than only the constraint
  count, and the required `check` workflow runs it.
- `deploy/` stays identical on `v3` and `v3-ai`, which the deploy-parity gate
  requires.

## Non-goals

- Do not change replica counts, autoscaling, pod disruption budgets, resource
  requests, affinity intent, or staging values.
- Do not remove or weaken the MCP spread policies to satisfy a check.
- Do not add Chat high-availability settings.
- Do not deploy, run ArgoCD sync, patch live Deployments, or establish cluster
  connectivity.

## Plan identity and authority

- Plan path: `project/2026-08-30-production-topology-spread-plan.md`
- Branch and worktree: `rs/production-topology-spread` in
  `trees/rs/production-topology-spread`; the carry-forward branch targets
  `v3-ai`
- Delivery: this PR against `v3`, plus one draft PR against `v3-ai`
- Integrated base: `origin/v3` at
  `02aaaa87b14c2d27db8ceb9a8e617ec5a5875fef`, integrated once in `36e8e93cc4`
- Current authority: the review's completion scope — refresh against current
  `v3`, retain the missing rendering and selector fixes, update and automate the
  verifier, run fresh checks and review, and carry the fix to `v3-ai`
- Withheld actions: merge, marking ready, deployment, ArgoCD sync, live cluster
  or environment writes, and any production rollout window

## Current findings (revalidated on the integrated base)

- Production values define zone and hostname constraints for seven workloads.
- Three worker templates and both assessment templates did not forward the
  value, so five declared policies stayed inert. The two MCP templates already
  rendered theirs, which is why the production render carries two and not seven.
- The assessment frontend values select `frontend-pwa-assessment` although the
  pod label is `frontend-assessment`, in the anti-affinity term and in both
  spread constraints.
- Current `v3` already nests the assessment constraints at the workload level,
  so the original move out of `affinity` is superseded and is not reintroduced.
- The previous verifier expected exactly five workloads and checked only
  presence, constraint count, and the component label. It also searched the
  default render for the field name as a serialized substring.
- No workflow rendered or linted the chart.

## Review feedback disposition

| Finding | Disposition |
| --- | --- |
| Refresh the branch without undoing the recent deployment work | `origin/v3` is integrated in `36e8e93cc4`. The promotion's MCP templates, health and termination settings, replica and PDB configuration, and image pins are preserved; only the five template blocks and the three assessment frontend selector values survive from the original change. |
| Five newly affected deployments is not five total deployments | The verifier pins all seven production workloads and marks the MCP pair as pre-existing, so their policies are asserted instead of removed. |
| Validate the scheduling settings, not only the constraint count | The verifier requires exactly one zone and one hostname constraint per expected workload with `maxSkew: 1`, `whenUnsatisfiable: ScheduleAnyway`, and a selector matching the pod label, and replaces the substring search with a structural walk. |
| Make the render check an automated deployment check | The required `check` workflow lints and renders defaults, staging, and production and then runs the verifier. `deploy/scripts/verify-topology-spread.test.mjs` proves that a wrong selector, a missing zone constraint, a hard policy, and an unlisted workload all fail. |
| Carry the fix forward so a later promotion preserves it | A `v3-ai` branch carries the identical `deploy/` revision. The deploy-parity gate requires that revision to land before this PR can be green. |

## Execution slices

### Slice 1: Integrate current `v3` (done)

Do:

- Merge `origin/v3` into the branch and resolve the production values conflict
  by keeping only the selector corrections.

Check:

- The delta against `origin/v3` is limited to the five template blocks, the
  empty defaults, and the three selector values.

Commit:

- `chore(sync): integrate latest v3 base`

### Slice 2: Verify the complete contract (done)

Do:

- Assert one zone and one hostname constraint per expected workload, with
  `maxSkew`, `whenUnsatisfiable`, and the selector checked.
- Pin all seven production workloads and reject constraints on any other.
- Replace the default-render substring search with a structural walk.
- Lint and render defaults, staging, and production.
- Add negative cases for a wrong selector, a missing zone constraint, a hard
  policy, a maxSkew above one, an absent deployment, and an unlisted workload.

Check:

- `node --test deploy/scripts/verify-topology-spread.test.mjs` fails on every
  negative fixture and accepts the rendered contract.
- `node deploy/scripts/verify-topology-spread.mjs` reports five newly rendered
  and two pre-existing workloads on the production render.

Commit:

- `test(deploy): verify the complete topology spread contract`

### Slice 3: Automate and document the check (done)

Do:

- Run the verifier and its negative cases in the required `check` workflow.
- Update `docs/ci-and-deployment.md` and the verification skill with the
  seven-workload contract and the level of detail the check asserts.

Commit:

- `ci(deploy): run the chart scheduling check in the required check workflow`
- `docs(deploy): document the seven-workload topology spread contract`

### Slice 4: Carry the `deploy/` revision to `v3-ai`

Do:

- Branch from `origin/v3-ai`, apply the identical `deploy/` revision, and open
  one draft PR against `v3-ai`.

Check:

- `node .github/scripts/deploy-parity.cjs --other v3-ai --candidate <branch>`
  reports parity for that branch, and this branch's delta against `v3-ai`
  contains only expected differences.

### Slice 5: Fresh checks and review

Do:

- Run the chart check, the repository checks on the touched paths, and the
  before/after render comparison.
- Refresh the PR description and request the hosted final review for the
  integrated head.

Check:

- The five rendered pod specs change and nothing else does.
- The hosted checks for the exact head pass, and the review findings are
  dispositioned.

## Test portfolio

| Risk | Smallest observing check |
| --- | --- |
| Values remain ignored | Render and parse the production manifest |
| Wrong nesting | Assert the field at `spec.template.spec` |
| Selector mismatch | Compare every constraint selector with the pod label |
| Hard or skewed policy | Assert `whenUnsatisfiable` and `maxSkew` per workload |
| Empty defaults emit invalid YAML | Render chart defaults and parse every document |
| A workload gains constraints unnoticed | Reject constraints outside the expected contract |
| Unrelated scheduling changes | Diff the five rendered Deployments before and after |

## Rollout and proof boundary

1. Merge authority is separate from this plan.
2. The `v3-ai` revision must carry the same `deploy/` content first.
3. Production Argo tracks mutable `v3` with automated sync, so merging is the
   deployment trigger: it needs explicit production-change authority and a
   window outside active assessments.
4. Before sync, capture the exact source SHA, chart render, target image
   annotations, and current drift.
5. After sync, prove the five workloads' live constraints, readiness, and
   placement, and confirm the two MCP pod specs stayed unchanged.
6. The assessment workloads are restricted to nodes labelled
   `klickerasm=reserved`; check the eligible nodes' hostname and zone labels
   before rollout, because a zone preference cannot spread a single-zone pool.
7. Roll back through desired state if scheduling becomes unsatisfiable; never
   live-patch Argo-managed objects.

## Pause conditions

- Stop if any spread rule targets a label that is absent from the same pod
  template.
- Stop if the fix requires replica, PDB, autoscaling, affinity, or staging
  changes.
- Stop if durable rendering verification requires a new dependency or a CI
  redesign; report the gap and retain focused local render proof.
- Stop before upstream integration when `origin/v3` moves again after this
  integration; report the drift and request the next integration.

## Delegation and review ownership

- The main session owns implementation because defaults, templates, production
  values, selectors, and the render assertions form one small integration.
- No implementation slice is delegated.
- The committed chart range receives simplifier and infrastructure-risk review.
  One final reviewer covers the integrated branch.
- The main session verifies every finding and retains integration ownership.

## Progress

- [x] Refresh remote refs and revalidate the five values blocks and both
      assessment defects on current `v3`.
- [x] Commit the plan and implement the first chart slice.
- [x] Integrate `origin/v3` and keep only the still-needed scheduling changes.
- [x] Extend the verifier to seven workloads with setting-level assertions and
      negative cases.
- [x] Run the verifier from the required `check` workflow.
- [x] Update the deployment wiki and the verification skill.
- [x] Carry the `deploy/` revision to `v3-ai` and open its draft PR (#6180,
      still open; it must land before the parity gate can pass on this branch).
- [ ] Run fresh checks and the hosted final review on the integrated head.
- [ ] Refresh the PR description for the final scope.
