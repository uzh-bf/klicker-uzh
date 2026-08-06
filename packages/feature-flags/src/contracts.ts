export const FEATURE_FLAG_DEFAULTS = {} as const

export type KlickerFeatureFlags = {
  [Key in keyof typeof FEATURE_FLAG_DEFAULTS]: boolean
}

export type FeatureFlagKey = Extract<keyof KlickerFeatureFlags, string>

export type BooleanFeatureFlagKey<Features extends Record<string, unknown>> =
  Extract<
    {
      [Key in keyof Features]: Features[Key] extends boolean ? Key : never
    }[keyof Features],
    string
  >

export type FeatureFlagEnvironment =
  | 'development'
  | 'test'
  | 'staging'
  | 'production'

export type FeatureFlagAttributeValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | null
  | undefined

export type FeatureFlagAttributes = Record<
  string,
  FeatureFlagAttributeValue
> & {
  id?: string
  actorType: 'user' | 'participant' | 'anonymous'
  role?: string
  environment: FeatureFlagEnvironment
}

export function normalizeFeatureFlagEnvironment(
  value?: string
): FeatureFlagEnvironment {
  if (
    value === 'production' ||
    value === 'staging' ||
    value === 'test' ||
    value === 'development'
  ) {
    return value
  }

  return 'development'
}
