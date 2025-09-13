import type { AuditEvent } from '@klicker-uzh/types'
import { createHash } from 'crypto'

/**
 * Audit Event Types - Organized by priority and category
 */

// Priority P0: Critical Events
export const AUDIT_EVENTS = {
  // Authentication Events
  AUTH_PIN_VALIDATION_SUCCESS: 'auth.pin.validation.success',
  AUTH_PIN_VALIDATION_FAILED: 'auth.pin.validation.failed',
  AUTH_COURSE_PIN_ENROLLMENT_SUCCESS: 'course.pin.enrollment.success',
  AUTH_COURSE_PIN_ENROLLMENT_FAILED: 'course.pin.enrollment.failed',

  // Response Events
  PARTICIPANT_CHANGE_ANSWER: 'participant.change_answer',
  PARTICIPANT_SUBMIT_RESPONSE: 'participant.submit_response',
  RESPONSE_SAVED_SUCCESS: 'response.saved_success',
  RESPONSE_SAVE_FAILED: 'response.save_failed',
  RESPONSE_VALIDATION_ERROR: 'response.validation_error',

  // System Events
  PARTICIPANT_CLIENT_ERROR: 'participant.client_error',
  PARTICIPANT_NETWORK_ERROR: 'participant.network_error',
  API_ERROR: 'api.error',
  DATABASE_ERROR: 'database.error',

  // Session Events
  PARTICIPANT_JOIN_QUIZ: 'participant.join_quiz',
  PARTICIPANT_VIEW_QUESTION: 'participant.view_question',
  SESSION_EXPIRED: 'session.expired',

  // Lecturer Control
  LECTURER_START_ASSESSMENT: 'lecturer.start_assessment',
  LECTURER_END_ASSESSMENT: 'lecturer.end_assessment',
  LECTURER_OPEN_BLOCK: 'lecturer.open_block',
  LECTURER_CLOSE_BLOCK: 'lecturer.close_block',

  // Security Events
  MULTIPLE_TABS_DETECTED: 'security.multiple_tabs',
  BROWSER_FOCUS_LOST: 'security.focus_lost',
  IP_LOCATION_CHANGE: 'security.ip_change',
} as const

export type AuditEventType = (typeof AUDIT_EVENTS)[keyof typeof AUDIT_EVENTS]

/**
 * Audit Event Priority Levels
 */
export const EVENT_PRIORITIES = {
  P0: 'P0', // Critical - Essential for operations & student trust
  P1: 'P1', // High - Important for support & analysis
  P2: 'P2', // Medium - Useful for analytics & optimization
  P3: 'P3', // Low - Nice to have for enhanced analytics
} as const

/**
 * Event Priority Mapping
 */
export const EVENT_PRIORITY_MAP: Record<string, keyof typeof EVENT_PRIORITIES> =
  {
    // P0 Critical Events
    [AUDIT_EVENTS.AUTH_PIN_VALIDATION_SUCCESS]: 'P0',
    [AUDIT_EVENTS.AUTH_PIN_VALIDATION_FAILED]: 'P0',
    [AUDIT_EVENTS.AUTH_COURSE_PIN_ENROLLMENT_SUCCESS]: 'P0',
    [AUDIT_EVENTS.AUTH_COURSE_PIN_ENROLLMENT_FAILED]: 'P0',
    [AUDIT_EVENTS.PARTICIPANT_CHANGE_ANSWER]: 'P0',
    [AUDIT_EVENTS.PARTICIPANT_SUBMIT_RESPONSE]: 'P0',
    [AUDIT_EVENTS.RESPONSE_SAVED_SUCCESS]: 'P0',
    [AUDIT_EVENTS.RESPONSE_SAVE_FAILED]: 'P0',
    [AUDIT_EVENTS.RESPONSE_VALIDATION_ERROR]: 'P0',
    [AUDIT_EVENTS.PARTICIPANT_CLIENT_ERROR]: 'P0',
    [AUDIT_EVENTS.SESSION_EXPIRED]: 'P0',

    // P1 High Events
    [AUDIT_EVENTS.PARTICIPANT_JOIN_QUIZ]: 'P1',
    [AUDIT_EVENTS.PARTICIPANT_VIEW_QUESTION]: 'P1',
    [AUDIT_EVENTS.LECTURER_START_ASSESSMENT]: 'P1',
    [AUDIT_EVENTS.LECTURER_END_ASSESSMENT]: 'P1',
    [AUDIT_EVENTS.LECTURER_OPEN_BLOCK]: 'P1',
    [AUDIT_EVENTS.LECTURER_CLOSE_BLOCK]: 'P1',
    [AUDIT_EVENTS.MULTIPLE_TABS_DETECTED]: 'P1',
    [AUDIT_EVENTS.BROWSER_FOCUS_LOST]: 'P1',
    [AUDIT_EVENTS.IP_LOCATION_CHANGE]: 'P1',

    // P2 Medium Events
    [AUDIT_EVENTS.PARTICIPANT_NETWORK_ERROR]: 'P2',
    [AUDIT_EVENTS.API_ERROR]: 'P2',
    [AUDIT_EVENTS.DATABASE_ERROR]: 'P2',
  }

