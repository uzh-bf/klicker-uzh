import {
  faCheckCircle,
  faClock,
  faPenToSquare,
} from '@fortawesome/free-regular-svg-icons'
import {
  faFilePen,
  faPencil,
  faPlay,
  faStamp,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ActivityInfo,
  ActivityType,
  ObjectType,
  PublicationStatus,
} from '@klicker-uzh/graphql/dist/ops'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import ActivityNameChangeModal from '../../courses/actions/ActivityNameChangeModal'
import ActivityLogDialog from '../../sharing/ActivityLogDialog'
import ObjectPermissionLevel from '../../sharing/ObjectPermissionLevel'
import SharingTypeBadge from '../../sharing/SharingTypeBadge'
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
  const [sharingModal, setSharingModal] = useState<boolean>(false)
  const [isActivityLogOpen, setActivityLogOpen] = useState<boolean>(false)

  const publicationStatusMap: Record<PublicationStatus, React.ReactNode> = {
    [PublicationStatus.Draft]: (
      <FontAwesomeIcon
        icon={faPenToSquare}
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
        icon={faCheckCircle}
        className="h-4 w-4 text-gray-500"
        data-cy={`status-${activity.name}-${PublicationStatus.Ended}`}
      />
    ),
    [PublicationStatus.Graded]: (
      <FontAwesomeIcon
        icon={faStamp}
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
          'border-uzh-grey-60 flex flex-row items-center justify-between rounded-md border border-solid px-4 py-3 shadow-sm transition-all hover:shadow-md',
          highlighted && 'border-primary-100 bg-orange-50'
        )}
        data-cy={`activity-${activity.type}-${activity.name}`}
      >
        <div className="flex-1">
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
              activity.status !== PublicationStatus.Graded &&
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
          <div className="flex h-[1.4rem] flex-row items-center gap-4 text-gray-500">
            <div className="ml-[1.65rem] text-sm">
              {t('manage.activities.lastModifiedAt', {
                date: dayjs(activity.updatedAt).format('DD.MM.YYYY HH:mm'),
              })}
            </div>
            <SharingTypeBadge
              sharingType={activity.sharingType}
              className={{ root: 'text-sm' }}
            />
          </div>
        </div>

        <div className="flex flex-row items-center gap-4">
          {activity.numSharedUsers && activity.isManager ? (
            <div
              className="hover:text-primary-100 flex h-max flex-row items-center gap-1.5 py-1 text-gray-600 hover:cursor-pointer"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setSharingModal(true)
              }}
            >
              <div>{activity.numSharedUsers}</div>
              <FontAwesomeIcon icon={faUserGroup} className="h-4 w-4" />
            </div>
          ) : null}

          {activity.type === ActivityType.LiveQuiz ? (
            <LiveQuizActions
              liveQuiz={activity}
              sharingModal={sharingModal}
              setSharingModal={setSharingModal}
            />
          ) : null}
          {activity.type === ActivityType.PracticeQuiz ? (
            <PracticeQuizActions
              practiceQuiz={activity}
              sharingModal={sharingModal}
              setSharingModal={setSharingModal}
            />
          ) : null}
          {activity.type === ActivityType.MicroLearning ? (
            <MicrolearningActions
              microLearning={activity}
              sharingModal={sharingModal}
              setSharingModal={setSharingModal}
            />
          ) : null}
          {activity.type === ActivityType.GroupActivity ? (
            <GroupActivityActions
              groupActivity={activity}
              sharingModal={sharingModal}
              setSharingModal={setSharingModal}
            />
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

      <ActivityLogDialog
        objectId={String(activity.id)}
        objectType={
          activity.type === ActivityType.LiveQuiz
            ? ObjectType.LiveQuiz
            : activity.type === ActivityType.PracticeQuiz
              ? ObjectType.PracticeQuiz
              : activity.type === ActivityType.MicroLearning
                ? ObjectType.MicroLearning
                : ObjectType.GroupActivity
        }
        trigger={<></>}
        open={isActivityLogOpen}
        onOpenChange={setActivityLogOpen}
      />
    </>
  )
}

export default ActivityListEntry
