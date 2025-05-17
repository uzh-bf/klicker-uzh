import { faMessage } from '@fortawesome/free-solid-svg-icons'
import { ObjectType } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useMemo } from 'react'
import { ActivityAction } from './useAvailableActions'

/**
 * A hook that returns an activity log action for activity dropdown menus
 * Can be used across all activity-related components to ensure consistency
 */
function useActivityLogAction({
  objectId,
  objectType,
  setActivityLogOpen,
}: {
  objectId: string | number
  objectType: ObjectType
  setActivityLogOpen: Dispatch<SetStateAction<boolean>>
}): ActivityAction {
  const t = useTranslations()

  return useMemo(() => {
    // Get the display name for the object type
    const objectTypeDisplay = (() => {
      switch (objectType) {
        case ObjectType.Element:
          return t('shared.activity.element')
        case ObjectType.Course:
          return t('shared.activity.course')
        case ObjectType.LiveQuiz:
          return t('shared.activity.liveQuiz')
        case ObjectType.PracticeQuiz:
          return t('shared.activity.practiceQuiz')
        case ObjectType.MicroLearning:
          return t('shared.activity.microLearning')
        case ObjectType.GroupActivity:
          return t('shared.activity.groupActivity')
        case ObjectType.AnswerCollection:
          return t('shared.activity.answerCollection')
        default:
          return objectType
      }
    })()

    return {
      id: 'activityLog',
      label: t('shared.activity.viewActivityLog'),
      icon: faMessage,
      onClick: (e: React.MouseEvent) => {
        if (e) {
          e.stopPropagation()
          e.preventDefault()
        }
        setActivityLogOpen(true)
      },
      data: { cy: `view-activity-log-${objectId}` },
    }
  }, [objectId, objectType, setActivityLogOpen, t])
}

export default useActivityLogAction
