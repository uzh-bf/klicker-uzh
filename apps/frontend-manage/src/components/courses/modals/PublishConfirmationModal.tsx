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
  GetUserActivitiesDocument,
  PublishGroupActivityDocument,
  PublishMicroLearningDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal } from '@uzh-bf/design-system'
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
}

function PublishConfirmationModal({
  onClose,
  activityType,
  activityId,
  startAt,
  endAt,
  title,
  courseId,
}: PublishConfirmationModalProps) {
  const t = useTranslations()

  const [publishMicroLearning, { loading: mlPublishLoading }] = useMutation(
    PublishMicroLearningDocument,
    {
      variables: { id: activityId },
      // TODO: replace with proper cache update
      refetchQueries: [
        { query: GetUserActivitiesDocument },
        { query: GetSingleCourseDocument, variables: { id: courseId } },
      ],
    }
  )
  const [publishGroupActivity, { loading: gaPublishLoading }] = useMutation(
    PublishGroupActivityDocument,
    {
      variables: { id: activityId },
      // TODO: replace with proper cache update
      refetchQueries: [
        { query: GetUserActivitiesDocument },
        { query: GetSingleCourseDocument, variables: { id: courseId } },
      ],
    }
  )

  return (
    <Modal
      open
      title={t(`manage.course.publishItem${activityType}`)}
      primaryLabel={t('shared.generic.confirm')}
      primaryLoading={mlPublishLoading || gaPublishLoading}
      onPrimaryAction={async () => {
        if (activityType === ElementInstanceType.Microlearning) {
          await publishMicroLearning()
        } else if (activityType === ElementInstanceType.GroupActivity) {
          await publishGroupActivity()
        }
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
              className="mr-2 text-green-600"
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
