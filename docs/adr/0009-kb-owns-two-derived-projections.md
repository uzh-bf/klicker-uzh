---
type: Decision Record
title: Knowledge base owns two derived projections
description: The knowledge base owns RAG and graph projections with independent lifecycles.
timestamp: '2026-08-01'
tags:
  - backend
  - knowledge-base
---

# 9. The knowledge base owns two derived projections with independent lifecycles

Status: Accepted (2026-07-31)

## Context

A knowledge base feeds two different AI capabilities: semantic RAG over a Milvus
index, and graph-backed features — GraphRAG, question generation, visualization —
over a FalkorDB knowledge graph. The obvious design, and the one actually built in
[PR #5206](https://github.com/uzh-bf/klicker-uzh/pull/5206), gives each chatbot its
own graph: `ChatbotKnowledgeGraph` owns a graph-specific resource selection, its own
`selectionRevision`, and a graph named `klickeruzh:<chatbotId>`.

That design has two costs. Several chatbots bound to the same knowledge base each
pay for their own build of substantially the same content, and the knowledge base
stops being the single source of truth for what an AI feature knows — a chatbot's
graph can be built from a different resource set than the chatbot's own RAG.

The two projections also behave nothing alike. Milvus ingestion is per-resource,
cheap, and continuous. Graph generation is KB-wide, expensive, performed by an
external system outside this repository, and billed to the lecturer.

## Decision

The knowledge base owns both projections over one resource set. Chatbots consume
them through their enabled KB binding and select nothing of their own. Multiple
chatbots bound to one KB share a single graph and a single build.

The projections keep independent lifecycles. Milvus ingestion stays resource-scoped
and governs ordinary RAG readiness. Graph builds are KB-wide, explicitly requested,
and never scheduled. A graph build failure never blocks or regresses Milvus.

Consistency between them is a content digest over the active serving set, not a
timestamp. A published graph that no longer matches the current digest keeps
serving and is labelled stale on lecturer-facing views.

## Consequences

Per-chatbot graph tailoring is given up. A lecturer who wants two chatbots to reason
over different graphs must give them different knowledge bases.

Graph identity, build state, authorization, and build controls all move from the
chatbot to the KB, and `ChatbotKnowledgeGraph` does not survive.

Because generation lives outside this repository, KlickerUZH owns only the
integration contract, trigger and status state, authorization, FalkorDB reads, and
the user-facing features. Graph generation must not be reimplemented here.

[PR #5206](https://github.com/uzh-bf/klicker-uzh/pull/5206) stays open as the
preserved record of the rejected chatbot-owned alternative until the replacement is
validated against it.
