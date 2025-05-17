import { faMessage } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ObjectType } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useMemo } from 'react'

/**
 * A hook that returns an activity log action item for dropdown menus
 * Can be used across all components with dropdown menus to ensure consistency
 */
function useActivityLogAction({
  objectId,
  objectType,
  setActivityLogOpen,
}: {
  objectId: string | number
  objectType: ObjectType
  setActivityLogOpen: Dispatch<SetStateAction<boolean>>
}) {
  const t = useTranslations()

  return useMemo(() => {
    // Get a display name for the object type
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
      id: 'activity-log',
      label: (
        <div className="flex cursor-pointer items-center rounded px-1.5 py-0.5 hover:bg-gray-100">
          <FontAwesomeIcon icon={faMessage} className="mr-2.5 h-4 w-4" />
          {t('shared.activity.viewActivityLog')}
        </div>
      ),
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