# V3 release operational approval packets

## Authority and status

Preparation only. None of these packets is executable until its named targets, operator, evidence and separate approval are filled in. The user approved local qualification, not live access, data copying, publication, approval writes, GrowthBook changes or deployment. No production records or credentials belong in this file.

Source candidate: `7c73ed231ce89885f634d37fece86c621424f617`. The [qualification manifest](2026-09-07-v3-release-qualification-manifest.md) owns source checksums and test evidence. Any accepted release-tooling correction must be present in the eventual published release SHA.

## Live preflight: identify every database and client

Approver/operator: infrastructure and database owner, not yet named. Targets: connectivity route, cluster/context, namespaces, database identities and exact client workloads are pending. Approval must explicitly permit that connection and narrowly scoped values-free reads. No connection is established by local qualification.

Required receipt: reconcile each database migration ledger and SQL checksum with the seven-file source inventory; map primary backend, assessment backend, Chat, both worker classes and assessment workers, Auth, LTI, OLAT, response APIs, Analytics and independent administrative clients. Record whether assessment shares the primary database. Resolve each running and rollback image to its generated-client schema; a tag alone is insufficient.

The general release tag defines the source comparison, not the actual pending migration range. Each database's verified ledger defines that range. Never infer database state from an intermediate Chat-only tag.

The source migration Job reads the primary backend Secret. It does not independently prove assessment coverage. Analytics has its own generated schema/client and must be explicitly accounted for even if deployed outside this chart. Inspect non-secret configuration references, not secret values.

Required recovery evidence: backup identifier and successful recovery rehearsal, owner, location/access controls, recovery time/data-loss objectives and a compatible application set. Record actual automation ownership: Argo/ApplicationSet sync and self-heal, autoscalers, Reloader, retries, scheduled work and external clients. Missing identities, inconsistent ledgers, unknown clients or absent recovery proof prevent execution. Terminal: sanitized read-only preflight receipt, not approval to mutate.

## Isolated migration rehearsal

Approver/operator: database owner plus responsible data steward, pending. Source and destination: exact production-derived snapshot and isolated destination, pending. The approval must establish purpose and processing basis, minimization, encryption, operator-only access, retention expiry and verified cleanup.

A production-derived clone is not disposable test data. Never apply the test-database marker to it, adopt it through bootstrap, or run reset/seed/Playwright cleanup against it. No clone content, account identifiers, tokens or conversations enter Git, external model prompts, screenshots or ordinary logs.

Rehearse the entire live-pending migration range using the selected matching migrator, then start only schema-compatible candidate clients. Check defaults, historical backfills, ledger/checksums, application reads, Analytics, locks, recovery and the old-client exclusion. Set numerical lock/drain/runtime limits with the operator before execution; do not invent limits from source defaults. Stop on unexpected migration identity, data change, contention or application failure. Recovery uses the approved isolated restoration procedure. Terminal: rehearsal receipt and verified retention/cleanup disposition, never a production activation.

## Source publication and immutable artifacts

Approver: release owner, pending. Confirm version/channel and exact versioned commit, remote and tag before any push. Run the repository dry-run first and verify its intended package coverage and unchanged working tree, versions, changelog, HEAD and tags.

Production tag builds and deployment are separate actions. Require successful production-configured ARM application builds, corresponding migrator, exact digests and release-SHA provenance. Do not reuse staging build arguments or label an image production-ready merely because its source matches. Record chart and values revisions independently. The migrator tag defaults to the primary backend tag in source; verify the actual artifact before pinning values.

Abort publication on incomplete source qualification or unintended version scope. Abort deployment preparation on missing or mismatched images, configuration or migrator. Terminal: immutable source/artifact manifest; no deployment authority.

## AI approval and controlled maintenance

Approvers/operators: AI policy owner, database operator and release operator, pending. The private approved-owner set must identify only the exact intended accounts through operator-controlled records. Require evidence of valid provider provisioning, policy approval and intended continuity or explicitly accepted interruption. Published chatbot status, beta preference, a cost-center string, and token presence alone are not approval evidence.

At inspected v3-ai source `654621094c63`, `setAiFeatures` checks the administrator role and writes the requested Boolean; it does not validate a provider API token. Its notification is an external effect. Separate lecturer/participant MCP tokens authorize scoped MCP calls and do not prove provider billing-token validity. Do not import all of v3-ai or execute its mutation by implication. The chosen narrow provisioning/validation operation remains to be specified and approved.

The sequence below is a required ordering contract, not an approved command list. Exact commands and thresholds must be reviewed after topology is known.

| Phase                           | Required observable completion before continuing                                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fence and drain                 | Block incoming traffic and new producers; drain/reconcile existing work under agreed time bounds; prevent automation from restoring clients           |
| Stop incompatible clients       | Prove every old generated client that selects the dropped column is absent, including independent/assessment/Analytics clients                        |
| Migrate and validate            | Complete the exact pending range on every applicable database; verify ledger, expected schema/defaults/backfills and recovery readiness               |
| Apply approved owners and start | Conditionally apply the exact private approval set after the column exists; record expected versus actual changes; start only compatible applications |
| Smoke and reopen                | Confirm critical flows, denied unapproved AI use, approved Chat access and worker health before reopening traffic/producers                           |

Argo PreSync executes before ordinary Deployment changes. Setting replicas to zero in the same sync as the migration does not establish the stop-before-drop requirement. Use separately completed controlled phases. Selective sync does not execute hooks. Actual commands must account for all automation owners from preflight.

Standard automatic rollout must be suspended or gated before this incompatible upgrade can trigger PreSync. Prove the traffic fence, drain and client-stop phases complete before permitting the migration-bearing sync. The exact automation controls require a separately reviewed operational diff; this document changes none of them.

Any failed phase holds traffic fenced. Do not restore an old incompatible application as a shortcut. Application rollback cannot restore a dropped column; recovery follows the rehearsed data/application procedure. Lifecycle tracking also requires complete-only Chat readers; pre-lifecycle unfiltered readers are not a valid rollback floor under ADR 0041.

Previously reported Chat-history findings are not cleared by this release. [Server-authoritative history](https://github.com/uzh-bf/klicker-uzh/pull/5676) makes PostgreSQL, rather than browser-composed messages, the authority for model context. Its branch plan and ADR 0044 establish that intended boundary, but its open PR and partial review record do not prove delivery into this candidate. Disposition: unresolved activation gate. Require fixed evidence, proven non-applicability or separately approved containment before activation; do not import the whole branch automatically. No broad assessment or vulnerability reproduction is authorized here.

Packaging does not enable AI use. Do not apply the owner-approval set until the history gate and provider-provisioning gate are cleared. Preserve default-false AI approval while those gates remain unresolved; any interruption of existing Chat needs explicit operator and policy-owner acceptance before cutover.

## GrowthBook canary

Approver/operator: rollout owner, pending. Target: exact environment, flag and rule diff, pending. Keep existing targeting through deployment, verify the new trusted `betaEnabled` attribute, then canary the approved rule change. Preserve actor, Catalyst, environment, role, narrow cohort and DB opt-out conditions.

Default-on preference must not silently expand the eligible population. Account AI approval remains separate. Beta enrollment needs no GrowthBook management provisioning; general backend management API configuration stays intact for other flags.

Acceptance: only the approved cohort gains intended authoring access; opt-out still denies authoring; no unapproved account incurs model work. On failure restore the prior rule while retaining the application DB opt-out guard. No force-on bypass, incompatible image rollback, saved-group deletion or additional cohort expansion. Terminal: bounded canary/back-out receipt.
