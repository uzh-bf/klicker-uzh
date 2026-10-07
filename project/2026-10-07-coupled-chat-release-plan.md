# Couple the GPT-6 registry promotion to compatible release images

## Approval summary

The deployment-values promotion currently combines GPT-6 configuration with
alpha.84 application images. Those images require GPT-5.6 as the participant
base model. A values-only production merge would fail registry validation.

Prepare the existing [PR #6403](https://github.com/uzh-bf/klicker-uzh/pull/6403)
as one production change containing the current reviewed configuration and all
seventeen proposed alpha.85 application image pins. Keep the staging image
references and both disabled account-usage switches unchanged. Preserve the
overlapping [PR #6332](https://github.com/uzh-bf/klicker-uzh/pull/6332); its closure
needs an explicit decision. Application source stays on v3-ai, not this branch.

The proposed tag does not exist yet. Draft pins are preparation, not deployable
release evidence. Completion means a verified, reviewed draft with explicit
publication, migration and runtime prerequisites. It does not mean production
is ready. The user approved takeover and preparation on October 7. Approval mode:
executable batch. Local edits, commits, ordinary task-branch pushes and updating
the existing draft description are authorized. Marking ready, merge, release or
tag publication, promotion, deployment, SQL, backfill, replay, cleanup and new
connectivity remain separate gates.

## Execution details

### Source and compatibility contract

- Target v3: 6189a7487b912a1d9e95769b2f3bb6434c34ccea.
- Existing PR head: 415e764a71e0be046c0f798b62449e0174552784.
- Reviewed release source: v3-ai 8add9f27198ccdb1846b602c1a3688c0fb3bbc2b.
  Its twelve push workflows passed. The official dry run proposes alpha.85.
- Alpha.84 source still exports CHAT_BASE_MODEL_ID = gpt-5.6-luna. The release
  source requires gpt-6-luna and permits Auto as another BASE model.
- Preserve configuration parity with that exact release source, excluding
  environment-owned tag/pullPolicy fields. Compare working values directly with
  that source, then run the committed-tree parity command and record resolved
  candidate/other SHAs; exit zero alone is insufficient if evaluation skipped.
  Validate both consumers in apps/chat/src/lib/server/chatModelRegistry.ts and
  packages/graphql/src/services/chatbots.ts through the existing candidate
  modelRegistryParity.test.ts with the prepared values mounted at its inputs.
  Prove the rendered JSON equals those tested inputs for each ConfigMap. Reused
  tooling must have byte-identical parser, utility policy and test source.
- The deployment branch's v3 application code is not the released binary.
  Its skipped unit/GraphQL checks do not prove the candidate's compatibility.

### Ownership, package and sequence

Execution mode: standard. Full-path configuration/release seam package. The
existing two values files have 203 substantive changed lines against v3 before
preparation. One writer owns the existing worktree and draft; no new PR or stack.

Main owns coupled integration and publication effects. Mechanical preparation
is smaller than dispatch overhead; no separate implementation worker is needed.
The read-only planner challenges this derived plan; an independent final review
covers the complete committed three-file package. Simplification is skipped for
mechanical pins and documentation. The final review also covers the coupled seam.

Delegation Map: the single preparation slice (steps 1–3) belongs to main; route
main, skip reason critical-path coupling and mechanical work below dispatch cost.
Its acceptance is the complete verification checklist followed by review and
draft delivery. The new tracked file is this plan. Retained ignored artifacts:
project/_local/coupled-release-verify.mjs, project/_local/reviews/, the prepared
PR body, and the existing ingestion-failure-reasons/project/_local/
release-alpha85-preview.md receipt. No other tracked files are added.

1. Record the approved plan, then change only seventeen alpha.84 pins to the
   proposed alpha.85 in deploy/env-uzh-prd/values.yaml. Preserve all other values.
2. Verify deployment parity, both Helm renders, all rendered application image
   references, identical chat/backend registries, candidate policy compatibility,
   disabled usage switches and unchanged staging references. Include the derived
   migrator reference at alpha.85 and retained PreSync hook. Use network-disabled
   disposable tooling when dependencies are required; start no application.
3. Commit, independently review, ordinary-push the correction and update #6403's
   draft description with verification and the blocking release prerequisites.
   Refresh the retained release preview receipt. Leave #6332 unchanged.

### Verification and future admission

No new test file: existing parity, rendering and candidate contracts cover this
declarative correction. Verification records exact source and deployment heads.
Check staged data hygiene and formatting before each commit. Preserve required
hosted CI and human reviews; local proof does not replace them. Reuse checks for
unchanged source rather than rebuilding the monorepo or rerunning paid E2E.

Test portfolio (new-test obligation: none for each row):

| Risk | Existing seam and acceptance |
| --- | --- |
| Configuration differs from the reviewed source | Exact-source normalized values comparison and evaluated committed deployment parity. |
| Either registry consumer rejects the rendered JSON | Existing candidate parity suite runs both actual consumers on prepared values; verify rendered inputs are identical. |
| Workloads or migrator keep incompatible image tags | Check every rendered application image and the PreSync migrator against the prepared release pin. |
| Preparation changes staging refs or usage activation | Structured values comparison, unchanged staging file and disabled switches in rendered ConfigMaps. |

Before readiness or merge, separately approve and verify the actual alpha.85
release commit/tag and immutable images for every pin plus the derived migrator.
Confirm the tag descends
from the reviewed source with only reviewed release metadata. Recheck the four
pending migrations against the actual environment, backups/recovery and migrator
availability. Verify provider aliases and removed-model allow-list compatibility
through values-free scoped preflight. Keep values and image pins in one Argo
revision; PreSync migration must succeed before workloads roll. Application
rollback alone cannot undo the data migrations. A failed condition blocks merge
and rollout; do not substitute values-only deployment, retries or database repair.

### Working context

Worktree: trees/promote-deploy-1006. Branch: chore/promote-deploy-v3-ai-1006.
Artifacts root: project/. Existing ingestion production goal remains blocked.
The finite terminal here is source preparation delivered in the existing draft,
with missing release/runtime evidence clearly identified.

## Progress

Owner: AI Ingestion PRD. Human preparation approval received October 7, 2026.
Fresh forge and Git state match the source and target above. Worktree is clean.
Planning review: APPROVED after one correction round covering exact-source
parity, migrator coupling, both parser consumers and bounded verification scope.
The optional AGY rival pass has a previously recorded terminal permission failure
in this task and is unpassed. Status: implementation starting. Publication and
runtime gates are unresolved. Review receipts belong in project/_local/reviews/.
