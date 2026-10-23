# Minimal course-image integration

Goal: carry manifest-bound original figures and per-page printed labels from processing through resource ingestion, retrieval and Chat.

No new ranking, forced image decision or default-search policy. No schema migration, gamification, new seeds, private corpus, or demo runtime changes.

Entities: Chatbot, KnowledgeBase, KBResource, participant-owned ChatThread/ChatMessage. Existing chatbot authorization and KB scope apply; image access additionally requires the active, non-deleted serving resource version. Participation.isActive is not used.

Python MRs: processor images on existing page-label MR !87; ingestion snapshot and chunk transport; query descriptor projection. Existing async ingestion ownership and fallback rules remain.

Chat stack on v3-ai:
1. contracts: validated descriptors, request-local selection tool, verified Blob/filesystem reader, authenticated image route, focused tests.
2. display: wire the tool into the existing Chat route and render selected images with printed-page fallback; bilingual labels and tests.

Verification: processor publication/API/SDK round trip and numbering; ingestion snapshot/chunk tests; query descriptor tests; Chat unit/type checks and browser rendering where environment permits. Draft descriptions must state remaining deployment and end-to-end gaps.
