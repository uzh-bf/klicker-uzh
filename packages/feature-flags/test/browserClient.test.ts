import { clearCache, setPolyfills } from '@growthbook/growthbook'
import { createBrowserFeatureFlagClient } from '../src/browserClient.js'
import type { FeatureFlagAttributes } from '../src/index.js'

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

describe('createBrowserFeatureFlagClient', () => {
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

  it('updates evaluations when the active attributes change', async () => {
    const { growthbook, initialize } =
      createBrowserFeatureFlagClient<TestFeatures>({
        apiHost: 'https://growthbook.test',
        clientKey: 'sdk-test',
        environment: 'test',
      })

    const initialization = initialize()
    expect(initialize()).toBe(initialization)
    expect(await initialization).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://growthbook.test/api/features/sdk-test',
      expect.any(Object)
    )

    await growthbook.setAttributes(enabledAttributes)
    expect(growthbook.isOn('targeted-flag')).toBe(true)

    await growthbook.setAttributes(disabledAttributes)
    expect(growthbook.isOn('targeted-flag')).toBe(false)
  })

  it('fails closed when the feature payload cannot be loaded', async () => {
    mockFetch.mockRejectedValueOnce(new Error('GrowthBook unavailable'))
    const { growthbook, initialize } =
      createBrowserFeatureFlagClient<TestFeatures>({
        apiHost: 'https://growthbook.test',
        clientKey: 'sdk-test',
        environment: 'test',
      })

    expect(await initialize()).toBe(false)
    await growthbook.setAttributes(enabledAttributes)
    expect(growthbook.isOn('targeted-flag')).toBe(false)
  })

  it('keeps a usable payload when a later refresh fails', async () => {
    const { growthbook, initialize, setAttributes } =
      createBrowserFeatureFlagClient<TestFeatures>({
        apiHost: 'https://growthbook.test',
        clientKey: 'sdk-test',
        environment: 'test',
      })

    await initialize()
    await setAttributes({ id: 'enabled-user', actorType: 'user', role: 'USER' })
    expect(growthbook.isOn('targeted-flag')).toBe(true)

    mockFetch.mockRejectedValueOnce(new Error('GrowthBook unavailable'))
    await growthbook.refreshFeatures({ skipCache: true, timeout: 100 })

    expect(growthbook.isOn('targeted-flag')).toBe(true)
  })

  it('blocks payload-driven experiment side effects', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          features: {
            'default-on-flag': {
              defaultValue: true,
            },
          },
          experiments: [
            {
              key: 'visual-experiment',
              variations: [
                {
                  domMutations: [],
                  js: 'globalThis.__growthbookInjected = true',
                },
                {
                  domMutations: [],
                  js: 'globalThis.__growthbookInjected = false',
                },
              ],
              weights: [0.5, 0.5],
            },
            {
              key: 'redirect-experiment',
              variations: [
                { urlRedirect: 'https://growthbook.test/redirect-a' },
                { urlRedirect: 'https://growthbook.test/redirect-b' },
              ],
              urlPatterns: ['*'],
              weights: [0.5, 0.5],
            },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    )

    const { growthbook, initialize } =
      createBrowserFeatureFlagClient<TestFeatures>({
        apiHost: 'https://growthbook.test',
        clientKey: 'sdk-test',
        environment: 'test',
      })

    expect(await initialize()).toBe(true)
    growthbook.triggerAutoExperiments()

    expect(growthbook.getRedirectUrl()).toBe('')
    expect(growthbook.getAllResults().size).toBe(0)
    expect(growthbook.isOn('default-on-flag')).toBe(true)
  })

  it('fails closed without fetching for an invalid environment', async () => {
    const { growthbook, initialize } =
      createBrowserFeatureFlagClient<TestFeatures>({
        apiHost: 'https://growthbook.test',
        clientKey: 'sdk-test',
        environment: 'prod',
      })

    expect(await initialize()).toBe(false)
    await growthbook.setAttributes(enabledAttributes)
    expect(growthbook.isOn('targeted-flag')).toBe(false)
    expect(growthbook.isOn('default-on-flag')).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('filters direct identifiers before setting browser attributes', async () => {
    const { growthbook, initialize, setAttributes } =
      createBrowserFeatureFlagClient<TestFeatures>({
        apiHost: 'https://growthbook.test',
        clientKey: 'sdk-test',
        environment: 'test',
      })

    await initialize()
    await setAttributes({
      id: 'user-id',
      actorType: 'user',
      role: 'USER',
      email: 'user@example.com',
    })

    expect(growthbook.isOn('identifier-flag')).toBe(false)
    expect(growthbook.getAttributes()).toEqual({
      id: 'user-id',
      actorType: 'user',
      role: 'USER',
      environment: 'test',
    })
  })

  it('initializes once and fails closed without configuration', async () => {
    const { growthbook, initialize } =
      createBrowserFeatureFlagClient<TestFeatures>({ environment: 'test' })

    expect(await initialize()).toBe(false)
    expect(await initialize()).toBe(false)
    await growthbook.setAttributes(enabledAttributes)
    expect(growthbook.isOn('targeted-flag')).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
