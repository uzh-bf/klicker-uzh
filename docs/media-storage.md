---
concept: media-storage
---

# Public media storage

The core lecturer media library supports Azure Blob Storage (the default) and
S3-compatible storage. This is a **public media** capability: images are embedded
in question content and remain readable at stable URLs. It does not make private
knowledge-base storage provider-independent.

## Boundaries

| Consumer                                              | Storage in this change | Access and persistence                                                                             |
| ----------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------- |
| Manage media library                                  | Azure or S3-compatible | Short-lived, object-scoped browser PUT; permanent public `MediaFile.href`                          |
| Question content, instances and imported/copied media | Existing URLs          | Reads remain at the URL recorded in the content; no rewriting                                      |
| KB uploads and replacements                           | Azure                  | Private `kb-<ownerId>` containers; upload tickets, quota checks, observed size/type validation     |
| KB source gateway and ingestion                       | Azure                  | Authorized stream reads, size/type checks, content digests                                         |
| KB graph input                                        | Azure                  | Private read SAS for the external worker                                                           |
| KB/generation artifacts and cleanup                   | Azure                  | Separate artifact containers/prefixes and optional `KB_GENERATION_AZURE_STORAGE_CONNECTION_STRING` |

Selecting S3 changes **new core media uploads only**. It does not redirect or
break the Azure configuration used by optional KB/Catalyst features. An OSS
installation using those optional features still needs their Azure-compatible
storage and external services. Full private-source/artifact portability would
need a separate contract covering streams, metadata, private read signing,
delete/list semantics, persisted provider identity, and the external workers.

## Application contract and compatibility

`packages/graphql/src/services/mediaStorage/` owns a small `MediaStorage`
capability: create a short-lived signed PUT descriptor and a durable public URL.
The service owns authorization, owner UUID, random object name and database row;
the adapter owns provider-specific signing and URLs. The Manage browser uses
`fetch` with the exact returned headers, omits cookies and rejects redirects.
Neither cloud SDK nor long-lived credentials are required by that upload UI.
The optional KB UI still uses its own Azure SDK.

The new `requestMediaUpload` mutation retains the existing full-access User
authorization gate. It validates supported image MIME types and never uses the
user's filename as an object key. The old `getFileUploadSas` mutation remains an
Azure-only compatibility API for existing clients, including its account-root
URL carrying a blob-scoped SAS. Deploy the backend before the updated Manage
frontend.
An old frontend cannot use the new S3 path; retain Azure configuration during a
rolling migration if older clients may still upload.

As before, the media row is created when an upload is reserved. A failed browser
upload can leave a row without an object. This change displays a retryable error
and clears the busy state, but does not introduce a new finalize/garbage-collection
lifecycle. Media has no object-delete API in this slice.

## Azure configuration (unchanged default)

Leave `MEDIA_STORAGE_PROVIDER` unset or set it to `azure`. Continue supplying:

- `BLOB_STORAGE_ACCOUNT_NAME`
- `BLOB_STORAGE_ACCESS_KEY` through the backend's secret store
- Optional `BLOB_STORAGE_ACCOUNT_URL` for the browser-facing account URL
- Optional `BLOB_STORAGE_INTERNAL_ACCOUNT_URL` for backend container creation

The adapter awaits creation of the per-owner container with public blob access
before issuing a 15-minute write SAS. Existing containers and href structure are
preserved. Configure Blob CORS to allow the Manage origin, `PUT`, `Content-Type`
and `x-ms-blob-type` (include the existing SDK headers too while legacy clients
remain). The production Azure deployment values are not changed by this PR.

## S3-compatible configuration

Provision a **dedicated public-media bucket**, or a private bucket with a public
read-only CDN in front of it. Keep private KB data in separate storage. Use a
separate media origin that does not receive application authentication cookies,
especially because existing supported MIME types include SVG.

Backend runtime environment:

