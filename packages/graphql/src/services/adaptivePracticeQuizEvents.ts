import * as DB from '@klicker-uzh/prisma/client'

export type AdaptiveOperationalEvent =
  | {
      name: 'adaptive_attempt_lifecycle'
      phase: 'STARTED' | 'COMPLETED' | 'ABANDONED'
      practiceQuizId: string
      courseId: string
      stopReason?: DB.AdaptivePracticeQuizStopReason | null
      answeredQuestions?: number
    }
  | {
      name: 'adaptive_transaction_retry'
      operation: 'ATTEMPT' | 'COHORT_SNAPSHOT' | 'PUBLICATION'
      outcome: 'RETRYING' | 'EXHAUSTED'
      retryNumber: number
    }
  | {
      name: 'adaptive_integrity_rejection'
      reason:
        | 'REPLAYED_RESPONSE'
        | 'STALE_ITEM'
        | 'FOREIGN_ITEM'
        | 'INVALID_POOL_ITEM'
      practiceQuizId: string
      courseId: string
    }
  | {
      name: 'adaptive_publication_blocked'
      practiceQuizId: string
      blockingIssueCount: number
    }
  | {
      name: 'adaptive_sharing_revoked'
      practiceQuizId?: string
      courseId?: string
      affectedObjectCount: number
    }
  | {
      name: 'adaptive_cohort_snapshot'
      outcome: 'CACHE_HIT' | 'GENERATED'
      practiceQuizId: string
      releaseSize: number
      generationDurationMs?: number
    }
  | {
      name: 'adaptive_cohort_snapshot'
      outcome: 'FAILED'
      practiceQuizId: string
      generationDurationMs?: number
    }
  | {
      name: 'adaptive_course_gate'
      action: 'DENIED' | 'ENABLED' | 'DISABLED'
      courseId: string
    }

export function emitAdaptiveOperationalEvent(event: AdaptiveOperationalEvent) {
  const payload = serializeAdaptiveOperationalEvent(event)
  const line = JSON.stringify(payload)
  if (
    (event.name === 'adaptive_transaction_retry' &&
      event.outcome === 'EXHAUSTED') ||
    (event.name === 'adaptive_cohort_snapshot' && event.outcome === 'FAILED')
  ) {
    console.error(line)
  } else if (
    event.name === 'adaptive_integrity_rejection' ||
    event.name === 'adaptive_publication_blocked' ||
    event.name === 'adaptive_sharing_revoked' ||
    (event.name === 'adaptive_course_gate' && event.action === 'DENIED')
  ) {
    console.warn(line)
  } else {
    console.info(line)
  }
}

export function serializeAdaptiveOperationalEvent(
  event: AdaptiveOperationalEvent
): Record<string, string | number | null | undefined> {
  switch (event.name) {
    case 'adaptive_attempt_lifecycle':
      return {
        event: event.name,
        phase: event.phase,
        practiceQuizId: event.practiceQuizId,
        courseId: event.courseId,
        stopReason: event.stopReason,
        answeredQuestions: event.answeredQuestions,
      }
    case 'adaptive_transaction_retry':
      return {
        event: event.name,
        operation: event.operation,
        outcome: event.outcome,
        retryNumber: event.retryNumber,
      }
    case 'adaptive_integrity_rejection':
      return {
        event: event.name,
        reason: event.reason,
        practiceQuizId: event.practiceQuizId,
        courseId: event.courseId,
      }
    case 'adaptive_publication_blocked':
      return {
        event: event.name,
        practiceQuizId: event.practiceQuizId,
        blockingIssueCount: event.blockingIssueCount,
      }
    case 'adaptive_sharing_revoked':
      return {
        event: event.name,
        practiceQuizId: event.practiceQuizId,
        courseId: event.courseId,
        affectedObjectCount: event.affectedObjectCount,
      }
    case 'adaptive_cohort_snapshot':
      return {
        event: event.name,
        outcome: event.outcome,
        practiceQuizId: event.practiceQuizId,
        releaseSize: 'releaseSize' in event ? event.releaseSize : undefined,
        generationDurationMs: event.generationDurationMs,
      }
    case 'adaptive_course_gate':
      return {
        event: event.name,
        action: event.action,
        courseId: event.courseId,
      }
  }
}
