# T04 — Assess passkey viability and pin SimpleWebAuthn

Label: `wayfinder:research`
Parent: [MAP.md](../MAP.md)
Status: open
Assignee:
Blocked by: —

## Question

The plan's findings table notes SimpleWebAuthn "appears transitively only; implementation
needs direct pinned dependencies". The plan then builds passkey support into its target
flows. Confirm that is still a viable foundation before any slice depends on it.

Establish:

- which SimpleWebAuthn packages the plan actually needs (server and browser), at what
  versions, and whether they are compatible with Next 16 and Node 24 as pinned by Volta;
- what the transitive appearance in `pnpm-lock.yaml` is today, and whether it conflicts
  with a direct pin;
- whether passkey registration and authentication work in the devcontainer setup at all
  — WebAuthn requires a secure context, and the workspace-namespaced
  `*.klicker.<workspace>.localhost` domains with mkcert certs may or may not satisfy the
  relying-party ID rules;
- what the plan's shared-device warning assumes about platform vs cross-platform
  authenticators.

If the devcontainer cannot host a working WebAuthn relying party, say so plainly — that
constrains how passkey work can be verified later and is worth knowing now rather than
mid-slice.

[The claim re-verification](T01-reverify-codebase-claims.md) sharpened the second bullet
and part of the first. SimpleWebAuthn is not installed at all — not transitively, not
anywhere. It appears in `pnpm-lock.yaml:2893-2899` solely as an **optional unmet peer**
of `@auth/core@0.41.2`, the Auth.js core behind `apps/auth`, pinned there to
`@simplewebauthn/browser ^9.0.1` and `@simplewebauthn/server ^9.0.2`.

That turns one of the questions into a fork worth answering explicitly: adopting Auth.js's
own WebAuthn provider means accepting its v9 pin, while a standalone integration is free
to take a current SimpleWebAuthn release. Say which the plan's flows actually need, and
whether the two can coexist given `apps/auth` already owns the assessment login path.

## Resolution

<!-- filled in on close -->
