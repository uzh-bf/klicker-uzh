export const REASONING_EFFORT_OPTIONS = [
  'none',
  'minimal',
  'low',
  'medium',
  'high',
] as const

export type ReasoningEffort = (typeof REASONING_EFFORT_OPTIONS)[number]
