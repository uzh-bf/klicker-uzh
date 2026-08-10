import {
  faCheckCircle,
  faClock,
  faHourglassHalf,
  faPenToSquare,
} from '@fortawesome/free-regular-svg-icons'
import {
  faExclamationTriangle,
  faFilePen,
  faLock,
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
import { Badge, Checkbox, Tooltip } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import ActivityLogDialog from '../../sharing/ActivityLogDialog'
import ObjectPermissionLevel from '../../sharing/ObjectPermissionLevel'
import SharingTypeBadge from '../../sharing/SharingTypeBadge'
import ActivityNameChangeModal from './ActivityNameChangeModal'
import ActivityReviewStatus from './ActivityReviewStatus'
import AssessmentBadge from './AssessmentBadge'
import ActivityDetailsModal from './details/ActivityDetailsModal'
import GroupActivityActions from './GroupActivityActions'
import LiveQuizActions from './LiveQuizActions'
import MicrolearningActions from './MicrolearningActions'
import PracticeQuizActions from './PracticeQuizActions'

function ActivityListEntry({
  activity,
  highlighted = false,
  hideType = false,
  checked = false,
  onCheck,
  highlightedActivity,
  refetchActivities,
}: {
  activity: ActivityInfo
  highlighted?: boolean
  hideType?: boolean
  checked?: boolean
  onCheck?: () => void
  highlightedActivity: string | null
  refetchActivities?: () => Promise<void>
}) {
  const t = useTranslations()
  const [showDetails, setShowDetails] = useState<boolean>(false)
  const [changeName, setChangeName] = useState<boolean>(false)
  const [sharingModal, setSharingModal] = useState<boolean>(false)
  const [isActivityLogOpen, setActivityLogOpen] = useState<boolean>(false)

  const disabled =
    activity.status !== PublicationStatus.Draft &&
    activity.status !== PublicationStatus.Scheduled
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
      <div className="flex w-full flex-row items-center gap-1.5">
        {onCheck ? (
          disabled ? (
            <Tooltip
              tooltip={t('manage.activities.batchOperationsOnlyDraftScheduled')}
            >
              <Checkbox
                disabled
                checked={false}
                onCheck={() => {}}
                className={{ root: 'border-unset disabled:bg-uzh-grey-20' }}
                data={{ cy: `activity-checkbox-${activity.name}` }}
              />
            </Tooltip>
          ) : (
            <Checkbox
              checked={checked}
              onCheck={onCheck}
              className={{ root: 'border-unset disabled:bg-uzh-grey-20' }}
              data={{ cy: `activity-checkbox-${activity.name}` }}
            />
          )
        ) : null}
        <div
          className={twMerge(
            'flex w-full flex-row items-start justify-between rounded-md border border-solid px-4 py-3 shadow-sm transition-all hover:shadow-md',
            highlighted && 'border-primary-100 bg-orange-50',
            highlightedActivity === activity.id &&
              'border-primary-100 bg-orange-100'
          )}
          data-cy={`activity-${activity.type}-${activity.name}`}
        >
          <div className="flex-1">
            <div className="flex flex-row items-center gap-2.5">
              {publicationStatusMap[activity.status]}
              <button
                type="button"
                className="hover:text-uzh-blue-100 border-0 bg-transparent p-0 text-left font-bold hover:cursor-pointer"
                onClick={() => setShowDetails(true)}
                data-cy={`activity-name-${activity.name}`}
              >
                {hideType
                  ? activity.name
                  : `${t(`shared.types.${activity.type}`)}: ${activity.name}`}
              </button>

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

              {activity.isAssessmentEnabled && (
                <AssessmentBadge className="ml-2" />
              )}
              {!!activity.pinCode && (
                <Badge
                  className={twMerge(
                    'bg-primary-80 hover:bg-primary-100 gap-2',
                    !activity.isAssessmentEnabled && 'ml-2'
                  )}
                >
                  <FontAwesomeIcon icon={faLock} />
                  {t('shared.generic.pinProtected')}
                </Badge>
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
                {activity.automaticPublicationAt &&
                activity.status === PublicationStatus.Scheduled ? (
                  <div className="flex flex-row items-center gap-1.5">
                    <FontAwesomeIcon icon={faClock} />
                    <span>
                      {t('manage.activities.automaticPublicationAt', {
                        date: dayjs(activity.automaticPublicationAt).format(
                          'DD.MM.YYYY HH:mm'
                        ),
                      })}
                    </span>
                  </div>
                ) : null}
                {activity.scheduledStartAt && activity.scheduledEndAt ? (
                  <div className="flex flex-row items-center gap-1.5">
                    <FontAwesomeIcon icon={faHourglassHalf} />
                    <span>
                      {t('manage.activities.availability', {
                        startDate: dayjs(activity.scheduledStartAt).format(
                          'DD.MM.YYYY HH:mm'
                        ),
                        endDate: dayjs(activity.scheduledEndAt).format(
                          'DD.MM.YYYY HH:mm'
                        ),
                      })}
                    </span>
                  </div>
                ) : null}
                {!(
                  activity.automaticPublicationAt &&
                  activity.status === PublicationStatus.Scheduled
                ) && !activity.scheduledStartAt
                  ? t('manage.activities.lastModifiedAt', {
                      date: dayjs(activity.updatedAt).format(
                        'DD.MM.YYYY HH:mm'
                      ),
                    })
                  : null}
              </div>
              <SharingTypeBadge
                sharingType={activity.sharingType}
                className={{ root: 'text-sm' }}
              />
            </div>
          </div>
          <div className="gap-4.5 flex flex-col items-end">
            <div className="-mt-1 flex flex-row items-center">
              <ActivityReviewStatus reviewStatus={activity.reviewStatus} />

              {activity.numSharedUsers && activity.isManager ? (
                <button
                  type="button"
                  aria-label={`${t(`manage.sharing.share${activity.type}`)} (${activity.numSharedUsers} ${t('shared.generic.users')})`}
                  className="hover:text-primary-100 ml-2 mr-3 flex h-max flex-row items-center gap-1.5 border-0 bg-transparent py-1 text-gray-600 hover:cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setSharingModal(true)
                  }}
                >
                  <span>{activity.numSharedUsers}</span>
                  <FontAwesomeIcon icon={faUserGroup} className="h-4 w-4" />
                </button>
              ) : null}

              {activity.type === ActivityType.LiveQuiz ? (
                <LiveQuizActions
                  liveQuiz={activity}
                  isTemplate={!!activity.templateId}
                  sharingModal={sharingModal}
                  setSharingModal={setSharingModal}
                  setShowDetails={setShowDetails}
                  refetchActivities={refetchActivities}
                />
              ) : null}
              {activity.type === ActivityType.PracticeQuiz ? (
                <PracticeQuizActions
                  practiceQuiz={activity}
                  isTemplate={!!activity.templateId}
                  sharingModal={sharingModal}
                  setSharingModal={setSharingModal}
                  setShowDetails={setShowDetails}
                  refetchActivities={refetchActivities}
                />
              ) : null}
              {activity.type === ActivityType.MicroLearning ? (
                <MicrolearningActions
                  microLearning={activity}
                  isTemplate={!!activity.templateId}
                  sharingModal={sharingModal}
                  setSharingModal={setSharingModal}
                  setShowDetails={setShowDetails}
                  refetchActivities={refetchActivities}
                />
              ) : null}
              {activity.type === ActivityType.GroupActivity ? (
                <GroupActivityActions
                  groupActivity={activity}
                  isTemplate={!!activity.templateId}
                  sharingModal={sharingModal}
                  setSharingModal={setSharingModal}
                  setShowDetails={setShowDetails}
                  refetchActivities={refetchActivities}
                />
              ) : null}
            </div>
            {activity.areInstancesOutdated &&
            [
              PublicationStatus.Draft,
              PublicationStatus.Scheduled,
              PublicationStatus.Template,
            ].includes(activity.status) ? (
              <Tooltip
                delay={0}
                tooltip={t.rich(
                  activity.status === PublicationStatus.Template
                    ? 'manage.activities.instanceUpdateTemplate'
                    : 'manage.activities.instanceUpdateDraftScheduled',
                  {
                    b: (content) => <b>{content}</b>,
                    ul: (content) => (
                      <ul className="list-disc pl-4">{content}</ul>
                    ),
                    li: (content) => <li className="mt-0.5">{content}</li>,
                  }
                )}
                className={{ tooltip: 'text-wrap' }}
              >
                <div
                  className="text-uzh-red-100 flex flex-row items-center gap-2 text-sm"
                  data-cy={`instances-outdated-${activity.name}`}
                >
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                  {t('manage.activities.instancesOutdated')}
                </div>
              </Tooltip>
            ) : null}
          </div>
        </div>
      </div>

      {showDetails && (
        <ActivityDetailsModal
          activityId={activity.id}
          activityType={activity.type}
          onClose={() => setShowDetails(false)}
          refetchActivities={refetchActivities}
        />
      )}

      {changeName && (
        <ActivityNameChangeModal
          id={activity.id}
          name={activity.name}
          type={activity.type}
          displayName={activity.displayName}
          courseId={activity.courseId}
          onClose={() => setChangeName(false)}
          refetchActivities={refetchActivities}
        />
      )}

      {isActivityLogOpen && (
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
          open={isActivityLogOpen}
          onClose={() => setActivityLogOpen(false)}
        />
      )}
    </>
  )
}

export default ActivityListEntry
