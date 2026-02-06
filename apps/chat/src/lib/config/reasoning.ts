export const REASONING_EFFORT_OPTIONS = [
  'none',
  'low',
  'medium',
  'high',
] as const

export type ReasoningEffort = (typeof REASONING_EFFORT_OPTIONS)[number]
