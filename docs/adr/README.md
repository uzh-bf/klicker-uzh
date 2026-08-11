# Architecture Decision Records

The durable record of **why** — the significant, hard-to-reverse choices behind this codebase. The [engineering wiki](../index.md) explains _what_ and _how_ (non-obvious concepts) and links here for the _why_; the wiki is not itself the decision record.

## Convention

- One decision per file, `NNNN-kebab-slug.md`, numbered sequentially from `0001`.
- Minimal by default: **Status + Context + Decision**, plus **Considered options** / **Consequences** only when they earn their place.
- Supersede, don't rewrite: mark an outdated ADR `Superseded by ADR-NNNN` and add a new one instead of editing the decision away.
- Gate — record an ADR only when the decision is **hard to reverse**, **surprising without context**, and the result of a **real trade-off**. All three must hold.

## Index

- [0001](./0001-automate-db-migrations-via-argocd-presync-hook.md) — Automate database migrations via an ArgoCD PreSync hook
- [0003](./0003-promote-stg-via-release-annotation-write-back.md) — Promote to staging by writing the built commit into a release annotation
- [0005](./0005-versioned-chat-engine-boundary.md) — Cross chat generation through a versioned internal engine boundary
- [0006](./0006-roll-chat-engine-contract-generations.md) — Roll ordinal chat-engine contract generations without negotiation
- [0007](./0007-use-a-stateless-catalyst-adaptive-engine.md) — Keep adaptive product state public and psychometric decisions in a stateless Catalyst engine
- [0008](./0008-split-learning-analytics-compute-from-product-surfaces.md) — Keep analytics product surfaces public and move computation into a least-privilege private service
