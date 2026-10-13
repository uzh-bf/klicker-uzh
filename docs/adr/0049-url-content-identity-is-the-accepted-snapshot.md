---
type: Decision Record
title: URL sources are identified by the accepted snapshot, not a re-fetch
description: Keep the two-fetch byte match for static pages; let the provider consume the accepted snapshot for dynamic pages.
timestamp: '2026-09-18'
tags:
  - backend
  - knowledge-base
---

# 49. URL sources are identified by the accepted snapshot, not a re-fetch

Status: Accepted (2026-09-18)

## Context

For a URL source, Klicker fetches the page, hashes the bytes, and stores the
digest as the resource's content identity. The ingestion worker then fetches the
same URL again and requires an exact SHA-256 match before accepting the snapshot
(`fetch_source_snapshot` / `digest_mismatch`). This two-fetch design was a
deliberate staging compromise recorded in the KB ingestion MVP plan: it keeps the
provider stateless and makes the accepted content auditable from Klicker's side.

Dynamic pages break it. Two fetches of the same URL can return different bytes —
rotating assets, timestamps, personalization, or A/B variants — so the digest
never matches and the resource fails with a bare `digest_mismatch` that no user
action can resolve. The 2026-09-17 STG pass reproduced this on
`https://www.df.uzh.ch/en.html`.

## Decision

The accepted snapshot owns URL content identity. Klicker's fetch defines the
identity, and the provider consumes that exact snapshot rather than re-deriving
it. The two-fetch byte match stays for static pages in the current ingestion MVP
until the single-fetch path ships, and dynamic pages remain a known-unsupported
class with their follow-up owned by the ingestion platform.

This keeps one authority for "what content was accepted" — the producer — which
is what cost settlement, graph provenance, and question citation already key off.
Re-fetching moves that authority to a second request whose result the producer
never sees.

## Considered options

- **Keep the two-fetch match and document it.** Cheapest, but leaves ordinary
  dynamic URLs permanently failing with an opaque error, and the failure is not
  actionable by the lecturer.
- **Let the provider fetch and report the digest back.** Makes the provider
  authoritative for identity, which breaks cost settlement and provenance that
  Klicker already pins before dispatch.
- **Snapshot to immutable storage on accept and have the provider read that.**
  Single authority, provider stays stateless, and dynamic content is captured
  once. This is the direction; it needs an ingestion-platform contract change and
  is not part of the current milestone.

## Consequences

The current milestone does not change the fetch contract: static pages keep
working, and dynamic pages keep failing with `digest_mismatch` until the
single-fetch path lands. That path is a separate ingestion-platform package, and
until it ships the supported URL class is static pages only.
