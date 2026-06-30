export type ConfusionSummary = {
  speed: number
  difficulty: number
  numberOfParticipants: number
}

export type AudienceFeedbackResponse = {
  id: number
  content: string
  positiveReactions: number
  negativeReactions: number
  createdAt?: Date | string | null
}

export type AudienceFeedback = {
  id: number
  isPublished: boolean
  isPinned: boolean
  isResolved: boolean
  content: string
  votes: number
  resolvedAt?: Date | string | null
  createdAt: Date | string
  responses?: AudienceFeedbackResponse[] | null
}
