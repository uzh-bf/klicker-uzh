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
      name: 'adaptive_cohort_release_metrics'
      practiceQuizId: string
      releaseSize: number
      classified: number | null
      abstained: number | null
      betweenLevels: number | null
      insufficientEvidence: number | null
      poolLimited: number | null
      researchOnly: number | null
      medianQuestionCount: number | null
      p95QuestionCount: number | null
      maxExposureRate: number | null
    }
  | {
      name: 'adaptive_estimator_failed'
      practiceQuizId: string
      courseId: string
      operation: 'START' | 'ADVANCE'
      estimatorImplementationVersion: string
      reason: 'COMPUTATION_REJECTED'
    }
  | {
      name: 'adaptive_calibration_stale'
      practiceQuizId: string
      staleIssueCount: number
    }
  | {
      name: 'adaptive_calibration_export'
      treeId: string
      scaleVersionId: string
      status: 'REQUESTED' | 'RUNNING' | 'READY' | 'FAILED' | 'EXPIRED'
      queueAgeMs?: number
      processingDurationMs?: number
      failureCode?: string
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
  | {
      name: 'adaptive_irt_shadow_computed'
      publicationId: string
      scaleVersionId: string
      differenceBucket:
        | 'SAME_LEVEL'
        | 'V2_ONE_LEVEL_HIGHER'
        | 'V2_ONE_LEVEL_LOWER'
        | 'V2_AT_LEAST_TWO_LEVELS_HIGHER'
        | 'V2_AT_LEAST_TWO_LEVELS_LOWER'
        | 'V1_UNCLASSIFIED'
        | 'V2_UNCLASSIFIED'
      v1LevelOrder: number | null
      v2LeadingLevelOrder: number | null
    }
  | {
      name: 'adaptive_irt_shadow_failed'
      publicationId: string
      scaleVersionId: string
      reason: 'COMPUTATION_REJECTED'
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
    event.name === 'adaptive_irt_shadow_failed' ||
    event.name === 'adaptive_estimator_failed' ||
    event.name === 'adaptive_calibration_stale' ||
    (event.name === 'adaptive_calibration_export' &&
      event.status === 'FAILED') ||
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
    case 'adaptive_cohort_release_metrics':
      return {
        event: event.name,
        practiceQuizId: event.practiceQuizId,
        releaseSize: event.releaseSize,
        classified: event.classified,
        abstained: event.abstained,
        betweenLevels: event.betweenLevels,
        insufficientEvidence: event.insufficientEvidence,
        poolLimited: event.poolLimited,
        researchOnly: event.researchOnly,
        medianQuestionCount: event.medianQuestionCount,
        p95QuestionCount: event.p95QuestionCount,
        maxExposureRate: event.maxExposureRate,
      }
    case 'adaptive_estimator_failed':
      return {
        event: event.name,
        practiceQuizId: event.practiceQuizId,
        courseId: event.courseId,
        operation: event.operation,
        estimatorImplementationVersion: event.estimatorImplementationVersion,
        reason: event.reason,
      }
    case 'adaptive_calibration_stale':
      return {
        event: event.name,
        practiceQuizId: event.practiceQuizId,
        staleIssueCount: event.staleIssueCount,
      }
    case 'adaptive_calibration_export':
      return {
        event: event.name,
        treeId: event.treeId,
        scaleVersionId: event.scaleVersionId,
        status: event.status,
        queueAgeMs: event.queueAgeMs,
        processingDurationMs: event.processingDurationMs,
        failureCode: event.failureCode,
      }
    case 'adaptive_course_gate':
      return {
        event: event.name,
        action: event.action,
        courseId: event.courseId,
      }
    case 'adaptive_irt_shadow_computed':
      return {
        event: event.name,
        publicationId: event.publicationId,
        scaleVersionId: event.scaleVersionId,
        differenceBucket: event.differenceBucket,
        v1LevelOrder: event.v1LevelOrder,
        v2LeadingLevelOrder: event.v2LeadingLevelOrder,
      }
    case 'adaptive_irt_shadow_failed':
      return {
        event: event.name,
        publicationId: event.publicationId,
        scaleVersionId: event.scaleVersionId,
        reason: event.reason,
      }
  }
}
