import { ActivityType, ElementType } from '@klicker-uzh/graphql/dist/ops'

const PRACTICE_AND_MICROLEARNING_TYPES = [
  ElementType.Sc,
  ElementType.Mc,
  ElementType.Kprim,
  ElementType.Numerical,
  ElementType.FreeText,
  ElementType.Flashcard,
  ElementType.Content,
  ElementType.Selection,
  ElementType.CaseStudy,
]

const GROUP_AND_LIVE_TYPES = [
  ElementType.Sc,
  ElementType.Mc,
  ElementType.Kprim,
  ElementType.Numerical,
  ElementType.FreeText,
  ElementType.Content,
  ElementType.Selection,
  ElementType.CaseStudy,
]

export const activityAcceptedElementTypes: Record<ActivityType, ElementType[]> =
  {
    [ActivityType.PracticeQuiz]: PRACTICE_AND_MICROLEARNING_TYPES,
    [ActivityType.MicroLearning]: PRACTICE_AND_MICROLEARNING_TYPES,
    [ActivityType.GroupActivity]: GROUP_AND_LIVE_TYPES,
    [ActivityType.LiveQuiz]: GROUP_AND_LIVE_TYPES,
  }

export function getActivityAcceptedElementTypes(
  activityType: ActivityType
): ElementType[] {
  return activityAcceptedElementTypes[activityType]
}
