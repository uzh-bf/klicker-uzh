---
type: Change Log
title: Local Chat MCP Fixture
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

`post-start.sh` owns the fixture process separately from the main application
stack, waits for `/health`, and writes its output to `/tmp/local-mcp.log`. The
copy-paste browser test and the current Auto Mode limitation are documented in
`AGENTS.md` and the Chat Platform testing section.
