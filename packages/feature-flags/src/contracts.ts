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
  environment: FeatureFlagEnvironment
}

// An absent value is the ordinary local case and stays `development`. A value
// that is present but unrecognized is a deployment misconfiguration, and
// mapping it onto a real environment would apply that environment's targeting
// rules to a build that is not it. `unknown` is deliberately a name no
// GrowthBook environment rule is configured against, so a typo leaves every
// flag on its default instead of silently adopting another tier's rollout.
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
    `[feature-flags] unrecognized environment "${value}"; using "unknown" so that no environment targeting rule matches`
  )

  return 'unknown'
}
