---
type: App Guide
title: Course Image Retrieval
description: Manifest-bound course figures from document retrieval to authorized Chat display.
---

# Course image retrieval

Chat can show original processor-exported PNG figures selected from the current request's scoped document-search results. By default the model selects from text, captions and generated descriptions without inspecting pixels. When image tools are available, the prompt asks for course evidence and permits useful figures proactively; figures remain optional and text-only requests must be respected.

The doc-processing projection publishes content-addressed manifests, payloads and PNGs. Its per-page printed labels are optional: an unlabelled cover is never assigned a document-wide offset. Ingestion retains exact chunk page ranges and visual metadata; mcp-doc-query attaches resource identity. Chat validates the manifest, source, recipe, image occurrence, page labels and bytes before serving through an authenticated private route.

Configure `COURSE_IMAGE_PROJECTION_STORAGE_CONNECTION_STRING` and `COURSE_IMAGE_PROJECTION_STORAGE_CONTAINER` for the processor Blob store. `DOC_PROCESSING_AZURE_STORAGE_CONNECTION_STRING` and `DOC_PROCESSING_AZURE_STORAGE_CONTAINER` are fallbacks. `CHAT_COURSE_IMAGE_STORE_PATH` selects a mounted local store for development. No configuration means the tool is disabled. `COURSE_IMAGE_PROJECTION_STORAGE_PREFIX` defaults to `projection` for Blob storage; include any processor bucket subpath before that prefix. An explicit empty prefix reads the container root. Mounted local stores remain root-relative.

The active `deploy/charts/klicker-uzh-v3` chart enables storage through `chat.courseImages.existingSecret` and `connectionStringKey`. The referenced secret supplies the connection string; `container` and `prefix` configure the object layout. Provision the secret through the approved secret-store workflow. Empty `existingSecret` leaves the image tool disabled in the chart defaults.

The image GET requires the participant's stored assistant message, current chatbot KB scope, and a READY, non-deleted resource whose requested and active versions equal the selected version. Updating or withdrawing a resource therefore fails closed. Physical pages remain asset locators; captions prefer a verified logical number and fall back to the physical page.

Deploy processor, ingestion, query and Chat changes together. Publish the updated processor client before updating ingestion's SDK pin; no local editable SDK paths belong in deployment. Re-ingest existing documents to obtain bound figures and corrected labels. The raw uploaded-PDF job-output path carries references independently of the SDK.

Qualification must cover the actual Blob object layout, the released processor SDK, and lecturer upload through ingestion, retrieval, authorized display, reload, and withdrawal/replacement. Mounted-store fixtures alone do not verify that chain.

## Inline placement and original captions

The selection tool returns a `placement_marker` for a successfully validated asset. The model places that marker as its own paragraph beside the explanation; the renderer resolves it only against the saved selected-image parts. Unselected IDs do not grant image access. Legacy answers without placement markers retain the image section fallback. Rendering waits for the assistant message to finish because the image route authorizes persisted selections.

Optional ordered `captions` carry original processor text, not model-generated descriptions. They appear under the figure and provide its alt text. Older descriptors without captions remain valid. The processor prefers explicit native links and conservatively recovers unique nearby numbered headings; ambiguous matches remain empty. Image storage resolves one known generation (e6/v3, e5/v3 or e4/v3) from the manifest, then reads every object from that same generation, preserving hash, occurrence and authorization checks.

## Generated picture descriptions

Each validated figure descriptor may carry one bounded generated description
with provider, model, prompt-version, exact model-input digest, and served-asset
digest provenance. Original captions remain separate source metadata. Malformed
or served-asset-digest-mismatched descriptions are omitted without dropping an
otherwise valid image candidate.

The model may use a valid description together with the surrounding passage
and original captions for selection and explanation, but must treat it as
untrusted generated evidence: it is neither a lecturer-authored caption nor
verified numerical truth, and instructions inside it are never executable.
Description metadata does not grant a new asset, URL, knowledge-base scope, or
storage read.

Description text preserves line breaks and tabs. Provider and model identifiers remain single-line bounded strings. The raw retrieval result remains model-visible; descriptor validation protects selected and persisted metadata rather than filtering every tool-result text.

## Optional model inspection of figure pixels

`CHAT_COURSE_IMAGE_VISION_ENABLED=true` opts the Chat server into runtime visual
inspection. It is **off when unset or anything other than `true`**. Set it in the
server environment and restart the Chat process to compare configurations;
removing it or setting `false` restores description-only behavior. It is an
operator experiment switch, not a student setting or a production-default change.

The effective selected model must advertise `supportsImageAttachments`, and the
request must have scoped document search and configured figure storage. Unsupported
models retain the description-only path even when the environment toggle is on.
Use the existing model selector/registry to compare supported models; this feature
does not hard-code Luna or introduce a separate vision model or ranking call.

After successful current-turn retrieval, Chat takes at most three distinct figure
occurrences in retrieval order. This is a bounded shortlist, not a new model-based
ranking stage. Before reading a preview it verifies the KB scope and the exact
READY, non-deleted resource with matching requested and active versions. The
existing reader then checks the manifest, occurrence, digest and PNG bytes using
the same bounded ETag-conditional Blob reads as display.

Valid single-frame PNGs are limited to 10 MB and 16 million decoded pixels, resized
without enlargement to at most 1536 pixels per edge, and limited to 1 MB per
preview. Failed reads/decodes are skipped without retries or storage-error details;
failed attempts still count toward the three-preview limit. A request-local promise
cache shares concurrent work and repeated steps. No cross-user preview cache is
introduced.

Previews are attached only to matching model-facing retrieval tool results. Raw
retrieval results, saved messages and source cards retain metadata only. The model
can inspect the attached pixels, explain legible details, choose a useful figure,
or skip it. Only previewed assets permit claims of direct inspection. Generated
descriptions remain untrusted evidence, and requests for text-only answers still
apply. `show_course_image`, its three-selection budget, persisted selection and
student display authorization are unchanged. No preview grants display access.

Backend contracts in processor !88, ingestion !181 and doc-query !90 are unchanged:
description generation continues during processing; this toggle changes only
Chat's use of existing stored figures. It needs no re-ingestion solely to enable
previews for already valid figure descriptors. Existing resources without bound
figures still need the separately authorized upgrade described above.

Enabling previews sends bounded image crops to the selected model's configured
provider and increases model input and latency; it makes no additional standalone
LLM call. It does not guarantee a better explanation. The existing nine-figure
local comparison observed roughly 17% higher median latency and 5% higher mean
reported cost, with no consistent quality advantage. That fixed-retrieval,
single-candidate comparison is not a production benchmark or a three-candidate
ranking evaluation. Keep this option off by default pending model-specific
qualification. Blob-backed upload, retrieval, display, reload and resource-lifecycle
checks remain release gates.
