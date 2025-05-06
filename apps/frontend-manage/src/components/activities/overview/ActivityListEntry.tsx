import { faClock, faSquareCheck } from '@fortawesome/free-regular-svg-icons'
import {
  faCheck,
  faFilePen,
  faInfoCircle,
  faPencil,
  faPlay,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ActivityInfo,
  ActivityType,
  PublicationStatus,
} from '@klicker-uzh/graphql/dist/ops'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import LiveQuizNameChangeModal from '~/components/liveQuiz/LiveQuizNameChangeModal'
import ActivityDetailsModal from './ActivityDetailsModal'
import GroupActivityActions from './GroupActivityActions'
import LiveQuizActions from './LiveQuizActions'
import MicrolearningActions from './MicrolearningActions'
import PracticeQuizActions from './PracticeQuizActions'
function ActivityListEntry({
  activity,
  highlighted = false,
}: {
  activity: ActivityInfo
  highlighted?: boolean
}) {
  const t = useTranslations()
  const [showDetails, setShowDetails] = useState<boolean>(false)
  const [changeName, setChangeName] = useState<boolean>(false)

  const publicationStatusMap: Record<PublicationStatus, React.ReactNode> = {
    [PublicationStatus.Draft]: <FontAwesomeIcon icon={faPencil} />,
    [PublicationStatus.Scheduled]: (
      <FontAwesomeIcon icon={faClock} className="h-4 w-4 text-orange-600" />
    ),
    [PublicationStatus.Published]: (
      <FontAwesomeIcon icon={faPlay} className="h-4 w-4 text-green-700" />
    ),
    [PublicationStatus.Ended]: (
      <FontAwesomeIcon icon={faCheck} className="h-4 w-4 text-gray-500" />
    ),
    [PublicationStatus.Graded]: (
      <FontAwesomeIcon icon={faSquareCheck} className="h-4 w-4 text-gray-500" />
    ),
    [PublicationStatus.Template]: (
      <FontAwesomeIcon icon={faFilePen} className="h-4 w-4 text-red-700" />
    ),
  }

  return (
    <>
      <div
        className={twMerge(
          'border-uzh-grey-60 flex flex-row items-center justify-between border-b-2 border-solid px-2 py-2',
          highlighted && 'border-primary-100 border-2 bg-orange-50'
        )}
        data-cy={`activity-${activity.type}-${activity.name}`}
      >
        <div>
          <div className="flex flex-row items-center gap-2.5">
            {publicationStatusMap[activity.status]}
            <div className="font-bold">
              {`${t(`shared.types.${activity.type}`)}: ${activity.name}`}
            </div>

            {activity.status !== PublicationStatus.Template &&
              activity.status !== PublicationStatus.Ended && (
                <FontAwesomeIcon
                  icon={faPencil}
                  size="sm"
                  onClick={() => setChangeName(true)}
                  className="hover:cursor-pointer"
                  data-cy={`change-activity-name-${activity.name}`}
                />
              )}
            <FontAwesomeIcon
              icon={faInfoCircle}
              onClick={() => setShowDetails(true)}
              className="text-uzh-blue-60 h-4 w-4"
              data-cy={`open-activity-details-${activity.name}`}
            />
          </div>
          <div className="ml-[1.65rem] text-sm text-gray-500">
            {activity.type === ActivityType.LiveQuiz
              ? t('manage.activities.liveQuizInfo', {
                  numOfBlocks: activity.numOfStacks,
                  numOfElements: activity.numOfElements,
                })
              : t('manage.activities.activityInfo', {
                  numOfStacks: activity.numOfStacks,
                  numOfElements: activity.numOfElements,
                })}
          </div>
          <div className="ml-[1.65rem] text-sm text-gray-500">
            {t('manage.activities.lastModifiedAt', {
              date: dayjs(activity.updatedAt).format('DD.MM.YYYY HH:mm'),
            })}
          </div>
        </div>
        {activity.type === ActivityType.LiveQuiz ? (
          <LiveQuizActions quiz={activity} />
        ) : null}
        {activity.type === ActivityType.PracticeQuiz ? (
          <PracticeQuizActions />
        ) : null}
        {activity.type === ActivityType.MicroLearning ? (
          <MicrolearningActions />
        ) : null}
        {activity.type === ActivityType.GroupActivity ? (
          <GroupActivityActions />
        ) : null}
      </div>
      <ActivityDetailsModal
        activity={activity}
        open={showDetails}
        onClose={() => setShowDetails(false)}
      />
      {/* // TODO: once the activity overview is available for all activities, extend this modal accordingly */}
      <LiveQuizNameChangeModal
        quizId={activity.id}
        name={activity.name}
        displayName={activity.displayName}
        open={changeName}
        setOpen={setChangeName}
      />
    </>
  )
}

export default ActivityListEntry
