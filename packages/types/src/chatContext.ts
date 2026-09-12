export type KlickerChatSurface =
  | 'course-home'
  | 'practice-quiz'
  | 'live-quiz'
  | 'microlearning'

export type KlickerChatContext = {
  version: 1
  source: 'pwa'
  surface: KlickerChatSurface
  locale: string
  courseId: string
  activity?: {
    type: 'practiceQuiz' | 'liveQuiz' | 'microLearning'
    id: string
    displayName?: string
  }
  question?: {
    stackId?: string
    elementInstanceId?: number
    type?: string
    contentPreview?: string
    currentStep?: number
    totalSteps?: number
  }
}

export type KlickerChatContextMessage = {
  type: 'klicker:chat-context'
  payload: KlickerChatContext
  messageId?: number
}

export type KlickerChatContextAckMessage = {
  type: 'klicker:chat-context-ack'
  payload: {
    version: 1
    messageId?: number
  }
}
