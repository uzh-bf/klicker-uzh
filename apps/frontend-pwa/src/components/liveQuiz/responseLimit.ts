// mirrors the server-side bound for free-text response limits
const MAX_RESPONSE_LIMIT = 10

interface ResponseLimitInstance {
  elementData: {
    __typename?: string
    options?: unknown
  }
}

// Number of responses a participant may submit to a live quiz element. Only
// free-text elements in standard live quizzes accept more than one response;
// assessment live quizzes always accept a single response.
export function getEffectiveResponseLimit({
  instance,
  isAssessmentEnabled,
}: {
  instance?: ResponseLimitInstance | null
  isAssessmentEnabled: boolean
}): number {
  if (
    isAssessmentEnabled ||
    instance?.elementData.__typename !== 'FreeTextElementData'
  ) {
    return 1
  }

  const options = instance.elementData.options as
    | { responseLimit?: number | null }
    | null
    | undefined
  const limit = options?.responseLimit
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1) {
    return 1
  }
  return Math.min(limit, MAX_RESPONSE_LIMIT)
}
