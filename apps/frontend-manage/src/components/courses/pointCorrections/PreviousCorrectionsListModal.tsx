import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { trpc } from '../../../lib/trpc'
import PreviousPointCorrectionList from './PreviousPointCorrectionList'

function PreviousCorrectionsListModal({
  courseId,
  liveQuizId,
  instanceId,
  onClose,
}: {
  courseId?: string
  liveQuizId?: string
  instanceId?: string
  onClose: () => void
}) {
  const t = useTranslations()

  // load all previous corrections
  const parsedInstanceId =
    instanceId && instanceId.trim() !== ''
      ? parseInt(instanceId, 10)
      : undefined
  const validInstanceId =
    typeof parsedInstanceId === 'number' && !Number.isNaN(parsedInstanceId)
  const { data: previousCorrectionsData, isLoading } =
    trpc.activity.previousPointCorrections.useQuery(
      {
        courseId,
        liveQuizId,
        instanceId: validInstanceId ? parsedInstanceId : undefined,
      },
      {
        enabled: Boolean(liveQuizId || courseId || validInstanceId),
      }
    )

  return (
    <Modal
      open
      loading={isLoading}
      onClose={onClose}
      title={t('manage.course.appliedCorrections')}
      className={{ content: 'max-w-3xl' }}
    >
      {previousCorrectionsData?.previousPointCorrections ? (
        <PreviousPointCorrectionList
          corrections={previousCorrectionsData.previousPointCorrections}
        />
      ) : (
        <div className="text-sm text-gray-600">
          {!!instanceId
            ? t('manage.pointCorrections.historyPlaceholderInstance')
            : t('manage.pointCorrections.historyPlaceholder')}
        </div>
      )}
    </Modal>
  )
}

export default PreviousCorrectionsListModal
