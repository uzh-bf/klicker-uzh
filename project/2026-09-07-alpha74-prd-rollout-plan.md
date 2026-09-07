# Prepare the alpha.74 production rollout PR

## Approval summary

Prepare the user-requested draft PR to deploy `v3.4.0-alpha.74`, release commit `4e8435e134f79f33380ac62dc1bccbcb41371173`. Change only the fifteen application image tags in `deploy/env-uzh-prd/values.yaml`. The existing enabled migrator inherits the backend tag. Preserve every other configuration value, including replicas, resource limits, flags, secret references, and staging configuration.

This is preparation, not permission to merge or deploy. Argo auto-sync can run the PreSync migration Job when this change lands. A draft label does not prevent that effect after merge. The PR must remain draft with an explicit merge warning until separately approved operational sequencing and client compatibility are resolved. AI approval and history gates remain distinct from image publication. Recovery exercises are outside this PR.

Success means the rendered difference contains exactly fifteen Deployment image changes and one migration Job image change, all referencing published ARM artifacts. Resource identities and every non-image field must be unchanged. Finish with the reviewed draft PR, not a cluster mutation.

## Execution details

Authority: the user requested CI fixes and a separate production rollout PR. Routine local preparation, checks, commits, task-branch pushes and draft PR creation are included. Merge, protected-branch pushes, migrations, deployment and flag changes are withheld.

Terminal: verified task-branch publication and draft PR. Boundary owner: self. Pause on unexpected render changes, missing artifacts, a required review failure, or a new operational decision.

Base: `v3` at the release commit. Branch: `codex/alpha74-prd-rollout`. Existing source qualification and operational contracts remain in [the cutover packets](2026-09-07-v3-release-cutover-packets.md). Their publication-pending statements are historical: thirteen workflows and fourteen ARM artifacts, including Analytics and the migrator, were verified after tagging. Analytics has no image pin in these values; this PR affects thirteen distinct image repositories.

### Ownership and checks

Main owns the pin change, artifact comparison and delivery because their evidence is tightly coupled. Independent planner, slice reviewer and final reviewer cover the migration-triggering configuration. The change is mechanical; simplification is not needed. No product primitive, new architectural decision, dependency, new test or runtime is introduced.

Compare baseline and candidate Helm renders with identical chart, release name `app-klicker`, namespace `prd-klicker`, and values inputs. Require identical resource identities and non-image fields. Run Helm lint and diff hygiene. Verify every resulting image reference against the registry's ARM manifest and digest. No live API, database, application runtime or production content is required.

### Merge boundary

Before merge, obtain separate approval for the actual operation and resolve automation gating, traffic/drain sequencing, incompatible-client exclusion and AI activation disposition under the existing cutover packet. This PR neither implements those controls nor declares them completed. It must not be merged as an ordinary unattended rolling update.

### Review and progress

Planner reviewed draft `alpha74-prd-rollout-draft-1`: APPROVED for draft preparation only. Accepted clarifications: exact render invariants, thirteen affected repositories versus fourteen published artifacts, and explicit draft-only terminal condition. No preparation blocker identified. Optional opposing-provider consultation has not produced a result; it is not claimed as passed.

Status: planning review complete; pin preparation and verification pending. The user has already requested this bounded preparation. No production action is authorized.
