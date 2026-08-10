---
type: Change Log
title: Biome Tier 1 Error Gate
description: The current Biome error-severity baseline is enforced locally and in CI while advisory diagnostics and parallel tool ownership remain explicit.
timestamp: '2026-08-10'
tags:
  - ci
  - tooling
  - testing
---

## 2026-08-10

**Update**

- `pnpm run lint:biome` now runs the default Biome diagnostics and is included in the blocking `pnpm run check:all` pre-commit aggregate; errors fail the gate while warnings and infos remain visible and advisory.
- The consolidated `check` and path-filtered `check-lint` workflows block on the Biome error tier. Their existing Knip step remains advisory.
- Biome warnings and infos remain outside the blocking gate. Prettier continues to format Markdown/YAML and `playwright/`; ESLint continues as the Next.js safety net.
- The complete current Tier 1 error baseline is tracked in `project/2026-08-09-biome-ratchet-tier1-plan.md`.
