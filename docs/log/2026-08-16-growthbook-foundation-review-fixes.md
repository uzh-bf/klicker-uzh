# 2026-08-16 — GrowthBook foundation review fixes

- **Renumber**: the GrowthBook decision moved from `docs/adr/0005-…` to
  [ADR 0008](../adr/0008-use-growthbook-for-feature-flags.md). `0005` was
  claimed concurrently by more than one open branch; `0008` is the first number
  free against `v3` and every open pull request.
- **Correction**: `normalizeFeatureFlagEnvironment` no longer maps an
  unrecognized environment onto `development`. An unset value still resolves to
  `development`; anything else present but unrecognized resolves to the new
  `unknown` member of `FeatureFlagEnvironment` and is logged. The adapters
  treat that value as unconfigured and evaluate against an empty payload.
- **Correction**: `FEATURE_FLAG_DEFAULTS` is now typed
  `satisfies Record<string, false>`. Evaluation resolves an unavailable flag
  through GrowthBook's own `false` fallback and never reads this object, so a
  `true` default would have advertised behavior the evaluation path cannot
  deliver. Defaulting a flag on now requires moving to
  `getFeatureValue`/`useFeatureValue` deliberately.
- **Build configuration**: `NEXT_PUBLIC_ENV` is registered in `turbo.json`
  `globalEnv`. It reaches the Manage image as a Docker `ENV` rather than through
  `.env.production`, so it was the one public build variable absent from the
  Turborepo cache key.

See [Feature Flags](../feature-flags.md).