/**
 * Helper function to generate a secure hash for sensitive data like PINs
 */
export function hashSensitiveData(data: string | number): string {
  return createHash('sha256').update(String(data)).digest('hex')
}

/**
 * Helper function to create PIN validation success audit event
 */
export function createPinValidationSuccessEvent(
  subject: string,
  sessionId: string,
  liveQuizId: string,
  pinHash: string,
  metadata?: any
): Omit<AuditEvent, 'timestamp'> {
  return {
    subject,
    action: AUDIT_EVENTS.AUTH_PIN_VALIDATION_SUCCESS,
    sessionId,
    resourceId: liveQuizId,
    attributes: {
      liveQuizId,
      pinHash,
      method: 'pin_validation',
      ...metadata,
    },
  }
}

/**
 * Helper function to create PIN validation failed audit event
 */
export function createPinValidationFailedEvent(
  subject: string,
  sessionId: string,
  liveQuizId: string,
  attemptedPinHash: string,
  reason: string,
  metadata?: any
): Omit<AuditEvent, 'timestamp'> {
  return {
    subject,
    action: AUDIT_EVENTS.AUTH_PIN_VALIDATION_FAILED,
    sessionId,
    resourceId: liveQuizId,
    attributes: {
      liveQuizId,
      attemptedPinHash,
      reason,
      method: 'pin_validation',
      ...metadata,
    },
  }
}

/**
 * Helper function to create course enrollment success audit event
 */
export function createCourseEnrollmentSuccessEvent(
  participantId: string,
  courseId: string,
  pinHash: string,
  metadata?: any
): Omit<AuditEvent, 'timestamp'> {
  return {
    subject: `participant:${participantId}`,
    action: AUDIT_EVENTS.AUTH_COURSE_PIN_ENROLLMENT_SUCCESS,
    resourceId: courseId,
    userId: participantId,
    attributes: {
      courseId,
      pinHash,
      method: 'pin_enrollment',
      ...metadata,
    },
  }
}

/**
 * Helper function to create course enrollment failed audit event
 */
export function createCourseEnrollmentFailedEvent(
  subject: string,
  attemptedPinHash: string,
  reason: string,
  metadata?: any
): Omit<AuditEvent, 'timestamp'> {
  return {
    subject,
    action: AUDIT_EVENTS.AUTH_COURSE_PIN_ENROLLMENT_FAILED,
    attributes: {
      attemptedPinHash,
      reason,
      method: 'pin_enrollment',
      ...metadata,
    },
  }
}

/**
 * Helper function to create answer change audit event
 */
