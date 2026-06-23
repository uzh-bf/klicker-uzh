import { Modal, UserNotification } from '@uzh-bf/design-system'
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
  const {
    data: previousCorrectionsData,
    error,
    isLoading,
  } = trpc.activity.previousPointCorrections.useQuery(
    {
      courseId,
      liveQuizId,
      instanceId: validInstanceId ? parsedInstanceId : undefined,
    },
    {
      enabled: Boolean(liveQuizId || courseId || validInstanceId),
    }
  )
  const corrections = previousCorrectionsData?.previousPointCorrections
  const initialLoading = isLoading && !corrections
  const correctionsUnavailable = Boolean(error && !corrections)
  const staleCorrectionsError = Boolean(error && previousCorrectionsData)

  return (
    <Modal
      open
      loading={initialLoading}
      onClose={onClose}
      title={t('manage.course.appliedCorrections')}
      className={{ content: 'max-w-3xl' }}
    >
      {correctionsUnavailable ? (
        <UserNotification
          type="error"
          message={t('shared.generic.systemError')}
        />
      ) : (
        <>
          {staleCorrectionsError ? (
            <UserNotification
              type="error"
              message={t('shared.generic.systemError')}
              className={{ root: 'mb-3' }}
            />
          ) : null}
          {corrections && corrections.length > 0 ? (
            <PreviousPointCorrectionList corrections={corrections} />
          ) : (
            <div className="text-sm text-gray-600">
              {!!instanceId
                ? t('manage.pointCorrections.historyPlaceholderInstance')
                : t('manage.pointCorrections.historyPlaceholder')}
            </div>
          )}
        </>
      )}
    </Modal>
  )
}

export default PreviousCorrectionsListModal