```dotenv
MEDIA_STORAGE_PROVIDER=s3
MEDIA_S3_BUCKET=klicker-media
MEDIA_S3_REGION=us-east-1
MEDIA_STORAGE_PUBLIC_URL=https://media.example.org
# For MinIO or another compatible service:
# MEDIA_S3_ENDPOINT=https://objects.example.org
# MEDIA_S3_FORCE_PATH_STYLE=true
```

- `MEDIA_S3_BUCKET` and `MEDIA_S3_REGION` are required. Use the provider's signing
  region (for example, R2 uses `auto`).
- `MEDIA_S3_ENDPOINT` is optional for AWS S3. A custom endpoint must be directly
  reachable by the **browser**. Do not use a container-only hostname or rewrite
  the host/path after signing. The signature covers the endpoint.
- `MEDIA_S3_FORCE_PATH_STYLE` accepts exactly `true` or `false` and defaults to
  `false`. Set `true` for a path-style service such as a typical local MinIO.
- `MEDIA_STORAGE_PUBLIC_URL` is required and is the stable read base, independent
  of the signed upload endpoint. It must serve the selected bucket root, directly
  or through a matching CDN origin-path/rewrite configuration. Include the bucket path if needed, e.g.
  `https://objects.example.org/klicker-media`, or use a dedicated CDN hostname.
  For R2 public reads, use a public custom domain configured with the provider;
  the S3 API endpoint is not the public read URL.
- URLs require HTTPS; loopback and `.localhost` HTTP endpoints are supported for
  isolated local development. Credentials, query strings and fragments are not
  valid configuration URL components.
