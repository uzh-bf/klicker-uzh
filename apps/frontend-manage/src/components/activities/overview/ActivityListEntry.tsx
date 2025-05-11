import { faClock, faSquareCheck } from '@fortawesome/free-regular-svg-icons'
import {
  faCheck,
  faFilePen,
  faPencil,
  faPlay,
  faUserGroup,
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
import ActivityNameChangeModal from '../../courses/actions/ActivityNameChangeModal'
import ObjectPermissionLevel from '../../sharing/ObjectPermissionLevel'
import ActivityDetailsModal from './ActivityDetailsModal'
import GroupActivityActions from './GroupActivityActions'
import LiveQuizActions from './LiveQuizActions'
import MicrolearningActions from './MicrolearningActions'
import PracticeQuizActions from './PracticeQuizActions'

function ActivityListEntry({
  activity,
  highlighted = false,
  hideType = false,
}: {
  activity: ActivityInfo
  highlighted?: boolean
  hideType?: boolean
}) {
  const t = useTranslations()
  const [showDetails, setShowDetails] = useState<boolean>(false)
  const [changeName, setChangeName] = useState<boolean>(false)

  const publicationStatusMap: Record<PublicationStatus, React.ReactNode> = {
    [PublicationStatus.Draft]: (
      <FontAwesomeIcon
        icon={faPencil}
        data-cy={`status-${activity.name}-${PublicationStatus.Draft}`}
      />
    ),
    [PublicationStatus.Scheduled]: (
      <FontAwesomeIcon
        icon={faClock}
        className="h-4 w-4 text-orange-600"
        data-cy={`status-${activity.name}-${PublicationStatus.Scheduled}`}
      />
    ),
    [PublicationStatus.Published]: (
      <FontAwesomeIcon
        icon={faPlay}
        className="h-4 w-4 text-green-700"
        data-cy={`status-${activity.name}-${PublicationStatus.Published}`}
      />
    ),
    [PublicationStatus.Ended]: (
      <FontAwesomeIcon
        icon={faCheck}
        className="h-4 w-4 text-gray-500"
        data-cy={`status-${activity.name}-${PublicationStatus.Ended}`}
      />
    ),
    [PublicationStatus.Graded]: (
      <FontAwesomeIcon
        icon={faSquareCheck}
        className="h-4 w-4 text-gray-500"
        data-cy={`status-${activity.name}-${PublicationStatus.Graded}`}
      />
    ),
    [PublicationStatus.Template]: (
      <FontAwesomeIcon
        icon={faFilePen}
        className="h-4 w-4 text-red-700"
        data-cy={`status-${activity.name}-${PublicationStatus.Template}`}
      />
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
            <div
              className="hover:text-uzh-blue-100 font-bold hover:cursor-pointer"
              onClick={() => setShowDetails(true)}
              data-cy={`activity-name-${activity.name}`}
            >
              {hideType
                ? activity.name
                : `${t(`shared.types.${activity.type}`)}: ${activity.name}`}
            </div>

            {activity.status !== PublicationStatus.Template &&
              activity.status !== PublicationStatus.Ended &&
              activity.isEditor && (
                <FontAwesomeIcon
                  icon={faPencil}
                  size="sm"
                  onClick={() => setChangeName(true)}
                  className="hover:cursor-pointer"
                  data-cy={`change-activity-name-${activity.name}`}
                />
              )}

            <ObjectPermissionLevel
              objectName={activity.name}
              permissionLevel={activity.permissionLevel}
              className="px-0.5"
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

        <div className="flex flex-row items-center gap-4">
          {activity.numSharedUsers && activity.isManager ? (
            <div className="flex h-max flex-row items-center gap-1.5 py-1">
              <div>{activity.numSharedUsers}</div>
              <FontAwesomeIcon icon={faUserGroup} className="h-4 w-4" />
            </div>
          ) : null}
          {activity.type === ActivityType.LiveQuiz ? (
            <LiveQuizActions liveQuiz={activity} />
          ) : null}
          {activity.type === ActivityType.PracticeQuiz ? (
            <PracticeQuizActions practiceQuiz={activity} />
          ) : null}
          {activity.type === ActivityType.MicroLearning ? (
            <MicrolearningActions microLearning={activity} />
          ) : null}
          {activity.type === ActivityType.GroupActivity ? (
            <GroupActivityActions groupActivity={activity} />
          ) : null}
        </div>
      </div>
      <ActivityDetailsModal
        activity={activity}
        open={showDetails}
        onClose={() => setShowDetails(false)}
      />
      <ActivityNameChangeModal
        id={activity.id}
        name={activity.name}
        type={activity.type}
        displayName={activity.displayName}
        open={changeName}
        setOpen={setChangeName}
      />
    </>
  )
}

export default ActivityListEntry
