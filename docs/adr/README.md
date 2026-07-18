# Architecture Decision Records

The durable record of **why** — the significant, hard-to-reverse choices behind this codebase. The [engineering wiki](../index.md) explains _what_ and _how_ (non-obvious concepts) and links here for the _why_; the wiki is not itself the decision record.

## Convention

- One decision per file, `NNNN-kebab-slug.md`, numbered sequentially from `0001`.
- Minimal by default: **Status + Context + Decision**, plus **Considered options** / **Consequences** only when they earn their place.
- Supersede, don't rewrite: mark an outdated ADR `Superseded by ADR-NNNN` and add a new one instead of editing the decision away.
- Gate — record an ADR only when the decision is **hard to reverse**, **surprising without context**, and the result of a **real trade-off**. All three must hold.

## Index

- [0001](./0001-automate-db-migrations-via-argocd-presync-hook.md) — Automate database migrations via an ArgoCD PreSync hook
