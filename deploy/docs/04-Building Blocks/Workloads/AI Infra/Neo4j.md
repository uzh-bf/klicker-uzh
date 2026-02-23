# Neo4j

Graph database used by the AI infrastructure for graph-based knowledge/skills representations.

## Status in this repo

- **Out-of-repo**: this repository does not currently contain deployment manifests/configuration for Neo4j.

## Responsibilities (intended)

- Store and query graph-structured knowledge (e.g., skills graph, document graph).

## Interfaces (intended)

- Queried by MCP servers that need graph context, e.g.:
  - `MCP - Doc Query (RAG)`
  - `MCP - Skills`

## Cross-links

- `04-Building Blocks/Workloads/AI Infra/MCP - Doc Query (RAG).md`
- `04-Building Blocks/Workloads/AI Infra/MCP - Skills.md`
