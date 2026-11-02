import builder from '../builder.js'

export const ManageAiCapabilityState = builder.enumType(
  'ManageAiCapabilityState',
  {
    values: {
      ENABLED: { value: 'enabled' },
      DISABLED: { value: 'disabled' },
      TEMPORARILY_UNAVAILABLE: { value: 'temporarilyUnavailable' },
    },
  }
)
