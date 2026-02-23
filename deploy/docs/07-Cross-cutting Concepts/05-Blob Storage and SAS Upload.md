# Blob Storage and SAS Upload

Cross-cutting media upload pattern where the backend issues time-limited SAS tokens and the frontend uploads directly to Azure Blob Storage.

## Concept

- Uploads are performed client-side to avoid proxying large files through `[[Backend GraphQL]]`.
- The backend controls permissions and lifetime by generating SAS query parameters for a single blob.
- Uploaded media metadata is persisted to PostgreSQL (`MediaFile`) so it can be listed/selected in UIs.

## How it works

- Backend issues SAS for a single upload:
  - GraphQL mutation `getFileUploadSas(fileName, contentType)` creates a blob name and returns `{ uploadSasURL, uploadHref, containerName, fileName }`.
  - Resolver is protected by `t.withAuth(asUserFullAccess)` (requires an authenticated user context).
  - Code (resolver): `/Volumes/HOME/Git/klicker/klicker-uzh/packages/graphql/src/schema/mutation.ts`
  - Code (SAS generation): `/Volumes/HOME/Git/klicker/klicker-uzh/packages/graphql/src/services/elements.ts`
- SAS parameters and storage layout:
  - Uses `StorageSharedKeyCredential(BLOB_STORAGE_ACCOUNT_NAME, BLOB_STORAGE_ACCESS_KEY)`.
  - Uses per-owner container naming: `containerName = ctx.user.sub` and creates it if missing (`access: 'blob'`).
  - File naming: `blobName = {uuid}.{extension}` where extension is derived from a server-side `contentType → extension` mapping.
  - Returned `uploadHref` is a deterministic blob URL `https://{account}.blob.core.windows.net/{container}/{blobName}`.
  - Returned `uploadSasURL` is the storage account URL with SAS query parameters attached (used as `BlobServiceClient` base URL).
  - SAS permissions: write (`BlobSASPermissions.parse('w')`) and expiry `startDate + 15 minutes`.
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/packages/graphql/src/services/elements.ts`
- Frontend uploads directly using the SAS URL:
  - Uses `BlobServiceClient(uploadSasURL)` → `getContainerClient(containerName)` → `getBlockBlobClient()` → `uploadData(file)`.
  - Upload uses a 4MB block size in the manage UI.
  - Refreshes media listing via GraphQL query refetch and uses `uploadHref` as the durable URL.
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/frontend-manage/src/components/common/MediaLibrary.tsx`
- Media metadata persistence:
  - Backend persists a `mediaFile` row `{ id, ownerId, type, name, href }` before returning the SAS payload.
  - This enables listing via GraphQL (`GetUserMediaFiles`) and reusing existing uploads.
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/packages/graphql/src/services/elements.ts`

## Affected workloads

- [[Backend GraphQL]] (SAS issuance + DB persistence)
- [[Frontend Manage]] (media library upload UI)
- [[Azure Blob Storage]] (data store)

## Configuration

- `BLOB_STORAGE_ACCOUNT_NAME` — blob
- `BLOB_STORAGE_ACCESS_KEY` — blob

## Related docs

- [[Azure Blob Storage]]
- [[Frontend Manage]]
