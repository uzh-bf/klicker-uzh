export const COURSE_DUPLICATION_STATUS_KEY_PREFIX = 'course-duplication:job'

// Pending Hatchet runs may wait up to 60 minutes for the task-local concurrency
// slot. The extra 15 minutes allow cancellation and the five-minute sweep to
// settle. A running attempt refreshes its task when it starts.
export const COURSE_DUPLICATION_STALE_AFTER_MS = 75 * 60 * 1000

export function getCourseDuplicationStatusKey(jobId: string) {
  return `${COURSE_DUPLICATION_STATUS_KEY_PREFIX}:${jobId}`
}
