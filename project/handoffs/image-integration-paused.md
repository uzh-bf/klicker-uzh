# Image integration paused checkpoint — 2026-09-21

This branch preserves the runnable local experiment. Review and integrate the production branches instead of merging this demo branch wholesale.

- Processor captions and conservative caption recovery: https://gitlab.uzh.ch/ai-infrastructure/services/doc-processing/-/merge_requests/88
- Ingestion caption/page metadata: https://gitlab.uzh.ch/ai-infrastructure/services/data-ingestion/-/merge_requests/181
- Retrieval visual descriptors: https://gitlab.uzh.ch/ai-infrastructure/mcp/mcp-doc-query/-/merge_requests/90
- Chat contracts and authorization: https://github.com/uzh-bf/klicker-uzh/pull/6094
- Chat display: https://github.com/uzh-bf/klicker-uzh/pull/6095
- Chat inline placement and captions: https://github.com/uzh-bf/klicker-uzh/pull/6221

Latest demo behavior: search course materials for course questions, select or skip relevant figures, place selected figures beside explanatory text, show original captions and verified printed-page labels, retain images after reload. The local corpus has 40 captioned figures out of 49; nine captions were recovered from unlinked numbered headings. Ambiguous captions stay empty. No pixel understanding or production readiness is claimed.

Previous demo suite: 659 passed, 21 skipped. Live local original/recovered captions, mobile layout and reload were verified. Production-port checks: 64 processor, 3 ingestion, 6 retrieval and 52 focused Chat tests passed. Full production Chat build/typecheck needs a fresh matching v3-ai environment; the retained demo environment lacks matching generated exports. Historical ten-trial results were not rerun for this checkpoint.

Resume with a dependency-aligned environment, published/pinned processor SDK, and a fresh Blob-backed lecturer-upload-to-chat lifecycle test including replacement, withdrawal and cross-KB denial. Keep drafts unmerged until these gates pass. PDFs, generated native/processor outputs, embeddings, credentials and local runtime configuration are deliberately not archived in Git. Existing local collections and services were retained.
