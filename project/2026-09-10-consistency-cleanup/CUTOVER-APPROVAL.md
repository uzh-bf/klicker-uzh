# CUTOVER-APPROVAL — BLOCKED, NOT EXECUTABLE

This packet does not request blanket approval. Exact final source PR heads, PRD preview, current manifest semantics, candidate digest receipt and containment proof must be attached before any listed write is executable. No shared-ref or live action is authorized by this document.

## Verified controller identities and proposed effects

| Target                | Before                                                                                 | Proposed                                                   | Direct / indirect effect and gate                                                                  |
| --------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| GitHub stable/default | v3, now 880987ffa122ac2d3364516fd217421929b27e76                                       | Trusted-only patch; no AI application history              | Workflow evaluation changes; merge requires exact reviewed PR                                      |
| Maintenance           | v3-ai, latest observed 1d85533a65ea71552cca290c9fa75908ebcac922                        | Accepted cleanup candidate                                 | Source build triggers; hold STG writer before shared merge                                         |
| Audit                 | v3-audit 352f47fd7443d93aa5720e863d6285b801cceebe                                      | Forward merge accepted maintenance                         | Builds only until separately approved staging promotion                                            |
| PRD Application       | aks-prd-apps-admin, argo/app-klicker, Pulumi manager; target v3; namespace prd-klicker | Same identity, chart/values v3-ai, automatic sync disabled | df-cloud apps-klicker stack PRD preview and approved apply; no child-only patch treated as durable |
| Helm input            | deploy/charts/klicker-uzh-v3; ../../env-uzh-prd/values.yaml; no global override        | Same paths and individual artifact pins                    | Chat/worker pod-template changes remain unaccepted; no sync until three-way approval               |
| STG Application       | aks-stg-apps-admin, argo/app-klicker; stg-release                                      | unchanged                                                  | Retain global.imageTag=$ARGOCD_APP_REVISION and digest checks                                      |
| STG variables         | STG_SOURCE_BRANCH=v3-ai; STG_RELEASE_PROMOTION_ENABLED=true                            | v3-audit; false during interval                            | Variable write separately approved; manual apply paths and in-flight runs accounted for            |

PRD artifacts remain v3.4.0-alpha.75-ai.1, peeled source 2c78bd1392345e149be56e7c0f69d7b1e14a1dfa. Migrator digest sha256:ebe1b1eb918c99df083168d7dd9d3a7d498b3278fd0fd0c44814bbde1dadc461. All workload digests are in the private local runtime receipt; operator must accept that exact inventory. Current maintenance source contains one pending migration and must not be released implicitly.

## Ordered conditional sequence for later exact approval

1. Operator and independent verifier accept a current baseline: all workloads/digests, primary/assessment/Analytics clients, migration checksum ledgers, workflow registrations and denied features. Resolve ingestion containment separately; existing health repair is not this approval.
2. Establish PRD activation hold through its authoritative Pulumi policy and STG writer hold. Inspect in-flight workflow dispatches, current .operation, ApplicationSet/app-of-apps ownership, Reloader and external secret reconcilers. Do not cancel an active migration or remove resources. A false variable alone does not stop a running writer.
3. Merge the exact reviewed maintenance task PR using normal merge ancestry, then the audit forward-integration PR and narrow trusted-CI PR. Re-read heads, ancestry and migration hashes. Retarget only the separately accepted root list from pr-routing.md; preserve children.
4. Apply the exact apps-klicker PRD preview of infrastructure MR 557, with source v3-ai and auto-sync held. Before any manual sync, compare live/current desired/proposed manifests, resource/prune inventory, all templates/configuration/secret precedence, replicas and capabilities. Current proposed chart still changes Chat/worker runtime and LTI replica ownership. Those deltas need explicit acceptance or removal.
5. The pinned PreSync migrator is expected to have no pending incident SQL on the two checked PRD clients. Refresh before sync and prove independent Analytics/other clients. The newer authoring migration must not enter the pinned migrator. Any unexpected SQL blocks the operation.
6. Set the STG selector to v3-audit while writer is held. Produce supported dry-run receipt for exact candidate: all publisher jobs, image inventory, full-SHA/digests and stg-release ancestry. Candidate containing unreviewed audit SQL stops here. Promotion and re-enablement are separately named approval choices.
7. Read back every approved effect. Leave PRD autosync disabled until a later exact candidate/configuration approval. Do not restore an unsafe automatic path merely because it was previously enabled.

No generic kubectl/Pulumi write commands are supplied while exact-stack PRD preview and manifest acceptance are missing. The supported preview helper only targets STG; request the operator's existing PRD preview-only route, not local Pulumi credentials or a broad apply.

## Recovery and invalidation

Restore only the prior approved controller/source/values when both rendered workload and current database compatibility are proven. Do not downgrade application images, rewrite migration history, force-reset stg-release, delete state or restore an audit DB. Any unintended SQL returns to incident handling. New source, digest, schema, infrastructure plan or capability change invalidates the corresponding approval portion. Refresh immediately before writes.

## Candidate isolation specification

Provisioning is not authorized. Candidate target must bind the exact maintenance SHA and production schema baseline, with dedicated database identity, Redis databases/instances, Hatchet tenant/task namespace and queues, storage account/container scope and outbound credentials. Disable real email/provider callbacks and paid dispatch. Use synthetic destructive suites separately from a protected production-derived upgrade rehearsal. Validate isolation before any release qualification; audit staging is unsuitable once schema advances.

## Prepared source publication

Maintenance PR #5881 at tested candidate 5b63ea881cabf4b7785e6f5bbfe49a976fa44f72; audit PR #5883 at 0fadf15c12c91a398a7422632915a43c3a40a6c0; trusted-CI PR #5882; infrastructure MR !557 at 33f58e76253a505a751e041127ecc5dfe8a794d8. Final documentation commits must be resolved to exact remote heads before any approval. All are drafts; none authorizes a shared merge. Audit tree equals maintenance and contains current staging ancestor. No published audit-candidate digest receipt exists, so staging promotion is not executable.

Latest live invalidation: PRD worker ConfigMap is OutOfSync, although health is Healthy and all four general workers are ready. Ingestion stop remains unset. Reconcile this drift and refresh effective inputs before approval; no current desired/live equality is claimed. Trusted-CI published head is 8efc6509b7 (resolve full remote head before approval).

Independent source correction review passed at ae2e21c15e941f1d8e696be45c7da21fb98dac22. Audit source 934426756e4c1291ca1c1d6cbaf0b480b46b3d4e contains that maintenance head and has the identical tree; trusted control 713af2428ba1c68de824de9fd914cf99bc3329fe. This review clears source findings only; all listed operational prerequisites remain blocking. Resolve documentation-only successor heads before requesting exact approval.
