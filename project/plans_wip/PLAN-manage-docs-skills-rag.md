# Manage Assistant Docs Skills and Retrieval Plan

## Goal

Make the Manage assistant useful for KlickerUZH product help: explain how the tool works, route lecturers to authoritative documentation, and surface relevant videos/images from the docs.

## Current Slice: Static Docs Navigator Skill

- Add a `Klicker Documentation Navigator` skill to the Manage assistant skill prompt.
- Keep it source-controlled and deterministic.
- Cover the high-value docs pages:
  - core concepts
  - lecturer tutorials for elements, activities, courses, integrations, sharing/review
  - use cases, including AI-enhanced learning
  - representative videos and images from `apps/docs`
- Instruct the assistant to use docs links for product help and MCP tools for live account/course/question data.

## Why Not Full RAG First

Vector RAG is useful once the assistant needs to quote or synthesize arbitrary docs paragraphs, but it adds chunking, embeddings, storage, indexing, freshness, and evaluation work. For this first assistant slice, the biggest user value is reliable routing to the right docs page or media asset.

## Simple Retrieval Next

Before vector embeddings, add a deterministic docs search tool:

1. Generate a compact docs manifest from `apps/docs/docs`, `apps/docs/src/pages/use_cases`, and referenced media.
2. Store route, title, headings, short summary, tags, and media URLs.
3. Expose a read-only `klicker_docs_search` tool to the Manage assistant, either in chat or the lecturer MCP.
4. Match queries with simple normalized keyword scoring over title/headings/tags.
5. Return top results with URL, page title, short matched context, and media links.

This covers most "where is the docs page/video/image for X?" requests without adding infrastructure.

## When To Add RAG

Add semantic/vector RAG only after the deterministic manifest misses real user questions, or when users expect paragraph-level answers grounded in docs snippets. At that point, use the manifest as metadata and add chunk-level retrieval with citations back to docs pages.
