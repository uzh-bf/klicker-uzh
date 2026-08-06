import { clearCache, setPolyfills } from '@growthbook/growthbook'
import { createBrowserFeatureFlagClient } from '../src/browserClient.js'
import type { FeatureFlagAttributes } from '../src/index.js'

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

describe('createBrowserFeatureFlagClient', () => {
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

  it('updates evaluations when the active attributes change', async () => {
    const { growthbook, initialize } =
      createBrowserFeatureFlagClient<TestFeatures>({
        apiHost: 'https://growthbook.test',
        clientKey: 'sdk-test',
      })

    expect(await initialize()).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://growthbook.test/api/features/sdk-test',
      expect.any(Object)
    )

    await growthbook.setAttributes(enabledAttributes)
    expect(growthbook.isOn('targeted-flag')).toBe(true)

    await growthbook.setAttributes(disabledAttributes)
    expect(growthbook.isOn('targeted-flag')).toBe(false)
  })

  it('initializes once and fails closed without configuration', async () => {
    const { growthbook, initialize } =
      createBrowserFeatureFlagClient<TestFeatures>({})

    expect(await initialize()).toBe(false)
    expect(await initialize()).toBe(false)
    await growthbook.setAttributes(enabledAttributes)
    expect(growthbook.isOn('targeted-flag')).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
