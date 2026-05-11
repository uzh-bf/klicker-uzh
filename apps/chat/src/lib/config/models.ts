import { type ReasoningEffort } from './reasoning'
export type ModelID = string

export interface ModelOption {
  id: ModelID
  name: string
  description: string
  fallback: boolean
  supportsReasoning: boolean
  allowedReasoningEfforts: ReasoningEffort[]
  supportsImageAttachments: boolean
}
