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

## Resolution

<!-- filled in on close -->
