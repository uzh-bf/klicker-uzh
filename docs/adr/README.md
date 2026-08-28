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
- [0008](./0008-use-growthbook-for-feature-flags.md) — Use GrowthBook for shared feature flags
- [0019](./0019-chatbot-config-postgresql-authoritative.md) — Chatbot configuration is PostgreSQL-authoritative; runtimes compile it per request
- [0020](./0020-two-tier-chatbot-approval.md) — Two-tier approval: account AI capability plus per-chatbot publication
- [0021](./0021-templated-standard-modes-reviewed-custom-modes.md) — Standard modes are templated, custom modes are reviewed; both layer over fixed scaffolding
- [0022](./0022-no-student-text-in-manage.md) — The manage surface shows no student-authored text
- [0037](./0037-standard-activity-formats.md) — Practice quizzes, microlearnings, and group activities are standard capabilities
- [0041](./0041-chatbot-trusted-pilot-boundary.md) — Stage chatbot usage enforcement and keep the trusted pilot operations-assisted

`0001`, `0003`, and `0008` are each used twice — their lines were numbered
independently before this index existed. Numbers are not reassigned, because
existing records cite them. `0005` is reserved by an open PR, and open branches
claim numbers through `0018` (KB line `0009`–`0016`, feature flags, UZH
theming). Pick the next free number by checking this directory **and**
`docs/adr/` on open branches, not by counting entries.
