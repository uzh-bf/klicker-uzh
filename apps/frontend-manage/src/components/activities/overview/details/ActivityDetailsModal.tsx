import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ActivityDetails,
  ActivityType,
  ElementInstance,
  ObjectType,
  PublicationStatus,
  ReviewStatus,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { trpc, type RouterInputs } from '../../../../lib/trpc'
import StudentElementPreviewActivityDetails from '../../../elements/manipulation/StudentElementPreviewActivityDetails'
import ActivityLog from '../../../sharing/ActivityLog'
import ActivityDetailsActions from './ActivityDetailsActions'
import ActivityInformation from './ActivityInformation'
import ActivityOverviewTable from './ActivityOverviewTable'

function ActivityDetailsModal({
  activityId,
  activityType,
  onClose,
  refetchActivities,
}: {
  activityId: string
  activityType: ActivityType
  onClose: () => void
  refetchActivities?: () => Promise<void>
}) {
  const t = useTranslations()
  const detailsInput: RouterInputs['activity']['details'] = {
    activityId,
    activityType:
      activityType as unknown as RouterInputs['activity']['details']['activityType'],
  }

  // fetch activity details
  const { data: detailsData, isLoading: loading } =
    trpc.activity.details.useQuery(detailsInput, {
      refetchOnMount: 'always',
    })

  const details = detailsData?.activityDetails
  const stacks = details?.stacks ?? []
  const detailsStatus = details?.status as unknown as PublicationStatus
  const detailsReviewStatus = details?.reviewStatus as unknown as
    | ReviewStatus
    | undefined
  const isReviewed = detailsReviewStatus === ReviewStatus.Reviewed
  const instanceIds = useMemo(
    () =>
      stacks.flatMap((stack) =>
        stack.elements.map((element) => element.instance.id)
      ),
    [stacks]
  )

  // check which instances are outdated
  const { data } = trpc.activity.outdatedElementInstances.useQuery(
    { instanceIds },
    {
      enabled: !!details && instanceIds.length > 0,
      refetchOnMount: 'always',
    }
  )

  const outdatedInstances = useMemo(() => {
    if (!detailsStatus) return []

    return [
      PublicationStatus.Draft,
      PublicationStatus.Scheduled,
      PublicationStatus.Template,
    ].includes(detailsStatus)
      ? (data?.outdatedElementInstances.map((instance) => instance.id) ?? [])
      : []
  }, [data?.outdatedElementInstances, detailsStatus])

  // selected instance id
  const [selectedInstanceId, setSelectedInstanceId] = useState<number | null>(
    null
  )
  const selected = useMemo(
    () =>
      selectedInstanceId !== null
        ? (stacks
            .flatMap((stack) => stack.elements)
            .find((element) => element.instance.id === selectedInstanceId) ??
          null)
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
      {!!details ? (
        <div className="flex h-auto min-h-0 flex-col gap-2 lg:flex-row xl:h-full xl:max-h-full xl:flex-row">
          <div className="flex h-max max-h-full min-h-0 w-full flex-col gap-2 overflow-auto lg:max-h-[calc(100vh-6rem)] lg:w-2/3 xl:w-1/2">
            <ActivityDetailsActions
              details={details as unknown as ActivityDetails}
              activityType={activityType}
              isReviewed={isReviewed}
              setSelectedInstanceId={setSelectedInstanceId}
            />
            <ActivityInformation
              details={details as unknown as ActivityDetails}
              activityType={activityType}
              activityReviewStatus={detailsReviewStatus as ReviewStatus}
            />

            <ActivityOverviewTable
              details={details as unknown as ActivityDetails}
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
                    instance={selected.instance as unknown as ElementInstance}
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
