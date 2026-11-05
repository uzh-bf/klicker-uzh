import { it } from 'vitest'

// Engine-backed suites run only where the private Catalyst engine is
// provisioned (trusted test-graphql runs); public PR CI skips them.
export const adaptiveEngineConfigured = Boolean(
  process.env.ADAPTIVE_ENGINE_URL && process.env.ADAPTIVE_ENGINE_TOKEN
)

export const itWithAdaptiveEngine = it.skipIf(!adaptiveEngineConfigured)
