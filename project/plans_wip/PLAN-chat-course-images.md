# Explicit course-image display

Goal: a participant explicitly asks to show a diagram; course search yields visual_assets;
a server tool selects one validated candidate; Chat displays its original PNG and page,
including after reload. Implement in apps/chat, using a separate local Klicker instance.

Scope: shared visual reference validation, request-local candidate registry/tool,
message-owned authenticated image route, image card, EN/DE strings, synthetic MCP fixture.
No Prisma/GraphQL changes, points, XP, leaderboard or async worker changes.

Authorization: existing participant JWT + published chatbot + course Participation;
owned assistant message/thread and current enabled KB scope checked at every image load.
Never use Participation.isActive. Only references from completed successful doc_query
calls in this request can be selected. Resolve content-addressed files from a configured
server-owned projection root; verify manifest, payload identity, occurrence and image hash.
No arbitrary URL/path fetches, public PNG paths or model-authored image URLs.

First adapter: mounted processor filesystem projections (same format as backend proof),
opt-in via CHAT_COURSE_IMAGE_STORE_PATH; no deployed cloud-storage endpoint is assumed.
Resource-level withdrawal upstream and uploaded-PDF route integration remain later work;
this local slice proves synthetic images and current chatbot KB access, not upstream ACLs.

Selection: prompt instructs show_course_image only on explicit image requests. This slice
shows the original image; it does not send pixels to the model or add automatic selection.
Persist the selected descriptor as a normal tool result, not image bytes. At most 3 images.

Verification: pure validation/tool/storage and route authorization tests, chat tests and
TypeScript; browser screenshots of existing Chat and selected image, failure/reload states.
A deterministic local test interface may invoke the same tool path without an external LLM;
label that distinction. Real model choice remains separately verified only if available.

## Completed slices

1. Processor and SDK: versioned visual_assets, stable occurrence IDs, image hashes,
   physical page numbers, manifest binding, and cache/projection invalidation.
2. Ingestion: preserve typed references and associate figures with exact chunk
   page ranges; retain legacy starting-page fields.
3. Doc query: return allow-listed references with KB/resource/version identity.
4. Chat: validate retrieved candidates, select through show_course_image, serve
   original PNGs through an authenticated message-owned route, and persist cards.
5. Local demo: synthetic fixture and optional private component corpus, with
   scripted or configured real-provider modes. Real-model private corpus use
   requires a separate runtime opt-in and provider-specific authorization.

## Verification

- Latest chat suite: 614 passed, 21 existing integration skips.
- Latest focused processor/projection: 27 passed; ingestion/provenance: 27 passed;
  query visual references: 6 passed. Earlier broader backend checks are recorded
  in the companion repositories' visual-image-reference-path documentation.
- Browser: Azure GPT-4.1 called retrieval and image selection for both a synthetic
  diagram and an authorized larger PDF. Both original PNGs loaded in one thread.
  Reload retained the selected image. A stale local image route initially returned
  404 and recovered after recompilation; its precise cause was not established.
- Earlier authorization checks: unauthenticated requests return 401; unowned
  threads return 404. Images use private/no-store responses and verified hashes.
- Responsive image rendering and manual image retry were verified in the browser.

## Remaining work

Production upload/orchestration, companion SDK release and pinned dependency
update, cloud image storage, backfill, and deployed vector-store round trips
remain separate work. Current local retrieval uses BM25/page filtering and a
synthetic fixture dispatcher. Automatic helpful-image selection and model pixel
inspection are not implemented; the current prompt requires an explicit request.
Private PDFs, processed corpora, credentials, and runtime markers stay outside
committed fixtures. This branch is a local implementation, not a deployment.

## Companion implementation commits

| Repository | Commit | Slice |
| --- | --- | --- |
| doc-processing | 376cbfa | Manifest-bound visual_assets in processor/API/SDK |
| data-ingestion | 28b265c | Chunk page ranges and image-reference propagation |
| mcp-doc-query | 418a845 | Resource-bound image references in documents output |

These repositories use `codex/chatbot-image-references`; the Klicker feature uses
`codex/chat-course-images`. Local commits do not release the companion SDK or
update ingestion's installed dependency.
