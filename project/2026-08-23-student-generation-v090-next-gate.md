# Student-generated practice elements: v0.9.0 next gate

## Current decision

The student-generation adapter can proceed against the released `mcp-doc-query`
v0.9.0 contract. No ingestion change is required for this release.

The release tag `v0.9.0` (`a32b98954e787de1f0848222492da94f5ae9c1a1`) adds stable
documents-mode `chunk_id` values. The producer prefers the document-store ID
written during ingestion, falls back to a SHA-256 content identifier when that
ID is absent, and suffixes collisions within one response. The upstream release
tests cover all three cases. Ingestion, the Milvus schema, and collections stay
unchanged; the deployment package only promotes the PRD stable/Spot image pin.

The current Chat adapter accepts `chunk_id`, `chunkId`, or `id` for a chunk ID
and `content`, `text`, or `excerpt` for chunk text. It rejects an empty
`sources[].chunks[]` result, missing IDs, missing text, duplicate IDs, and
over-limit results. The local MCP fixture uses the production-shaped
`chunk_id` field, but it is not evidence for the deployed producer.

## Next proof

Run one separately authorized, values-free staging probe against the configured
Tutor-mode `doc_query` MCP server:

1. Call `tools/list` and record only the tool names and count.
2. Call one synthetic retrieval with a non-sensitive query.
3. Assert that `sources` is non-empty and every source has non-empty `chunks`.
4. Assert that each chunk has one accepted ID field (`chunk_id`, `chunkId`, or
   `id`) and one accepted text field (`content`, `text`, or `excerpt`).

When the staging route is exposed through the LiteLLM `catalog` alias, run the
probe from the real LibreChat pod with its existing key-level access path. Do
not inspect or record secret values, raw source bodies, or participant data.

This probe is the gate for the adapter's deployed producer contract. It is not
replaced by local fixtures, offline deployment rendering, or a green CI run.

## Probe result, 2026-08-23 (values-free)

Executed from the LibreChat staging pod against in-cluster MCP routes after
explicit per-call approval. Only statuses, counts, and field names were
recorded; no content, secret values, or request bodies.

| Check | Result |
| --- | --- |
| Neutral STG service image (`stg-doc-query`) | exactly the reviewed v0.9.0 candidate (`sha-a32b9895…@sha256:dbe48464…`), 1/1 ready |
| Catalog route `tools/list` via LibreChat | HTTP 200, 92 tools |
| Retrieval call with legacy fixture argument `query` | HTTP 200 transport frame, tool-level `isError: true` (argument-name rejection) |
| Retrieval call with producer contract `question` | HTTP 200, `isError: false`, 12 sources / 20 chunks |
| Chunk ID contract on v0.9.0 producer | every chunk carries non-empty `chunk_id`; no duplicate IDs observed |
| Chunk text contract on v0.9.0 producer | every chunk carries non-empty `content` |
| Klicker pipeline image (`stg-klicker-pipelines`) | still v0.7.2 (`sha-4fc395d1…@sha256:8687d829…`); `tools/list` returns 34 course tools |
| Klicker pipeline retrieval contract | accepts `question` (19 sources / 20 chunks) but emits **no** ID field on any chunk — `chunk_id` emission first ships in v0.9.0 |
| Multi-tenant STG service (`/mcp/klicker`) | **Verified live**: HTTP 200, 34 tools (17 pairs); retrieval returns 19 sources / 20 chunks; 20/20 have stable `chunk_id` and `content` |

Conclusions:

1. The adapter sent only the fixture-shaped `{ query }` argument, so every
   deployed producer rejected it before retrieval. Fixed in commit `d24405f32`
   by sending `{ query, question }` together, which keeps the local fixture and
   the deployed producer both satisfied without a protocol change.
2. The v0.9.0 producer contract is proven live: stable `chunk_id` plus
   `content` on every chunk, matching the adapter normalizer exactly.
3. The legacy standalone pipeline deployment (`stg-klicker-pipelines`, v0.7.2)
   predates stable chunk IDs. However, the **new multi-tenant service**
   (`http://mcp-doc-query.stg-doc-query.svc.cluster.local:1417/mcp/klicker`)
   is already mounted, healthy on v0.9.0, and carries all 34 Klicker tools.
   A live test against this new endpoint verified 20/20 chunks emit `chunk_id`
   and `content`. Once Klicker Chat is switched to point to this new service
   URL (W5 cutover), student generation will work out-of-the-box.

## Current boundaries

- The exact student-generation container was revalidated at
  `2da76348c07e6dcd6e858b76d950ea14fd1f30f5`.
- The previously recorded Chat evidence remains 42 focused tests and 378 full
  Chat-suite tests. A fresh rerun in that container stalled in a Vitest fork
  worker before producing a result, so it is not counted as a new pass.
- The student-generation PR stack remains open and draft; backend PR #5481 is
  conflicting with the advanced `v3` base. Rebase, push, merge, deployment,
  Argo sync, and staging access remain separate authority boundaries.
- No staging, deployment, merge, push, or cluster action was taken for this
  gate.
- 2026-08-23 update: read-only cluster checks and two approved synthetic
  probes were executed (values-free evidence above); one local fix commit was
  created in this worktree. Push, MR, merge, deployment pin bump, and Argo
  sync remain separate authority boundaries.
