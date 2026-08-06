import {
  FEATURE_FLAG_DEFAULTS,
  normalizeFeatureFlagEnvironment,
} from '../src/index.js'

describe('feature flag contracts', () => {
  it('starts without active product flags', () => {
    expect(FEATURE_FLAG_DEFAULTS).toEqual({})
  })

  it.each([
    ['production', 'production'],
    ['staging', 'staging'],
    ['test', 'test'],
    ['development', 'development'],
    [undefined, 'development'],
    ['unexpected', 'development'],
  ] as const)('normalizes %s to %s', (input, expected) => {
    expect(normalizeFeatureFlagEnvironment(input)).toBe(expected)
  })
})
