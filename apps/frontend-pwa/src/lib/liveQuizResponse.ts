import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import { QUESTION_GROUPS } from '@klicker-uzh/shared-components/src/constants'

export function buildLiveQuizResponsePayload({
  correlationKey,
  instanceId,
  liveQuizId,
  type,
  answer,
}: {
  correlationKey?: string | null
  instanceId: number
  liveQuizId: string
  type: ElementType
  answer: unknown
}) {
  const common = { correlationKey, instanceId, liveQuizId }
  if (QUESTION_GROUPS.CHOICES.includes(type)) {
    return { ...common, response: { choices: answer } }
  }
  if (
    QUESTION_GROUPS.NUMERICAL.includes(type) ||
    QUESTION_GROUPS.FREE_TEXT.includes(type) ||
    type === ElementType.QrScan
  ) {
    return { ...common, response: { value: answer } }
  }
  if (type === ElementType.Selection) {
    return { ...common, response: { selection: answer } }
  }
  if (type === ElementType.CaseStudy) {
    return { ...common, response: { assessment: answer } }
  }
  if (type === ElementType.Content) {
    return { ...common, response: { viewed: true } }
  }
  return null
}
