---
type: Change Log
title: Informatik und Wirtschaft chatbot provisioning
description: Document the strict MCP binding and guarded local course provisioner.
timestamp: '2026-08-14'
tags:
  - chat
  - prisma
  - mcp
---

## 2026-08-14

- **Update:** [chat-platform](../chat-platform.md) now links the local, inactive
  course chatbot provisioner to the strict MCP runtime contract.
- **Update:** [data-and-migrations](../data-and-migrations.md) documents the
  dry-run lock, credential boundary, serializable apply check, and replay lock
  for the provisioner.
- **Verification:** The self-contained linked-worktree runtime initialized a
  blank disposable database without reset, seeded synthetic local fixtures,
  and verified the provisioner with a five-row dry run, five-row apply, exact
  second-run no-op, and readback of both strict MCP mode bindings. The
  temporary database input and receipt were removed or restored afterward.
