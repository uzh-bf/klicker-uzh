# PRD-to-STG database refresh

## Goal

Provide one operator-run script that replaces the Klicker STG PostgreSQL data
with a consistent logical dump of PRD, then triggers the existing ArgoCD sync so
the STG `PreSync` migrator applies every migration required by the currently
deployed STG release before workloads resume.

## Non-goals

- Preserve or back up the previous STG data; the user explicitly declared it
  disposable.
- Copy Redis, Blob Storage, Hatchet state, or any external integration.
- Sanitize PRD data. The script instead requires an explicit raw-data approval
  gate and keeps the dump encrypted at rest.
- Change Prisma schema, GraphQL, application UI, gamification behavior, or
  deployment manifests.
- Run against PRD as a mutation target.

## Domain and layer footprint

- Source: the Klicker PRD PostgreSQL database, read only.
- Target: the Klicker STG PostgreSQL database, fully replaced.
- Infrastructure: `util/backup`, the `app-klicker` ArgoCD application, and STG
  Deployments selected by `app.kubernetes.io/instance=app-klicker`.
- Migrations: the existing
  `deploy/charts/klicker-uzh-v3/templates/job-migrate.yaml` ArgoCD `PreSync`
  hook. The script does not duplicate `prisma migrate deploy` logic.
- Documentation: `util/backup/README.md` for the operator procedure and
  `docs/data-and-migrations.md` for the durable deployment contract.

No application authorization surface is added. Execution authority comes from
Infisical read access to both environments, STG Kubernetes access, and
Kubernetes RBAC to read and patch the self-hosted ArgoCD `Application`.

## Safety contract

- `DRY_RUN` defaults to `true`. Mutations require `DRY_RUN=false`.
- Execution additionally requires the exact destructive confirmation and a
  separate acknowledgement that raw PRD data is allowed in STG.
- PRD and STG connection hosts are fail-closed against their expected Azure
  Flexible Server hostnames and must differ.
- The dump is streamed directly into a GPG-encrypted custom archive; no
  plaintext dump is written to disk or passed as a process argument.
- The encrypted archive is listed with `pg_restore` before STG is touched.
- ArgoCD automated sync/self-heal is disabled before scaling workloads down.
- Application-owned objects in the target `public` schema are removed only
  after all STG workloads report zero replicas; the Azure-owned `public` schema
  and its grants are preserved.
- `pg_restore` uses `--exit-on-error` and `--single-transaction`; restore errors
  cannot be converted into success.
- A hook-based `Application.operation.sync` submitted through Kubernetes runs
  the existing `PreSync` hook. A failed hook prevents the Sync phase, leaving
  workloads stopped.
- Automated sync policy is restored only after post-sync database verification,
  migrator-target identity verification, and ordered migration-history checks.
- Receipts contain aggregate metadata and archive hashes only, never row data or
  connection strings. Reusing a run ID is refused.

## Async and external-state impact

All STG workloads in the release, including Hatchet workers and response APIs,
are stopped during replacement. PRD remains online and is only read by
`pg_dump`. The resulting STG database contains raw production data, so this
workflow is permitted only when STG is approved for that data classification.

## Verification

- Shell syntax (`bash -n`) and ShellCheck when available.
- A self-contained fake-tool test proves dry-run immutability, host/database and
  cluster-identity guards, Lease ownership, timeout termination, approval,
  guards, phase ordering, encrypted-archive verification, fail-closed restore,
  direct Kubernetes sync submission, exact-operation polling, policy
  restoration, and receipt generation.
- Helm render verifies the hook remains enabled for STG and uses the expected
  migrator image/secret.
- The implementation agent does not execute the real PRD/STG refresh; operator
  runs are used separately to validate the guarded workflow and feed failures
  back into the fake-tool regression suite.

## Slices

1. Add the plan and safety contract.
2. Implement `util/backup/refresh-stg-from-prd.sh`.
3. Add the fake-tool shell test.
4. Document prerequisites, execution, failure behavior, and limitations.
5. Run focused formatting/static tests and inspect the final diff.
6. Replace the ArgoCD API-server CLI dependency with direct Kubernetes
   `Application` operations for the self-hosted installation.
7. Route all credential reads through the production self-hosted Infisical
   endpoint and script-specific project, and cover that boundary with a
   regression test.
8. Decompose database URLs into libpq connection variables so PostgreSQL tools
   connect remotely without exposing credentials in process arguments.

## Progress

- [x] Repository, deployment hook, and legacy backup scripts inspected.
- [x] Safety and operational design fixed.
- [x] Script implemented.
- [x] Tests implemented and passing.
- [x] Documentation updated and verified.
- [x] Direct Kubernetes sync implemented and verified.
- [x] Self-hosted Infisical credential loading for project
      `d071be96-5136-4f23-a6cb-e0c7f9b9a6c8` implemented and verified.
- [x] Secure libpq connection handoff and immediate connection-error propagation
      implemented and verified.
