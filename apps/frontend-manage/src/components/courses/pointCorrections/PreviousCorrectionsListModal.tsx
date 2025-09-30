import { useSuspenseQuery } from '@apollo/client'
import { GetPreviousPointCorrectionsDocument } from '@klicker-uzh/graphql/dist/ops'
import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Suspense } from 'react'
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
  const { data: previousCorrectionsData } = useSuspenseQuery(
    GetPreviousPointCorrectionsDocument,
    {
      variables: {
        courseId,
        liveQuizId,
        instanceId: !Number.isNaN(parsedInstanceId)
          ? parsedInstanceId
          : undefined,
      },
      fetchPolicy: 'network-only',
      skip:
        (!liveQuizId || liveQuizId === '') && (!courseId || courseId === ''),
    }
  )

  return (
    <Suspense
      fallback={
        <Modal open loading onClose={() => {}}>
          {' '}
        </Modal>
      }
    >
      <Modal
        open
        onClose={onClose}
        title={t('manage.course.appliedCorrections')}
        className={{ content: 'max-w-3xl' }}
      >
        {previousCorrectionsData?.previousPointCorrections ? (
          <PreviousPointCorrectionList
            corrections={
              previousCorrectionsData?.previousPointCorrections ?? []
            }
          />
        ) : (
          <div className="text-sm text-gray-600">
            {!!instanceId
              ? t('manage.pointCorrections.historyPlaceholderInstance')
              : t('manage.pointCorrections.historyPlaceholder')}
          </div>
        )}
      </Modal>
    </Suspense>
  )
}

export default PreviousCorrectionsListModal
