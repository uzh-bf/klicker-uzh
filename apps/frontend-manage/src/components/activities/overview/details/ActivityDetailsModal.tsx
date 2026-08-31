import { useQuery } from '@apollo/client'
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ActivityType,
  type ElementInstance,
  GetActivityDetailsDocument,
  GetOutdatedElementInstancesDocument,
  ObjectType,
  PublicationStatus,
  ReviewStatus,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal, UserNotification } from '@uzh-bf/design-system'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import StudentElementPreviewActivityDetails from '../../../elements/manipulation/StudentElementPreviewActivityDetails'
import ActivityLog from '../../../sharing/ActivityLog'
import { useCourseDeletionStatus } from '../../../courses/CourseDeletionStatusProvider'
import ActivityDetailsActions from './ActivityDetailsActions'
import ActivityInformation from './ActivityInformation'
import ActivityOverviewTable from './ActivityOverviewTable'

function ActivityDetailsModal({
  activityId,
  activityType,
  readOnly = false,
  onClose,
  refetchActivities,
}: {
  activityId: string
  activityType: ActivityType
  readOnly?: boolean
  onClose: () => void
  refetchActivities?: () => Promise<void>
}) {
  const t = useTranslations()
  const { isCourseDeletionActive } = useCourseDeletionStatus()

  // fetch activity details
  const { data: detailsData, loading } = useQuery(GetActivityDetailsDocument, {
    variables: { activityId, activityType },
    fetchPolicy: 'cache-and-network',
  })

  const details = detailsData?.activityDetails
  const activityMutationBlocked =
    readOnly ||
    (!!details?.courseId && isCourseDeletionActive(details.courseId))
  const stacks = detailsData?.activityDetails?.stacks ?? []
  const isReviewed = details?.reviewStatus === ReviewStatus.Reviewed

  // check which instances are outdated
  const { data } = useQuery(GetOutdatedElementInstancesDocument, {
    variables: {
      instanceIds: stacks.flatMap((stack) =>
        stack.elements.map((element) => element.instance.id)
      ),
    },
    skip: !details,
    fetchPolicy: 'cache-and-network',
  })

  const outdatedInstances = useMemo(() => {
    if (!details?.status) return []

    return [
      PublicationStatus.Draft,
      PublicationStatus.Scheduled,
      PublicationStatus.Template,
    ].includes(details.status)
      ? (data?.getOutdatedElementInstances?.map((instance) => instance.id) ??
          [])
      : []
  }, [data?.getOutdatedElementInstances, details?.status])

  // selected instance id
  const [selectedInstanceId, setSelectedInstanceId] = useState<number | null>(
    null
  )
  const selected = useMemo(
    () =>
      selectedInstanceId !== null
        ? (stacks
            .flatMap((stack) => stack.elements)
            .find((element) => element.instance.id === selectedInstanceId) ?? {
            instance: { id: '', elementData: { name: '' } },
          })
        : null,
    [stacks, selectedInstanceId]
  )

  return (
    <Modal
      open
      fullScreen
      loading={loading}
      title={t('manage.activities.activityDetails')}
      onClose={() => {
        refetchActivities?.()
        onClose()
      }}
      className={{
        content: 'max-w-400 h-max w-[calc(100%-2rem)] lg:overflow-hidden',
      }}
      data={{ cy: 'activity-details-modal' }}
      dataCloseButton={{ cy: 'close-activity-details-modal' }}
    >
      {details ? (
        <div className="flex h-auto min-h-0 flex-col gap-2 lg:flex-row xl:h-full xl:max-h-full xl:flex-row">
          <div className="flex h-max max-h-full min-h-0 w-full flex-col gap-2 overflow-auto lg:max-h-[calc(100vh-6rem)] lg:w-2/3 xl:w-1/2">
            <ActivityDetailsActions
              details={details}
              activityType={activityType}
              isReviewed={isReviewed}
              readOnly={activityMutationBlocked}
              setSelectedInstanceId={setSelectedInstanceId}
            />
            <ActivityInformation
              details={details}
              activityType={activityType}
              activityReviewStatus={details?.reviewStatus}
            />

            <ActivityOverviewTable
              details={details}
              activityType={activityType}
              outdatedInstances={outdatedInstances}
              selectedInstanceId={selectedInstanceId}
              setSelectedInstanceId={setSelectedInstanceId}
            />
          </div>
          <div className="flex h-max max-h-full min-h-0 w-full flex-col gap-8 overflow-auto pb-2 lg:max-h-[calc(100vh-6rem)] lg:w-1/3 lg:gap-2 lg:pl-1.5 xl:w-1/2 xl:pl-3">
            {selected ? (
              <>
                <div className="flex flex-col">
                  <h4 className="mb-1 font-bold">
                    {t('manage.general.elementPreviewDescription')}:
                  </h4>
                  <StudentElementPreviewActivityDetails
                    instance={selected.instance as ElementInstance}
                  />
                </div>
                <div className="flex flex-row items-center justify-center gap-5">
                  <Link
                    href={`/instances/${selected.instance.id}`}
                    className="ml-auto text-sm hover:text-slate-700"
                    key={selected.instance.id}
                    legacyBehavior
                    passHref
                  >
                    <a
                      data-cy={`open-instance-${selected.instance.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-100 flex flex-row items-center gap-2 text-sm font-normal hover:underline"
                    >
                      <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                      {t('manage.general.elementPreviewRedirect')}
                    </a>
                  </Link>
                </div>
              </>
            ) : (
              <ActivityLog
                visible={!selected}
                objectId={activityId}
                objectType={
                  activityType === ActivityType.LiveQuiz
                    ? ObjectType.LiveQuiz
                    : activityType === ActivityType.PracticeQuiz
                      ? ObjectType.PracticeQuiz
                      : activityType === ActivityType.MicroLearning
                        ? ObjectType.MicroLearning
                        : ObjectType.GroupActivity
                }
                className="max-h-[calc(100vh-12rem)] overflow-auto"
              />
            )}
          </div>
        </div>
      ) : (
        <UserNotification type="error" message={t('shared.generic.error')} />
      )}
    </Modal>
  )
}

export default ActivityDetailsModal
