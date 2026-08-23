import { describe, expect, test } from 'vitest'

import {
  PROVIDER_PROFILE_MANIFESTS,
  getProviderProfileManifest,
} from '@/src/lib/server/providerProfiles'

describe('provider profile manifests', () => {
  test('every manifest carries safe policy fields only', () => {
    for (const manifest of PROVIDER_PROFILE_MANIFESTS) {
      expect(manifest.key).toMatch(/^[a-z0-9-]+$/)
      expect(manifest.endpointAlias.startsWith('http')).toBe(false)
      expect(manifest.deploymentAliases.length).toBeGreaterThan(0)
      expect(manifest.currency).toHaveLength(3)
      expect(manifest.pricingSource).toBe('litellm-model-cost-map')
      // No credential-shaped material may appear in a manifest.
      const serialized = JSON.stringify(manifest)
      expect(serialized.toLowerCase()).not.toContain('apikey')
      expect(serialized.toLowerCase()).not.toContain('secret')
    }
  })

  test('the first cohort exposes one named model and no Auto manifest', () => {
    const uzh = getProviderProfileManifest('uzh-azure-openai')
    expect(uzh).toBeDefined()
    expect(uzh?.deploymentAliases).toEqual(['gpt-5.6-luna'])
    // Auto is a later gated layer; the first version must not publish it.
    expect(uzh?.autoManifestVersion).toBeNull()
  })

  test('data boundary statements are factual notice copy', () => {
    for (const manifest of PROVIDER_PROFILE_MANIFESTS) {
      for (const statement of manifest.dataBoundary) {
        expect(statement).not.toMatch(/consent|waiver/i)
      }
    }
  })

  test('unknown keys resolve to undefined without throwing', () => {
    expect(getProviderProfileManifest('does-not-exist')).toBeUndefined()
  })
})
