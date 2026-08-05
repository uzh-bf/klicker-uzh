## 2026-08-04

- **Creation**: [adr/0003](../adr/0003-promote-stg-via-release-annotation-write-back.md) records why staging promotion writes the built commit into the `rollout.klicker.uzh.ch/release` pod annotation, why it is gated on all 13 stg image builds, and why it publishes as an auto-merging PR instead of a direct push to `v3`.
- **Update**: [ci-and-deployment](../ci-and-deployment.md) replaces the "Open questions" section with a "Staging promotion" section — ArgoCD does auto-sync on git change, but neither a rebuilt floating tag nor a hook-only commit changes the rendered manifest, which is what the annotation exists to work around.
