# Architecture Decision Records

The durable record of **why** — the significant, hard-to-reverse choices behind this codebase. The [engineering wiki](../index.md) explains _what_ and _how_ (non-obvious concepts) and links here for the _why_; the wiki is not itself the decision record.

## Convention

- One decision per file, `NNNN-kebab-slug.md`, numbered sequentially from `0001`.
- Minimal by default: **Status + Context + Decision**, plus **Considered options** / **Consequences** only when they earn their place.
- Supersede, don't rewrite: mark an outdated ADR `Superseded by ADR-NNNN` and add a new one instead of editing the decision away.
- Gate — record an ADR only when the decision is **hard to reverse**, **surprising without context**, and the result of a **real trade-off**. All three must hold.

## Index

- [0001](./0001-automate-db-migrations-via-argocd-presync-hook.md) — Automate database migrations via an ArgoCD PreSync hook
- [0001](./0001-chat-locale-from-cookie.md) — Chat resolves its locale from a cookie, in a chat-local `getRequestConfig`
- [0002](./0002-message-feedback-as-a-rating-field.md) — Message feedback is a nullable field on `ChatMessage`
- [0003](./0003-promote-stg-via-release-annotation-write-back.md) — Promote to staging by writing the built commit into a release annotation
- [0003](./0003-chat-framework-upgrade.md) — Fold the chat framework upgrade into the v3 student-chat branch
- [0004](./0004-chat-citations-from-tool-call-parts.md) — Chat citations are derived from tool-call parts
- [0006](./0006-public-catalyst-capability-floor.md) — What public KlickerUZH keeps when Catalyst is absent
- [0007](./0007-reintegrate-v3-ai-behind-feature-flags.md) — Reintegrate `v3-ai` into `v3` behind feature flags, after VK2
- [0008](./0008-assessment-identity-boundary-and-public-projection.md) — Keep assessment identity course-scoped and minimize public credential identity

`0001` and `0003` are each used twice — the deployment and chat lines numbered
independently before this index existed. Numbers are not reassigned, because existing
records cite them. `0005` is reserved by an open PR. Pick the next free number by
checking this directory, not by counting entries.
