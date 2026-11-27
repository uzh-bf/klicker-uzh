import { useMutation } from '@apollo/client'
import {
  faArrowRight,
  faHourglassEnd,
  faHourglassStart,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementInstanceType,
  GetSingleCourseDocument,
  PublishGroupActivityDocument,
  PublishMicroLearningDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal, toast } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'

interface PublishConfirmationModalProps {
  onClose: () => void
  activityType:
    | ElementInstanceType.Microlearning
    | ElementInstanceType.GroupActivity
  activityId: string
  startAt: Date
  endAt: Date
  title: string
  courseId: string
  refetchActivities?: () => Promise<void>
}

function getActivityArtifactPublishReason(error: unknown): string | undefined {
  const graphQLErrors = (error as { graphQLErrors?: unknown[] } | null)
    ?.graphQLErrors

  for (const graphQLError of graphQLErrors ?? []) {
    const reason = (
      graphQLError as {
        extensions?: { activityArtifactPublish?: unknown }
      } | null
    )?.extensions?.activityArtifactPublish
    if (typeof reason === 'string') return reason
  }

  return undefined
}

function getPublishErrorMessageKey(error: unknown) {
  switch (getActivityArtifactPublishReason(error)) {
    case 'forbidden':
      return 'manage.course.publishArtifactForbidden' as const
    case 'invalid':
      return 'manage.course.publishArtifactInvalid' as const
    case 'unavailable':
      return 'manage.course.publishArtifactUnavailable' as const
    default:
      return 'shared.generic.error' as const
  }
}

function PublishConfirmationModal({
  onClose,
  activityType,
  activityId,
  startAt,
  endAt,
  title,
  courseId,
  refetchActivities,
}: PublishConfirmationModalProps) {
  const t = useTranslations()

  const [publishMicroLearning, { loading: mlPublishLoading }] = useMutation(
    PublishMicroLearningDocument,
    {
      variables: { id: activityId },
      update(cache, { data }) {
        cache.updateQuery(
          { query: GetSingleCourseDocument, variables: { courseId } },
          (qData) => {
            const publishedMicro = data?.publishMicroLearning
            if (!qData?.course?.microLearningsInfo || !publishedMicro)
              return qData

            return {
              course: {
                ...qData.course,
                microLearningsInfo: qData.course.microLearningsInfo.map(
                  (micro) =>
                    micro.id === publishedMicro.id
                      ? {
                          ...micro,
                          status: publishedMicro.status,
                        }
                      : micro
                ),
              },
            }
          }
        )
      },
    }
  )

  const [publishGroupActivity, { loading: gaPublishLoading }] = useMutation(
    PublishGroupActivityDocument,
    {
      variables: { id: activityId },
      update(cache, { data }) {
        cache.updateQuery(
          { query: GetSingleCourseDocument, variables: { courseId } },
          (qData) => {
            const publishedGa = data?.publishGroupActivity
            if (!qData?.course?.groupActivitiesInfo || !publishedGa)
              return qData

            return {
              course: {
                ...qData.course,
                groupActivitiesInfo: qData.course.groupActivitiesInfo.map(
                  (groupActivity) =>
                    groupActivity.id === publishedGa.id
                      ? {
                          ...groupActivity,
                          status: publishedGa.status,
                        }
                      : groupActivity
                ),
              },
            }
          }
        )
      },
    }
  )

  return (
    <Modal
      open
      title={t(`manage.course.publishItem${activityType}`)}
      primaryLabel={t('shared.generic.confirm')}
      primaryLoading={mlPublishLoading || gaPublishLoading}
      onPrimaryAction={async () => {
        try {
          if (activityType === ElementInstanceType.Microlearning) {
            await publishMicroLearning()
          } else if (activityType === ElementInstanceType.GroupActivity) {
            await publishGroupActivity()
          }
        } catch (error) {
          toast({
            type: 'error',
            message: t(getPublishErrorMessageKey(error)),
            options: { duration: 6000 },
          })
          return
        }
        await refetchActivities?.()
        onClose()
      }}
      dataPrimaryAction={{ cy: 'confirm-publish-action' }}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={() => {
        onClose()
      }}
      dataSecondaryAction={{ cy: 'cancel-publish-action' }}
      onClose={onClose}
      hideCloseButton={true}
      className={{ content: 'max-w-2xl', title: 'text-xl' }}
    >
      <div className="mt-4 space-y-2 text-base">
        <div>
          {t.rich(
            activityType === ElementInstanceType.Microlearning
              ? 'manage.course.confirmPublishingMicrolearning'
              : 'manage.course.confirmPublishingGroupActivity',
            { name: title, b: (text) => <b>{text}</b> }
          )}
        </div>
        <div className="flex w-max flex-row items-center rounded-md bg-gray-100 p-2.5">
          <div className="flex items-center">
            <FontAwesomeIcon
              icon={faHourglassStart}
              className="mr-2 text-green-700"
            />
            <span className="font-medium">
              {t('shared.generic.startAt', {
                time: dayjs(startAt).format('DD.MM.YYYY HH:mm'),
              })}
            </span>
          </div>
          <FontAwesomeIcon icon={faArrowRight} className="mx-4 text-gray-400" />
          <div className="flex items-center">
            <FontAwesomeIcon
              icon={faHourglassEnd}
              className="mr-2 text-red-600"
            />
            <span className="font-medium">
              {t('shared.generic.endAt', {
                time: dayjs(endAt).format('DD.MM.YYYY HH:mm'),
              })}
            </span>
          </div>
        </div>
        <div className="text-sm text-gray-600">
          {t(
            activityType === ElementInstanceType.Microlearning
              ? 'manage.course.microlearningPublishingHint'
              : 'manage.course.groupActivityPublishingHint'
          )}
        </div>
      </div>
    </Modal>
  )
}

export default PublishConfirmationModal
