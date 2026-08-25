import {
  FEATURE_FLAG_DEFAULTS,
  forcedFeatureFlagPayload,
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

  it('carries catalyst through sanitization', () => {
    expect(
      sanitizeFeatureFlagAttributes(
        { actorType: 'user', catalyst: true, id: 'u1', role: 'USER' },
        'production'
      )
    ).toEqual({
      actorType: 'user',
      catalyst: true,
      environment: 'production',
      id: 'u1',
      role: 'USER',
    })
  })

  // A non-boolean catalyst value must not reach GrowthBook as a truthy
  // attribute: the targeting rule requires catalyst, so anything the sanitizer
  // lets through unchecked would widen exposure rather than narrow it.
  it.each([
    ['true'],
    [1],
    [null],
    [undefined],
  ])('drops the non-boolean catalyst value %p', (catalyst) => {
    const sanitized = sanitizeFeatureFlagAttributes(
      { actorType: 'user', catalyst },
      'production'
    )

    expect(sanitized).not.toHaveProperty('catalyst')
  })

  it.each([
    'development',
    'test',
  ] as const)('forces registered flags on in %s', (environment) => {
    expect(
      forcedFeatureFlagPayload('ai-beta, not-a-flag', environment)
    ).toEqual({
      'ai-beta': { defaultValue: true },
    })
  })

  // The override exists for local development and the end-to-end suite. A
  // deployed environment must never be able to turn a surface on this way,
  // whatever ends up in the variable.
  it.each([
    'staging',
    'production',
    'unknown',
  ] as const)('refuses to force any flag on in %s', (environment) => {
    expect(forcedFeatureFlagPayload('ai-beta', environment)).toEqual({})
  })

  it.each([
    undefined,
    '',
    ' , ',
    'not-a-flag',
    'ai_beta',
  ])('forces nothing on for the unregistered value %p', (value) => {
    expect(forcedFeatureFlagPayload(value, 'development')).toEqual({})
  })
})
