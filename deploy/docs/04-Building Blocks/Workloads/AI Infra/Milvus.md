# Milvus

Vector database used by the AI infrastructure for embedding storage and similarity search (RAG).

## Status in this repo

- **Out-of-repo**: this repository does not currently contain deployment manifests/configuration for Milvus.

## Responsibilities (intended)

- Store document/knowledge-base embeddings.
- Provide vector similarity search for retrieval pipelines.

## Interfaces (intended)

- Queried by MCP servers that implement RAG, e.g. `MCP - Doc Query (RAG)`.

## Cross-links

- `04-Building Blocks/Workloads/AI Infra/MCP - Doc Query (RAG).md`
