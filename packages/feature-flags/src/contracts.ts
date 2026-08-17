// Every registry default must be `false`. Evaluation goes through GrowthBook's
// own unknown-feature fallback, which is `false`, so this object is never read
// at runtime; constraining it to `false` keeps the two in agreement instead of
// letting a `true` here advertise a fallback the evaluation path cannot honor.
export const FEATURE_FLAG_DEFAULTS = {} as const satisfies Record<string, false>

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
  | 'unknown'

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
}

// An absent value is the ordinary local case and stays `development`. A value
// that is present but unrecognized is a deployment misconfiguration. Both
// adapters treat `unknown` as unconfigured and initialize an empty payload, so
// no targeting rule or remote default can enable a flag for that deployment.
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

  if (value === undefined || value === '') {
    return 'development'
  }

  console.error(
    `[feature-flags] unrecognized environment "${value}"; disabling feature flag evaluation`
  )

  return 'unknown'
}
