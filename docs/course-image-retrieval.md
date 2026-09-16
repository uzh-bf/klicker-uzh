# Course image retrieval (draft integration)

Chat can show original processor-exported PNG figures selected from the current request's scoped document-search results. The tool does not inspect image pixels. Search policy is unchanged; figures are optional and text-only answers remain valid.

The doc-processing projection publishes content-addressed manifests, payloads and PNGs. Its per-page printed labels are optional: an unlabelled cover is never assigned a document-wide offset. Ingestion retains exact chunk page ranges and visual metadata; mcp-doc-query attaches resource identity. Chat validates the manifest, source, recipe, image occurrence, page labels and bytes before serving through an authenticated private route.

Configure `COURSE_IMAGE_PROJECTION_STORAGE_CONNECTION_STRING` and `COURSE_IMAGE_PROJECTION_STORAGE_CONTAINER` for the processor Blob store. `DOC_PROCESSING_AZURE_STORAGE_CONNECTION_STRING` and `DOC_PROCESSING_AZURE_STORAGE_CONTAINER` are fallbacks. `CHAT_COURSE_IMAGE_STORE_PATH` selects a mounted local store for development. No configuration means the tool is disabled.

The image GET requires the participant's stored assistant message, current chatbot KB scope, and a READY, non-deleted resource whose requested and active versions equal the selected version. Updating or withdrawing a resource therefore fails closed. Physical pages remain asset locators; captions prefer a verified logical number and fall back to the physical page.

Deploy processor, ingestion, query and Chat changes together. Publish the updated processor client before updating ingestion's SDK pin; no local editable SDK paths belong in deployment. Re-ingest existing documents to obtain bound figures and corrected labels. The raw uploaded-PDF job-output path carries references independently of the SDK.

Focused synthetic unit tests cover descriptor, integrity and access checks. Full fresh-environment build/typecheck, Blob-backed lecturer upload-to-chat browser verification and withdrawal/replacement integration tests remain release gates. The private PDF demo and its old ten-trial results are not proof of this integration.
