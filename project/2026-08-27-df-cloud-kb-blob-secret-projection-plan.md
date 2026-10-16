# Staging Fix Plan: Project the Blob Access Key to the Klicker General Worker

- Date: 2026-08-27
- Status: Draft for review. No implementation, merge, apply, or canary is authorized by this document.
- Target repository: `/Users/rschlae/Git/df/df-cloud` (MRs target `stg`; production follows the normal `stg` -> `prd` promotion later)
- Known drift: the local `stg` branch is 90 commits behind `origin/stg` and the primary checkout is dirty (`azure-helpers` submodule, `pnpm-lock.yaml`). Work starts from a fresh fetch and a new worktree; the dirty primary checkout is left untouched.

## Goal

The staging Hatchet general worker can prepare uploaded BLOB knowledge-base
resources, so PDF ingestion completes instead of failing before the request
leaves the worker.

## Evidence (current staging state, values-free)

- KB resource `521774bc-11b0-48a9-ad59-f7285f4f89f8` (type `BLOB`,
  `application/pdf`, 9,595 bytes) failed with
  `INGESTION_DISPATCH_FAILED — The ingestion operation could not be started.`.
- The staging ingestion API is healthy, and no `POST /v1/resources` from the
  new worker reached it; the failure is client-side in the worker.
- `prepareKBIngestionSource` for BLOB resources requires
  `BLOB_STORAGE_ACCESS_KEY` (`packages/hatchet/src/kbIngestionApi.ts`,
  `prepareBlobSource`, at `v3-ai`).
- The live general worker environment has `BLOB_STORAGE_ACCOUNT_NAME` only;
  no access key and no account-URL override.
- The backend-graphql secret already carries `BLOB_STORAGE_ACCESS_KEY`;
  the general-worker secret does not (key-name comparison verified).
- Chart `cm-hatchet-workers.yaml` renders only the account name, and
  df-cloud's `hatchetWorkerGeneralSecretNames` staging block projects
  `KB_INGESTION_API_KEY` and `KB_GRAPH_HATCHET_CLIENT_TOKEN` but not the
  blob access key.

## Non-goals

- No production (`prd`) change in this MR; PRD promotion is a later,
  separately authorized step.
- No workload-identity migration; account-key projection mirrors how the
  backend already consumes this storage account. Workload identity is recorded
  as a follow-up option only.
- No chart change; the chart already consumes whatever the projected secret
  provides via `envFrom`.

## Design

Add `convertExternalSecret('BLOB_STORAGE_ACCESS_KEY')` to the staging block
of `hatchetWorkerGeneralSecretNames` in `src/apps/klicker/functions.ts`.
The platform Infisical project already syncs this secret name for the backend,
so no new platform secret is created.

During implementation, verify whether the backend environment also receives
`BLOB_STORAGE_INTERNAL_ACCOUNT_URL`; if it ever does, mirror the same
override for the worker so both components reach the account the same way.
Today neither component sets it and the SDK falls back to the public account
URL, which matches current backend behavior.

## Work items

1. `git fetch --prune`, then a fresh worktree from `origin/stg`
   (`trees/kb-blob-secret-projection`, branch
   `rs/kb-blob-secret-projection`); init the `azure-helpers` submodule and
   follow the repo's pinned install/build steps before running tests.
2. Make the one-line projection change plus a list-content test extending the
   existing `kb-generation-secrets.test.ts` pattern (assert the staging
   general-worker secret list contains the key).
3. Run the repo-native checks for `src/apps/klicker` and any configured
   format/lint gates.
4. Commit: `feat(klicker): project blob access key to the KB ingestion worker`.
5. MR to `stg` with the evidence above; draft until checks pass.

## Deployment and verification (separately authorized, in order)

1. Merge only after required CI passes on the exact head.
2. Pulumi preview scoped to the Klicker stack only; explicitly verify the
   preview lists no unrelated resources (a known unrelated drift trap exists
   in this stack). Apply is a separate approval.
3. Argo sync follows; verify values-free: ExternalSecret Ready, the synced
   K8s secret contains the key name (no value read), and the general-worker
   pod rolls (the deployment is reloader-annotated).
4. Post-deploy canary: upload a fresh PDF to KB
   `6d83ffb8-0b5a-411b-9799-6e319b731891` from the manage UI.
5. Success: a `POST /v1/resources` with status `202` appears in the
   ingestion-resource-api logs, the `KBResource` row reaches `READY`, and a
   graph build over the PDF resource passes `prepare-course-inputs`.

## Rollback

Revert the projection MR and resync; removing the key triggers a reloader
rollout and ingestion of BLOB resources stops again. No data migration, no
cleanup of platform secrets.

## Dependencies and sequencing

- Independent of the Doc Processing URL-content-type fix plan; both are
  needed for the full demo path (URL graph builds need the Doc Processing
  fix; PDF ingestion needs this fix; PDF graph builds need both).

## Approval asks

1. Authorize implementation and the MR in `df/df-cloud`.
2. Separately authorize merge, then the scoped Pulumi apply.
3. Separately authorize the Argo sync verification and the live PDF canary.
