# Course image retrieval (draft integration)

Chat can show original processor-exported PNG figures selected from the current request's scoped document-search results. The tool does not inspect image pixels. When image tools are available, the prompt asks for course evidence and permits useful figures proactively; figures remain optional and text-only requests must be respected.

The doc-processing projection publishes content-addressed manifests, payloads and PNGs. Its per-page printed labels are optional: an unlabelled cover is never assigned a document-wide offset. Ingestion retains exact chunk page ranges and visual metadata; mcp-doc-query attaches resource identity. Chat validates the manifest, source, recipe, image occurrence, page labels and bytes before serving through an authenticated private route.

Configure `COURSE_IMAGE_PROJECTION_STORAGE_CONNECTION_STRING` and `COURSE_IMAGE_PROJECTION_STORAGE_CONTAINER` for the processor Blob store. `DOC_PROCESSING_AZURE_STORAGE_CONNECTION_STRING` and `DOC_PROCESSING_AZURE_STORAGE_CONTAINER` are fallbacks. `CHAT_COURSE_IMAGE_STORE_PATH` selects a mounted local store for development. No configuration means the tool is disabled.

The image GET requires the participant's stored assistant message, current chatbot KB scope, and a READY, non-deleted resource whose requested and active versions equal the selected version. Updating or withdrawing a resource therefore fails closed. Physical pages remain asset locators; captions prefer a verified logical number and fall back to the physical page.

Deploy processor, ingestion, query and Chat changes together. Publish the updated processor client before updating ingestion's SDK pin; no local editable SDK paths belong in deployment. Re-ingest existing documents to obtain bound figures and corrected labels. The raw uploaded-PDF job-output path carries references independently of the SDK.

Focused synthetic unit tests cover descriptor, integrity and access checks. Full fresh-environment build/typecheck, Blob-backed lecturer upload-to-chat browser verification and withdrawal/replacement integration tests remain release gates. The private PDF demo and its old ten-trial results are not proof of this integration.

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

The reviews remain draft until the processor client dependency is published and
aligned across ingestion. Local demo evidence includes inline placement,
original and recovered captions, generated-description selection, mobile
display, and reload. It does not replace a Blob-backed lecturer upload through
the full production lifecycle. No private PDF corpus or local runtime
credentials belong in these PRs.
