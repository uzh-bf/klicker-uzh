# MCP - Skills

MCP server that exposes “skills” tools to the Chat agent (e.g., look up skills, prerequisites, or skill-linked resources).

## Status in this repo

- **Out-of-repo**: this repository currently contains the **client** integration (Chat loading tools via MCP), but not the server implementation/deployment.
- Client integration points:
  - MCP client + tool aggregation: `apps/chat/src/services/mcpClients.ts`
  - MCP configuration models: `packages/prisma/src/prisma/schema/chat.prisma` (`ChatbotMCPServer`, `ChatbotMCPConfig`)

## Responsibilities (intended)

- Provide one or more MCP tools that interact with a skills/knowledge representation.
- Return structured data the model can use for grounded guidance (course-context “skills”).

## Dependencies (intended)

- **Neo4j** for querying the skills graph.

## Interface / contract (intended)

- Protocol: Model Context Protocol over HTTP (streamable transport).
- Auth + tool allowlisting are configured per chatbot/mode in the Chat database.

## Cross-links

- `04-Building Blocks/Workloads/AI Infra/Chat.md`
- `04-Building Blocks/Workloads/AI Infra/Neo4j.md`
