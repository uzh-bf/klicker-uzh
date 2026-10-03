import {
  evaluateFeatureFlags,
  FEATURE_FLAG_DEFAULTS,
  type FeatureFlagAttributes,
  normalizeFeatureFlagEnvironment,
  sanitizeFeatureFlagAttributes,
} from '../src/index.js'

describe('feature flag contracts', () => {
  it('registers product flags with fail-closed defaults', () => {
    expect(FEATURE_FLAG_DEFAULTS).toEqual({
      'ai-beta': false,
      'learning-analytics': false,
    })
  })

  it('sanitizes betaEnabled as an optional boolean attribute', () => {
    const enabledAttributes: FeatureFlagAttributes = {
      actorType: 'user',
      betaEnabled: true,
    }
    const disabledAttributes: FeatureFlagAttributes = {
      actorType: 'user',
      betaEnabled: false,
    }

    expect(
      sanitizeFeatureFlagAttributes(enabledAttributes, 'test')
    ).toMatchObject({
      actorType: 'user',
      betaEnabled: true,
      environment: 'test',
    })
    expect(
      sanitizeFeatureFlagAttributes(disabledAttributes, 'test')
    ).toMatchObject({ betaEnabled: false })
    expect(
      sanitizeFeatureFlagAttributes(
        { actorType: 'user', betaEnabled: 'true' },
        'test'
      )
    ).not.toHaveProperty('betaEnabled')
    expect(
      sanitizeFeatureFlagAttributes({ actorType: 'user' }, 'test')
    ).not.toHaveProperty('betaEnabled')
  })

  it.each([
    ['production', 'production'],
    ['staging', 'staging'],
    ['test', 'test'],
    ['development', 'development'],
    [undefined, 'development'],
    ['', 'development'],
  ] as const)('normalizes %s to %s', (input, expected) => {
    expect(normalizeFeatureFlagEnvironment(input)).toBe(expected)
  })

  it.each([
    'unexpected',
    'prod',
    'Production',
    'stg',
  ])('refuses to map the unrecognized environment %s onto a real one', (input) => {
    const reportedErrors = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    expect(normalizeFeatureFlagEnvironment(input)).toBe('unknown')
    expect(reportedErrors).toHaveBeenCalledOnce()

    reportedErrors.mockRestore()
  })
})

describe('evaluateFeatureFlags', () => {
  it('asks the client once per key and keeps the answers keyed', () => {
    const isOn = vi.fn((key: string) => key === 'learning-analytics')

    expect(evaluateFeatureFlags({ isOn }, ['learning-analytics'])).toEqual({
      'learning-analytics': true,
    })
    expect(isOn).toHaveBeenCalledExactlyOnceWith('learning-analytics')
  })

  it('returns an empty evaluation without touching the client for no keys', () => {
    const isOn = vi.fn(() => true)

    expect(evaluateFeatureFlags({ isOn }, [])).toEqual({})
    expect(isOn).not.toHaveBeenCalled()
  })
})
