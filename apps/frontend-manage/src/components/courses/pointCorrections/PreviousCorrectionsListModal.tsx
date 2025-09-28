import { useSuspenseQuery } from '@apollo/client'
import { GetPreviousPointCorrectionsDocument } from '@klicker-uzh/graphql/dist/ops'
import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Suspense } from 'react'
import PreviousPointCorrectionList from './PreviousPointCorrectionList'

function PreviousCorrectionsListModal({
  liveQuizId,
  instanceId,
  onClose,
}: {
  liveQuizId?: string
  instanceId?: string
  onClose: () => void
}) {
  const t = useTranslations()

  // load all previous corrections
  const { data: previousCorrectionsData } = useSuspenseQuery(
    GetPreviousPointCorrectionsDocument,
    {
      variables: {
        liveQuizId,
        instanceId: !Number.isNaN(Number(instanceId))
          ? Number(instanceId)
          : undefined,
      },
      fetchPolicy: 'network-only',
      skip: !liveQuizId || liveQuizId === '',
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
