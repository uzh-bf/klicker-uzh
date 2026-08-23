// Every registry default must be `false`. Evaluation goes through GrowthBook's
// own unknown-feature fallback, which is `false`, so this object is never read
// at runtime; constraining it to `false` keeps the two in agreement instead of
// letting a `true` here advertise a fallback the evaluation path cannot honor.
export const FEATURE_FLAG_DEFAULTS = {
  // The one switch over everything the AI beta adds for lecturers: the
  // assistant launcher inside Manage, the assistant's own page in chat, the
  // API routes behind it, the lecturer MCP tools it is given, and the
  // confirmation route that redeems the proposals those tools produce. They
  // move together on purpose — a surface withdrawn while the tools behind it
  // stay live is a gap, not a finer control.
  'ai-beta': false,
} as const satisfies Record<string, false>

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
  // Whether the lecturer holds Catalyst, institutionally or individually.
  // The beta targeting rule requires it alongside saved-group membership, so
  // a rule can never grant a surface to an account without it.
  catalyst?: boolean
}

export type FeatureFlagEvaluationAttributes = FeatureFlagAttributes & {
  environment: FeatureFlagEnvironment
}

export function sanitizeFeatureFlagAttributes(
  attributes: unknown,
  environment: FeatureFlagEnvironment
): FeatureFlagEvaluationAttributes {
  const source =
    typeof attributes === 'object' && attributes !== null
      ? (attributes as Record<string, unknown>)
      : {}
  const actorType =
    source.actorType === 'user' ||
    source.actorType === 'participant' ||
    source.actorType === 'anonymous'
      ? source.actorType
      : 'anonymous'
  const sanitized: FeatureFlagEvaluationAttributes = {
    actorType,
    environment,
  }

  if (typeof source.id === 'string') sanitized.id = source.id
  if (typeof source.role === 'string') sanitized.role = source.role
  if (typeof source.catalyst === 'boolean') sanitized.catalyst = source.catalyst
  return sanitized
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

// An escape hatch for environments that have no GrowthBook to talk to: local
// development and the end-to-end suite, where the alternative is either
// shipping a second gate per surface or leaving the enabled path untested.
// Honored only when the environment is `development` or `test` and only when
// no SDK connection is configured, so the value is inert in a staging or
// production build even if one is set there by mistake. Unregistered keys are
// dropped rather than invented, so a typo turns nothing on.
export function forcedFeatureFlagPayload(
  value: string | undefined,
  environment: FeatureFlagEnvironment
): Record<string, { defaultValue: boolean }> {
  if (environment !== 'development' && environment !== 'test') return {}

  const registered = new Set<string>(Object.keys(FEATURE_FLAG_DEFAULTS))
  const forced = (value ?? '')
    .split(',')
    .map((key) => key.trim())
    .filter((key) => registered.has(key))

  return Object.fromEntries(forced.map((key) => [key, { defaultValue: true }]))
}
