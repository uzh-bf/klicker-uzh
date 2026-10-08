# 51. AI releases are tagged on `v3-ai` and rendered from `v3` under deploy parity

## Status

Accepted — 2026-10-08. Supersedes [ADR-0028](./0028-short-lived-qualified-rc-branch-for-ai-releases.md).

## Context

ADR-0028 planned to ship each AI release from a short-lived `v3.5.0-ai-rc`
branch. Staging would be reset to qualify that branch, the branch would merge
into `v3`, and `v3` would accept only critical fixes until the dark deploy.

None of this was ever put into practice. Alphas `v3.4.0-alpha.82` to `.84` were
tagged on `v3-ai`, and their images run in production. ArgoCD still renders
production from `deploy/` on `v3`. The deploy parity check
(`.github/scripts/deploy-parity.cjs`) keeps the two branches' `deploy/` trees
equal, apart from the environment-owned image `tag:` and `pullPolicy:` lines.
[CI and deployment](../ci-and-deployment.md#deploy-parity-across-v3-and-v3-ai)
documents this path, so the accepted ADR contradicted the documented one.

The two paths trade off differently. The RC path proves the release on a reset
staging database and makes `v3` the source of production code. In exchange,
staging pauses, `v3` merges are held for about two weeks, and every release
needs a merge back into `v3`. The current path keeps both lines moving.
However, production code comes from `v3-ai`, so a `v3` change reaches
production only after it has been synced into `v3-ai` and tagged there.

## Decision

AI releases follow the documented path:

- Alphas are cut on `v3-ai` with `pnpm run release:alpha`, and the tag push
  builds the production images.
- Production renders `deploy/` from `v3`. A production image roll changes the
  image `tag:` lines on `v3`, and it merges together with any `deploy/`
  promotion from `v3-ai` that those images require. Values that the running
  images cannot parse never merge ahead of them.
- The deploy parity check is the gate that keeps the two `deploy/` trees from
  diverging.
- There is no RC branch, staging reset or `v3` merge hold.

Two rules from ADR-0028 still apply to every release:

- **Ship clean or park.** Every model, enum, constraint and migration in a
  tagged tree is an accepted production shape. Feature flags gate exposure, but
  they never excuse schema debt.
- **Forward-only rollback.** Images and flags roll back. A faulty migration is
  repaired by a compensating forward migration. Database down-migrations are not
  promised and not written.

## Consequences

- Before a tag is pushed, review each migration that is new since the previous
  production tag against the clean-schema rule. Hand-written data steps get the
  most scrutiny, because staging data may not show what production stores.
- A release whose values change the model registry or another contract the
  images parse ships the image roll and the values in one `v3` PR.
  Production is never synced with only half of that change.
- This path holds until `v3-ai` is folded back into `v3`
  ([ADR-0007](./0007-reintegrate-v3-ai-behind-feature-flags.md)). After that,
  releases tag the mainline and the parity check retires.
