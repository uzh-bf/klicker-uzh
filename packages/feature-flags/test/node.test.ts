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

function featureResponse(defaultOn = true) {
  return new Response(
    JSON.stringify({
      features: {
        'default-on-flag': {
          defaultValue: defaultOn,
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
}

function rawFeatureResponse(definition: unknown) {
  return new Response(
    JSON.stringify({
      features: {
        'targeted-flag': definition,
      },
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }
  )
}

let mockFetch: ReturnType<typeof vi.fn>

function createClient(
  config: Partial<
    ConstructorParameters<typeof NodeFeatureFlagClient<TestFeatures>>[0]
  > = {}
) {
  return new NodeFeatureFlagClient<TestFeatures>({
    apiHost: 'https://growthbook.test',
    clientKey: 'sdk-test',
    environment: 'test',
    fetch: mockFetch,
    refreshIntervalMs: 0,
    ...config,
  })
}

describe('NodeFeatureFlagClient', () => {
  beforeEach(() => {
    mockFetch = vi.fn().mockImplementation(() => featureResponse())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('evaluates request attributes independently on one client', async () => {
    const client = createClient()

    expect(await client.initialize()).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://growthbook.test/api/features/sdk-test',
      expect.objectContaining({
        redirect: 'error',
        signal: expect.any(AbortSignal),
      })
    )
    expect(client.isEnabled('targeted-flag', enabledAttributes)).toBe(true)
    expect(client.isEnabled('targeted-flag', disabledAttributes)).toBe(false)
    expect(client.isEnabled('targeted-flag', enabledAttributes)).toBe(true)
  })

  it.each([
    ['string false', 'false'],
    ['string true', 'true'],
    ['number', 1],
    ['object', {}],
  ])('fails closed for a non-boolean %s default', async (_label, value) => {
    mockFetch.mockResolvedValueOnce(rawFeatureResponse({ defaultValue: value }))
    const client = createClient()

    expect(await client.initialize()).toBe(true)
    expect(client.isEnabled('targeted-flag', enabledAttributes)).toBe(false)
  })

  it.each([
    ['string false', 'false'],
    ['string true', 'true'],
    ['number', 1],
    ['object', {}],
  ])('fails closed for a non-boolean %s rule value', async (_label, value) => {
    mockFetch.mockResolvedValueOnce(
      rawFeatureResponse({
        defaultValue: false,
        rules: [
          {
            condition: { id: 'enabled-user' },
            force: value,
          },
        ],
      })
    )
    const client = createClient()

    expect(await client.initialize()).toBe(true)
    expect(client.isEnabled('targeted-flag', enabledAttributes)).toBe(false)
  })

  it('fails closed when the feature payload cannot be loaded', async () => {
    mockFetch.mockRejectedValueOnce(new Error('GrowthBook unavailable'))
    const client = createClient()

    expect(await client.initialize()).toBe(false)
    expect(client.isEnabled('targeted-flag', enabledAttributes)).toBe(false)
  })

  it('does not report an unsuccessful refresh as healthy', async () => {
    mockFetch.mockRejectedValue(new Error('GrowthBook unavailable'))
    const client = createClient()

    expect(await client.initialize()).toBe(false)
    await client.refresh()

    expect(client.getStatus().healthy).toBe(false)
  })

  it('recovers health after a successful refresh', async () => {
    mockFetch.mockRejectedValueOnce(new Error('GrowthBook unavailable'))
    const client = createClient()

    expect(await client.initialize()).toBe(false)
    await client.refresh()

    expect(client.getStatus()).toMatchObject({ healthy: true, stale: false })
    expect(client.isEnabled('default-on-flag', enabledAttributes)).toBe(true)
  })

  it('aborts a hung request at the deadline and recovers independently', async () => {
    let initialSignal: AbortSignal | undefined
    mockFetch.mockImplementationOnce(
      (_url: string, options?: RequestInit) =>
        new Promise(() => {
          initialSignal = options?.signal ?? undefined
        })
    )
    const client = createClient({ timeoutMs: 5 })

    expect(await client.initialize()).toBe(false)
    expect(initialSignal?.aborted).toBe(true)

    await client.refresh()

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(client.isEnabled('default-on-flag', enabledAttributes)).toBe(true)
  })

  it('applies a revoked entitlement on the next refresh', async () => {
    mockFetch
      .mockResolvedValueOnce(featureResponse(true))
      .mockResolvedValueOnce(featureResponse(false))
    const client = createClient()

    expect(await client.initialize()).toBe(true)
    expect(client.isEnabled('default-on-flag', enabledAttributes)).toBe(true)

    await client.refresh()

    expect(client.isEnabled('default-on-flag', enabledAttributes)).toBe(false)
  })

  it('fails closed after the last usable payload exceeds its stale bound', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-25T12:00:00Z'))
    mockFetch
      .mockResolvedValueOnce(featureResponse(true))
      .mockRejectedValueOnce(new Error('GrowthBook unavailable'))
    const client = createClient({ maxStaleMs: 100 })

    expect(await client.initialize()).toBe(true)
    await client.refresh()
    expect(client.isEnabled('default-on-flag', enabledAttributes)).toBe(true)
    expect(client.getStatus().healthy).toBe(false)

    vi.advanceTimersByTime(101)

    expect(client.isEnabled('default-on-flag', enabledAttributes)).toBe(false)
    expect(client.getStatus().stale).toBe(true)
  })

  it('clamps unsafe refresh intervals and stops when destroyed', async () => {
    vi.useFakeTimers()
    mockFetch
      .mockResolvedValueOnce(featureResponse(true))
      .mockImplementation(() => featureResponse(false))
    const client = createClient({ refreshIntervalMs: -1, maxStaleMs: 500 })

    expect(await client.initialize()).toBe(true)
    expect(client.isEnabled('default-on-flag', enabledAttributes)).toBe(true)

    await vi.advanceTimersByTimeAsync(99)
    expect(mockFetch).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)

    expect(client.isEnabled('default-on-flag', enabledAttributes)).toBe(false)
    expect(mockFetch).toHaveBeenCalledTimes(2)

    client.destroy()
    await vi.advanceTimersByTimeAsync(100)

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(client.isEnabled('default-on-flag', enabledAttributes)).toBe(false)
  })

  it('fails closed without fetching for an invalid environment', async () => {
    const client = createClient({ environment: 'prod' })

    expect(await client.initialize()).toBe(false)
    expect(client.isEnabled('targeted-flag', enabledAttributes)).toBe(false)
    expect(client.isEnabled('default-on-flag', enabledAttributes)).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('fails closed without configuration and does not fetch', async () => {
    const client = createClient({ apiHost: undefined, clientKey: undefined })

    expect(await client.initialize()).toBe(false)
    expect(client.isEnabled('targeted-flag', enabledAttributes)).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it.each([
    'http://growthbook.test',
    'not-a-url',
  ])('fails closed without fetching for invalid API host %s', async (apiHost) => {
    const client = createClient({ apiHost })

    expect(await client.initialize()).toBe(false)
    expect(client.getStatus().configured).toBe(false)
    expect(client.isEnabled('targeted-flag', enabledAttributes)).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
