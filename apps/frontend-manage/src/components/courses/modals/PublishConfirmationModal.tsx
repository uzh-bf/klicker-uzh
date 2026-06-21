import {
  faArrowRight,
  faHourglassEnd,
  faHourglassStart,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ActivityType } from '@klicker-uzh/types'
import { Modal, toast } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { trpc } from '../../../lib/trpc'

type PublishableScheduledActivityType = 'MICROLEARNING' | 'GROUP_ACTIVITY'

interface PublishConfirmationModalProps {
  onClose: () => void
  activityType: PublishableScheduledActivityType
  activityId: string
  startAt: Date
  endAt: Date
  title: string
  courseId: string
  refetchActivities?: () => Promise<void>
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
  const utils = trpc.useUtils()
  const publishActivity = trpc.activity.publish.useMutation()
  const isMicroLearning = activityType === 'MICROLEARNING'

  return (
    <Modal
      open
      title={t(`manage.course.publishItem${activityType}`)}
      primaryLabel={t('shared.generic.confirm')}
      primaryLoading={publishActivity.isLoading}
      onPrimaryAction={async () => {
        try {
          const result = await publishActivity.mutateAsync({
            activityId,
            activityType: isMicroLearning
              ? ActivityType.MICRO_LEARNING
              : ActivityType.GROUP_ACTIVITY,
          })

          if (!result.publishActivity?.id) {
            toast({
              type: 'error',
              message: t('shared.generic.systemError'),
              options: { duration: 5000 },
            })
            return
          }

          utils.course.detail
            .invalidate({ courseId })
            .catch((error) => console.error(error))
          refetchActivities?.().catch((error) => console.error(error))
          onClose()
        } catch (error) {
          console.error(error)
          toast({
            type: 'error',
            message: t('shared.generic.systemError'),
            options: { duration: 5000 },
          })
        }
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
            isMicroLearning
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
            isMicroLearning
              ? 'manage.course.microlearningPublishingHint'
              : 'manage.course.groupActivityPublishingHint'
          )}
        </div>
      </div>
    </Modal>
  )
}

export default PublishConfirmationModal
