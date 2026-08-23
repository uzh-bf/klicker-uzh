---
type: Log
title: KB v3-ai finalization corrections
description: Records the runtime, chat-scope, graph-monitor, local-development, UI-selector, and owner-authorization corrections made while finalizing PR 5424.
timestamp: '2026-08-23'
tags:
  - backend
  - chat
  - knowledge-base
---

# 2026-08-23

- **Backend ingestion routes**: `apps/backend-docker/src/kbHttpRoutes.ts` mounts
  the authenticated source gateway and raw-body webhook before end-user JWT
  middleware. Service-free route tests cover validation, forwarding, streaming,
  raw bytes, and generic failure responses.
- **Stable chat scope**: a first-turn KB scope token and its eventual chat thread
  now use one preallocated UUID. Required-MCP failure still returns before any
  thread is persisted.
- **Bounded graph reconciliation**: the graph monitor rotates across 32 active
  builds, runs eight provider checks concurrently, and deadlines every provider
  operation at ten seconds while retaining fenced state for retry.
- **Local integration**: graph and ingestion ports are loopback-bound and
  overridable, graph source SAS URLs can use only loopback or `.localhost` HTTP
  endpoints, and the ingestion API keeps SQLite by default with explicit shared
  PostgreSQL configuration for a full worker fleet.
- **Verification surfaces**: graph search, loaded-node, relationship, and close
  actions have stable `data-cy` hooks. The GraphQL guide and matching skill now
  distinguish shareable `withPermission` aggregates from the owner-only KB
  service boundary without widening KB sharing.
