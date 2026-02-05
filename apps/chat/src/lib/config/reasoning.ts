export const REASONING_EFFORT_OPTIONS = [
  'none',
  'low',
  'medium',
  'high',
] as const

export type ReasoningEffort = (typeof REASONING_EFFORT_OPTIONS)[number]

export const GPT_5_1_MODEL_ID = 'gpt-5.1'

export const supportsReasoningEffort = (modelId: string | null | undefined) =>
  modelId === GPT_5_1_MODEL_ID
