# v3 external-secret contract

The v3 chart consumes pre-created Kubernetes Secrets and never renders secret
values. Import/export requires these additional keys:

| Secret resource suffix | Required import/export keys | Consumers |
| --- | --- | --- |
| `-secret-backend-graphql` | `IMPORT_EXPORT_TOKEN_SECRET`, `BLOB_STORAGE_ACCOUNT_NAME`, `BLOB_STORAGE_ACCESS_KEY` | normal GraphQL backend |
| `-secret-hatchet-worker-general` | `BLOB_STORAGE_ACCOUNT_NAME`, `BLOB_STORAGE_ACCESS_KEY` | package and imported-media cleanup worker |

The assessment backend must not receive `IMPORT_EXPORT_TOKEN_SECRET`; its
ConfigMap renders `IMPORT_EXPORT_ENABLED=false` and `ASSESSMENT_MODE=true`.
The token secret must contain at least 32 UTF-8 bytes. Both consuming
deployments carry the Stakater reloader annotation, so an external-secret
resource-version change causes a rollout. Backend startup and the production
preflight validate the normal backend's configured key values without printing
secret data. Kubernetes Secret presence and the actual backend/worker rollout
must be verified separately in the protected deployment process.
