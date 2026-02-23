# MCP - Doc Query (RAG)

MCP server that exposes retrieval tools for “document query” / RAG to the Chat agent.

## Status in this repo

- **Out-of-repo**: this repository currently contains the **client** integration (Chat loading tools via MCP), but not the server implementation/deployment.
- Client integration points:
  - MCP client + tool aggregation: `apps/chat/src/services/mcpClients.ts`
  - MCP configuration models: `packages/prisma/src/prisma/schema/chat.prisma` (`ChatbotMCPServer`, `ChatbotMCPConfig`)

## Responsibilities (intended)

- Provide one or more MCP tools that:
  - accept a user query / context
  - retrieve relevant documents/snippets
  - return structured results that the model can cite/use

## Dependencies (intended)

- **Milvus** for vector similarity search (embeddings).
- **Neo4j** for graph context (optional; depends on how doc metadata is modeled).

## Interface / contract (intended)

- Protocol: Model Context Protocol over HTTP (streamable transport).
- Auth: configured per server in the database (`bearer` / `basic` / `custom` / `none`).
- Tool allowlisting: configured per chatbot/mode (`allowedTools` supports wildcards).

## Cross-links

- `04-Building Blocks/Workloads/AI Infra/Chat.md`
- `04-Building Blocks/Workloads/AI Infra/Milvus.md`
- `04-Building Blocks/Workloads/AI Infra/Neo4j.md`