export function createAnswerChangeEvent(
  participantId: string,
  sessionId: string,
  quizId: string,
  questionId: string,
  questionType: string,
  currentAnswer: any,
  previousAnswer?: any,
  metadata?: any
): Omit<AuditEvent, 'timestamp'> {
  return {
    subject: `participant:${participantId}`,
    action: AUDIT_EVENTS.PARTICIPANT_CHANGE_ANSWER,
    sessionId,
    resourceId: questionId,
    userId: participantId,
    attributes: {
      quizId,
      questionId,
      questionType,
      currentAnswer,
      previousAnswer,
      changeData: {
        quizId,
        questionId,
        questionType,
        previousAnswer,
        currentAnswer,
        ...metadata,
      },
    },
  }
}

/**
 * Helper function to create response submission audit event
 */
export function createResponseSubmissionEvent(
  participantId: string,
  sessionId: string,
  requestId: string,
  quizId: string,
  questionId: string,
  answer: any,
  submissionType: 'manual' | 'auto' | 'timeout' | 'forced',
  metadata?: any
): Omit<AuditEvent, 'timestamp'> {
  const answerHash = hashSensitiveData(JSON.stringify(answer))

  return {
    subject: `participant:${participantId}`,
    action: AUDIT_EVENTS.PARTICIPANT_SUBMIT_RESPONSE,
    sessionId,
    resourceId: questionId,
    userId: participantId,
    attributes: {
      quizId,
      questionId,
      requestId,
      answerHash,
      submissionType,
      submissionData: {
        quizId,
        questionId,
        answerHash,
        submissionType,
        clientTimestamp: new Date(),
        ...metadata,
      },
    },
  }
}

/**
 * Helper function to create response save success audit event
 */
export function createResponseSaveSuccessEvent(
  participantId: string,
  sessionId: string,
  requestId: string,
  quizId: string,
  questionId: string,
  recordId: string,
  metadata?: any
): Omit<AuditEvent, 'timestamp'> {
  return {
    subject: `participant:${participantId}`,
    action: AUDIT_EVENTS.RESPONSE_SAVED_SUCCESS,
    sessionId,
    resourceId: questionId,
    userId: participantId,
    attributes: {
      quizId,
      questionId,
      requestId,
      recordId,
      saveData: {
        quizId,
        questionId,
        recordId,
        ...metadata,
      },
    },
  }
}

/**
 * Helper function to create response save failed audit event
 */
export function createResponseSaveFailedEvent(
  participantId: string,
  sessionId: string,
  requestId: string,
  quizId: string,
  questionId: string,
  error: string,
  errorCategory: string,
  metadata?: any
): Omit<AuditEvent, 'timestamp'> {
  return {
    subject: `participant:${participantId}`,
    action: AUDIT_EVENTS.RESPONSE_SAVE_FAILED,
    sessionId,
    resourceId: questionId,
    userId: participantId,
    attributes: {
      quizId,
      questionId,
      requestId,
      error,
      errorCategory,
      failureData: {
        quizId,
        questionId,
        errorMessage: error,
        errorCategory,
        ...metadata,
      },
    },
  }
}

/**
 * Helper function to create client error audit event
 */
export function createClientErrorEvent(
  participantId: string,
  sessionId: string,
  error: Error,
  context: any,
  severity: 'critical' | 'high' | 'medium' | 'low' = 'medium',
  metadata?: any
): Omit<AuditEvent, 'timestamp'> {
  return {
    subject: `participant:${participantId}`,
    action: AUDIT_EVENTS.PARTICIPANT_CLIENT_ERROR,
    sessionId,
    userId: participantId,
    attributes: {
      errorData: {
        category: 'javascript',
        severity,
        message: error.message,
        stack: error.stack || '',
        context,
        ...metadata,
      },
    },
  }
}

/**
 * Generate a unique request ID for tracking requests across systems
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Get priority for an audit event type
 */
export function getEventPriority(
  eventType: string
): keyof typeof EVENT_PRIORITIES {
  return EVENT_PRIORITY_MAP[eventType] || 'P2'
}

/**
 * Check if an event type is critical (P0)
 */
export function isCriticalEvent(eventType: string): boolean {
  return getEventPriority(eventType) === 'P0'
}
