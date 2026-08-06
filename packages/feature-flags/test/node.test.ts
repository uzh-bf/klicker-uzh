import { clearCache, setPolyfills } from '@growthbook/growthbook'
import type { FeatureFlagAttributes } from '../src/index.js'
import { NodeFeatureFlagClient } from '../src/node.js'

type TestFeatures = {
  'targeted-flag': boolean
}

const enabledAttributes: FeatureFlagAttributes = {
  id: 'enabled-user',
  actorType: 'user',
  role: 'USER',
  environment: 'test',
}

const disabledAttributes: FeatureFlagAttributes = {
  id: 'disabled-user',
  actorType: 'user',
  role: 'USER',
  environment: 'test',
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
    })

    expect(await client.initialize()).toBe(false)
    expect(client.isEnabled('targeted-flag', enabledAttributes)).toBe(false)
  })

  it('fails closed without configuration and does not fetch', async () => {
    const client = new NodeFeatureFlagClient<TestFeatures>({})

    expect(await client.initialize()).toBe(false)
    expect(client.isEnabled('targeted-flag', enabledAttributes)).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