- S3 credentials use the official AWS SDK's default credential provider chain.
  Prefer a restricted workload role. For a compatible service, inject
  `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and, when applicable,
  `AWS_SESSION_TOKEN` into the backend only. Never put them in `NEXT_PUBLIC_*`,
  frontend build inputs, Helm values committed to Git, logs or example files.
  Turbo passes `AWS_*` only to backend runtime/dev tasks; frontend and build
  tasks do not receive this additional credential passthrough.

The object key is `<owner UUID>/<random UUID>.<extension>`. Signing is local:
there is no bucket creation, ACL change or provisioning request. The application
role needs `s3:PutObject` only on the media bucket's object namespace. Public reads
belong in a bucket/CDN policy configured by the operator; bucket-level public
access blocking must be reconciled with that policy. Prefer a CDN with private
origin access where the provider supports it. Do not grant bucket administration,
object listing/deletion, or access to private application data to the upload role.

### CORS

Configure the bucket's CORS for the exact Manage origin. A minimal AWS-style
example is:

```json
[
  {
    "AllowedOrigins": ["https://manage.example.org"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

CORS is a browser policy, not authorization. Do not use wildcard origins as an
access-control substitute. Native image display does not need a browser GET CORS
rule; add `GET`/`HEAD` and exposed headers only if another authorized client needs
them. Provider CORS configuration formats differ. Verify the preflight and PUT
from the deployed Manage origin before enabling uploads.

### Upload limits and compatibility

Uploads use a single PUT with a 15-minute signed URL and exact content type.
S3 multipart upload/resume is not implemented. This is intended for image media,
not large course/video files. The backend does not impose a new byte limit or
claim a hard signed size quota in this change; provider policy limits still
apply. A presigned URL is a bearer credential and can be reused until it expires;
keep it out of logs. Temporary workload credentials can expire earlier than the
requested URL lifetime.

The SDK's optional checksum calculation is set to `WHEN_REQUIRED`: the backend
signs before it has the browser's bytes, so it must not sign an empty-body
checksum. Transport is HTTPS. This does not claim end-to-end content-digest
verification or the KB confirmation guarantees for media. Compatibility means
standard SigV4 `PutObject` signing, not certification of every provider feature.
Unit tests cover AWS endpoint signing and custom path-style signing. A real
AWS/MinIO/R2 bucket smoke test remains a deployment acceptance requirement.

## Frontend image allow-list and Helm

Supply `MEDIA_STORAGE_PROVIDER=s3` and `MEDIA_STORAGE_PUBLIC_URL` when **building every frontend image** that
renders uploaded media. The shared Next configuration adds only that URL's
protocol, hostname, port and path prefix to `images.remotePatterns`, while keeping
the existing Azure origins. It rejects a public-media URL containing a wildcard,
credentials, query or fragment. Local HTTP image optimization stays restricted
to development/test. A runtime ConfigMap cannot alter an already-built Next
image allow-list. A build explicitly configured for S3 fails if the public base
is missing. The public base is safe to expose; credentials are not.

The reusable chart accepts:

```yaml
mediaStorage:
  provider: s3
  publicUrl: https://media.example.org
  s3:
    bucket: klicker-media
    region: us-east-1
    endpoint: https://objects.example.org
    forcePathStyle: true
```

These settings configure the backend. Supply AWS credentials in the existing
`<release fullname>-secret-backend-graphql` Secret or through the deployment's
workload identity. Do not add them to frontend Secrets. Rebuild frontends with
the same public base URL; the chart does not rebuild images. Existing Azure-only
chart values keep the default provider without changes.

## Existing URLs and migrations

Changing providers is **not a data migration**. `MediaFile.href`, question
Markdown, published instances, exports and copied/imported media can all retain
absolute URLs. Keep the old Azure account/public origin online and readable for
as long as those references exist. The allow-list keeps the established Azure
hosts, and `BLOB_STORAGE_ACCOUNT_URL` can retain a deployment-specific old Azure
origin alongside `MEDIA_STORAGE_PUBLIC_URL`.

For a future move of existing objects:

1. Inventory database rows, rich-text content, snapshots and external exports,
   then back up the database and objects
2. Copy objects to the new store without changing keys, verify sizes/digests and
   public reads, and preserve the old URL through a compatible DNS/CDN/proxy
   where possible
3. If URLs must change, design an explicit reviewed migration for **all** stored
   references, with rollback and historical/export compatibility; changing only
   `MediaFile.href` is insufficient
4. Retire the old origin only after verifying no needed references depend on it

None of those copy/rewrite/retirement actions is automatic. Provider changes can
be rolled back for future uploads by restoring the Azure setting, while keeping
both origins available for media already written to either store.

## Why an application adapter instead of another storage framework?

Research checked on 2026-10-14:

- [Flydrive](https://flydrive.dev/docs/introduction) is a maintained file-oriented
  abstraction with direct upload signing, but its official drivers are S3, GCS
  and local filesystem. Azure would still require a custom adapter.
- [unstorage](https://unstorage.unjs.io/drivers) supports Azure and S3, but its
  primary contract is key/value storage, not the application's signed browser
  upload, public URL, private-stream and lifecycle boundaries.
- [TweedeGolf storage-abstraction](https://github.com/tweedegolf/storage-abstraction)
  supports both and signed uploads. Its [current package manifest](https://github.com/tweedegolf/storage-abstraction/blob/master/package.json)
  includes AWS, Azure, Google, MinIO and Backblaze SDK dependencies; signing
  options and supported URL behavior still differ by provider.

The small capability interface keeps SDK calls out of business logic without
adding a third-party abstraction's version/driver matrix. Azure retains the
repository's pinned SDK; S3 adds only the official AWS S3 client and request
presigner on the backend. Future private-storage support should add explicit
capabilities and persisted location identity, rather than reinterpret old URLs
or pretend every driver has identical access semantics.

Provider references: [AWS presigned uploads](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html),
[AWS checksum settings](https://docs.aws.amazon.com/sdkref/latest/guide/feature-dataintegrity.html),
[Azure browser uploads](https://learn.microsoft.com/en-us/azure/developer/javascript/tutorial/browser-file-upload-azure-storage-blob).
