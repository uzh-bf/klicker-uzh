import { clearCache, setPolyfills } from '@growthbook/growthbook'
import type { FeatureFlagAttributes } from '../src/index.js'
import { NodeFeatureFlagClient } from '../src/node.js'

type TestFeatures = {
  'default-on-flag': boolean
  'targeted-flag': boolean
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

  it('does not report an unsuccessful refresh as healthy', async () => {
    mockFetch.mockRejectedValue(new Error('GrowthBook unavailable'))
    const client = new NodeFeatureFlagClient<TestFeatures>({
      apiHost: 'https://growthbook.test',
      clientKey: 'sdk-test',
      environment: 'test',
    })

    expect(await client.initialize()).toBe(false)
    await client.refresh()

    expect(client.getStatus().healthy).toBe(false)
  })

  it('recovers health after a successful refresh', async () => {
    mockFetch.mockRejectedValueOnce(new Error('GrowthBook unavailable'))
    const client = new NodeFeatureFlagClient<TestFeatures>({
      apiHost: 'https://growthbook.test',
      clientKey: 'sdk-test',
      environment: 'test',
    })

    expect(await client.initialize()).toBe(false)
    await client.refresh()

    expect(client.getStatus().healthy).toBe(true)
    expect(client.isEnabled('default-on-flag', enabledAttributes)).toBe(true)
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

  it('fails closed without configuration and does not fetch', async () => {
    const client = new NodeFeatureFlagClient<TestFeatures>({
      environment: 'test',
    })

    expect(await client.initialize()).toBe(false)
    expect(client.isEnabled('targeted-flag', enabledAttributes)).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('honors a forced flag in development but never in production', () => {
    const attributes: FeatureFlagAttributes = { actorType: 'user' }

    const development = new NodeFeatureFlagClient({
      environment: 'development',
      forcedOn: 'ai-beta',
    })
    expect(development.isEnabled('ai-beta', attributes)).toBe(true)

    const production = new NodeFeatureFlagClient({
      environment: 'production',
      forcedOn: 'ai-beta',
    })
    expect(production.isEnabled('ai-beta', attributes)).toBe(false)
  })

  // GrowthBook is authoritative wherever it is reachable: a configured client
  // fetches its payload and the override never enters the picture.
  it('ignores a forced flag once an SDK connection is configured', async () => {
    const client = new NodeFeatureFlagClient({
      apiHost: 'https://growthbook.example',
      clientKey: 'sdk-key',
      environment: 'development',
      forcedOn: 'ai-beta',
    })

    await client.initialize()

    expect(client.isEnabled('ai-beta', { actorType: 'user' })).toBe(false)
  })
})
