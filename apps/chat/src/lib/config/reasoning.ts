export const REASONING_EFFORT_OPTIONS = [
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
] as const

export type ReasoningEffort = (typeof REASONING_EFFORT_OPTIONS)[number]
