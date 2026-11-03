export const ASYNC_TASK_TRACKED_IDS_LIMIT = 50

export function isAsyncTaskId(value: string) {
  return /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)
}

export const COURSE_DUPLICATION_ERROR_CODES = {
  accessDenied: 'COURSE_DUPLICATION_ACCESS_DENIED',
  failed: 'COURSE_DUPLICATION_FAILED',
  partialFailure: 'COURSE_DUPLICATION_PARTIAL_FAILURE',
  startFailed: 'COURSE_DUPLICATION_START_FAILED',
} as const

export type CourseDuplicationErrorCode =
  (typeof COURSE_DUPLICATION_ERROR_CODES)[keyof typeof COURSE_DUPLICATION_ERROR_CODES]
