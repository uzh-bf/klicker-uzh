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

// ---------------------------------------------------------------------------
// eLearning contextual chat (v1 contract)
//
// The `envelope` is a short-lived, server-signed JWT minted by the eLearning
// server. Hosts and chat clients must treat it as opaque: only the chat API
// verifies it (signature, expiry, course/chatbot binding and learner binding).
// `displayTitle` is a composer chip label and is never evidence.
// ---------------------------------------------------------------------------

// Bounded shared contract limits (mirrored by verification in @klicker-uzh/util).
export const ELEARNING_SNAPSHOT_EXCERPT_MAX_LENGTH = 6000
export const ELEARNING_SNAPSHOT_OUTLINE_MAX_ITEMS = 30

export type ELearningMaterialAvailability =
  | 'full-text'
  | 'metadata'
  | 'unavailable'
  | 'unknown'

export type ELearningSnapshotSurface = 'course' | 'module' | 'unit' | 'block'

export type ELearningSnapshotLocation = {
  surface: ELearningSnapshotSurface
  elearningCourseId?: string
  moduleId?: string
  unitId?: string
  blockIdent?: string
  blockType?: string
  title?: string
  labels?: {
    course?: string
    module?: string
    unit?: string
    block?: string
  }
  deepLink?: string
}

export type ELearningSnapshotMaterial = {
  title?: string
  blockType?: string
  blockIdent?: string
  availability: ELearningMaterialAvailability
  excerpt?: string
  excerptTruncated?: boolean
  revision?: string
}

export type ELearningCompletionState =
  | 'confirmed_complete'
  | 'pending'
  | 'incomplete'
  | 'unavailable'

export type ELearningOutlineItem = {
  ident: string
  title?: string
  blockType?: string
  availability: ELearningMaterialAvailability
  completion: ELearningCompletionState
}

export type ELearningSnapshotCompletion = {
  unitState: ELearningCompletionState
  completedBlocks?: number
  totalBlocks?: number
  observedAt?: string
}

export type ELearningSnapshotContent = {
  snapshotId: string
  observedAt: string
  locale: string
  location: ELearningSnapshotLocation
  material: ELearningSnapshotMaterial
  outline?: ELearningOutlineItem[]
  completion?: ELearningSnapshotCompletion
}

export type ELearningChatContext = {
  version: 1
  source: 'elearning'
  locale: string
  envelope: string
  displayTitle?: string
}

export type ELearningChatContextMessage = {
  type: 'elearning:chat-context'
  payload: ELearningChatContext
  messageId?: number
}

export type ELearningChatContextAckMessage = {
  type: 'elearning:chat-context-ack'
  payload: {
    version: 1
    messageId?: number
  }
}

// Either variant must remain distinguishable by its `source` value.
export type KlickerChatContextV2 = KlickerChatContext | ELearningChatContext
