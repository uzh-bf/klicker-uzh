# Course Discussion Embed Bearer Transport

## Status

Accepted

## Context

Course discussion embed links carry a signed bearer token that grants access to one course and external-block scope. Putting that token in a query string exposes it to request logs, browser history, referrer headers, and persisted-query GET URLs.

## Decision

New embed links carry the token in the URL fragment. The PWA reads it once, removes it from browser history before loading discussion data, and sends every token-bearing GraphQL operation with POST. The page also sets a `no-referrer` policy. Legacy query-string links remain readable during the alpha rollout and are immediately cleaned from the visible URL.

Embed tokens expire after 48 hours by default and at most 14 days, are bound to one course and scope, and can grant anonymous writes only when both the token claim and course setting allow them. The course Q&A runtime switch remains the whole-course kill switch; alpha embeds do not have per-token revocation.

## Consequences

Fragments are not included in HTTP requests or referrer headers, reducing accidental token disclosure. The token still exists in browser memory while the embed is open, so embedded pages must remain free of untrusted scripts and future per-token revocation requires additional persisted token state.
