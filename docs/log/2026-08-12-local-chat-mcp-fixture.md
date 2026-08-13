---
type: Change Log
title: Local Chat MCP Fixture
description: Local deterministic MCP testing and Auto V2 routing through the OpenRouter-backed devcontainer.
timestamp: '2026-08-12'
tags:
  - chat
  - mcp
  - development
---

# Local Chat MCP Fixture

The self-contained devcontainer now runs a deterministic, read-only MCP server
for the seeded Benibot. The existing Tutor and Explainer seed configurations
connect to `http://localhost:1417/mcp` and expose its `doc_query` tool as
`KB_doc_query` in Chat.

The fixture returns only synthetic content with a stable
`KLICKER_LOCAL_MCP_OK` marker and one synthetic source. It verifies local MCP
discovery, invocation, streaming, result rendering, and persistence without
depending on a deployed retrieval service. It does not validate retrieval
quality or production MCP configuration.

The same local test package now pins LiteLLM 1.96.2 and mirrors the deployed
Klicker Auto V2 policy: Luna low classifies, an OpenRouter-backed
`text-embedding-3-small` matches the semantic corpus, Luna handles SIMPLE
through COMPLEX at increasing effort, and Sol medium handles REASONING. The
local generic upstream and GPT-5.1 fallback remain deliberate differences from
the production Azure and failover topology. Classifier, embedding, and answer
requests all use the same external OpenRouter boundary, adding local latency
and usage cost.

`post-start.sh` owns the fixture process separately from the main application
stack, waits for `/health`, and writes its output to `/tmp/local-mcp.log`. The
copy-paste Auto Mode browser test and fail-closed routing checks are documented
in `AGENTS.md` and the Chat Platform testing section.
