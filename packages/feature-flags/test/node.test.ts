import { clearCache, setPolyfills } from '@growthbook/growthbook'
import type { FeatureFlagAttributes } from '../src/index.js'
import { NodeFeatureFlagClient } from '../src/node.js'

type TestFeatures = {
  'default-on-flag': boolean
  'targeted-flag': boolean
  'identifier-flag': boolean
}

const enabledAttributes: FeatureFlagAttributes = {
  id: 'enabled-user',
  actorType: 'user',
  role: 'USER',
}

const disabledAttributes: FeatureFlagAttributes = {
  id: 'disabled-user',
  actorType: 'user',
  role: 'USER',
}

const originalFetch = globalThis.fetch

let mockFetch: ReturnType<typeof vi.fn>

describe('NodeFeatureFlagClient', () => {
  beforeEach(async () => {
    await clearCache()
    mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          features: {
            'default-on-flag': {
              defaultValue: true,
            },
            'targeted-flag': {
              defaultValue: false,
              rules: [
                {
                  condition: { id: 'enabled-user' },
                  force: true,
                },
              ],
            },
            'identifier-flag': {
              defaultValue: false,
              rules: [
                {
                  condition: { email: 'user@example.com' },
                  force: true,
                },
              ],
            },
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    )

    setPolyfills({
      fetch: mockFetch,
    })
  })

  afterEach(() => {
    setPolyfills({
      fetch: originalFetch,
    })
  })

  it('evaluates request attributes independently on one client', async () => {
    const client = new NodeFeatureFlagClient<TestFeatures>({
      apiHost: 'https://growthbook.test',
      clientKey: 'sdk-test',
      environment: 'test',
    })

    expect(await client.initialize()).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://growthbook.test/api/features/sdk-test',
      expect.any(Object)
    )
    expect(client.isEnabled('targeted-flag', enabledAttributes)).toBe(true)
    expect(client.isEnabled('targeted-flag', disabledAttributes)).toBe(false)
    expect(client.isEnabled('targeted-flag', enabledAttributes)).toBe(true)
  })

  it('fails closed when the feature payload cannot be loaded', async () => {
    mockFetch.mockRejectedValueOnce(new Error('GrowthBook unavailable'))
    const client = new NodeFeatureFlagClient<TestFeatures>({
      apiHost: 'https://growthbook.test',
      clientKey: 'sdk-test',
      environment: 'test',
    })

    expect(await client.initialize()).toBe(false)
    expect(client.isEnabled('targeted-flag', enabledAttributes)).toBe(false)
  })

  it('fails closed without fetching for an invalid environment', async () => {
    const client = new NodeFeatureFlagClient<TestFeatures>({
      apiHost: 'https://growthbook.test',
      clientKey: 'sdk-test',
      environment: 'prod',
    })

    expect(await client.initialize()).toBe(false)
    expect(client.isEnabled('targeted-flag', enabledAttributes)).toBe(false)
    expect(client.isEnabled('default-on-flag', enabledAttributes)).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('filters direct identifiers before request-scoped evaluation', async () => {
    const client = new NodeFeatureFlagClient<TestFeatures>({
      apiHost: 'https://growthbook.test',
      clientKey: 'sdk-test',
      environment: 'test',
    })

    await client.initialize()

    expect(
      client.isEnabled('identifier-flag', {
        id: 'user-id',
        actorType: 'user',
        role: 'USER',
        email: 'user@example.com',
      } as unknown as FeatureFlagAttributes)
    ).toBe(false)
  })

  it('reports initialization status for service readiness checks', async () => {
    const client = new NodeFeatureFlagClient<TestFeatures>({
      apiHost: 'https://growthbook.test',
      clientKey: 'sdk-test',
      environment: 'test',
    })

    expect(client.getStatus()).toEqual({
      configured: true,
      environment: 'test',
      initialized: false,
      healthy: false,
    })
    await client.initialize()
    expect(client.getStatus()).toEqual({
      configured: true,
      environment: 'test',
      initialized: true,
      healthy: true,
    })
  })

  it('fails closed without configuration and does not fetch', async () => {
    const client = new NodeFeatureFlagClient<TestFeatures>({
      environment: 'test',
    })

    expect(await client.initialize()).toBe(false)
    expect(client.isEnabled('targeted-flag', enabledAttributes)).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
