import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function SemanticEvaluationConsentModal({
  provider,
  disclosureVersion,
  loading,
  error,
  onAccept,
  onDecline,
}: {
  provider: string
  disclosureVersion: string
  loading: boolean
  error: boolean
  onAccept: () => void
  onDecline: () => void
}) {
  const t = useTranslations()

  return (
    <Modal
      open
      hideCloseButton
      escapeDisabled
      onClose={() => {}}
      title={t('pwa.practiceQuiz.semanticConsentTitle')}
      className={{ content: 'max-w-2xl', title: 'self-start' }}
    >
      <div
        className="flex flex-col gap-4 text-sm"
        data-cy="semantic-evaluation-consent"
      >
        <p>{t('pwa.practiceQuiz.semanticConsentIntro')}</p>
        <div className="rounded-md bg-gray-50 p-3">
          {t('pwa.practiceQuiz.semanticConsentData', { provider })}
        </div>
        <p>{t('pwa.practiceQuiz.semanticConsentResponsibility')}</p>
        <div className="rounded-md bg-yellow-50 p-3 text-yellow-900">
          {t('pwa.practiceQuiz.semanticConsentDecline')}
        </div>
        <p className="text-xs text-gray-500">
          {t('pwa.practiceQuiz.semanticConsentPolicy', {
            version: disclosureVersion,
          })}
        </p>
        {error && (
          <p className="text-sm text-red-700" role="alert">
            {t('pwa.practiceQuiz.semanticActionFailed')}
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            disabled={loading}
            onClick={onDecline}
            data={{ cy: 'semantic-consent-decline' }}
          >
            {t('pwa.practiceQuiz.semanticConsentDeclineAction')}
          </Button>
          <Button
            primary
            disabled={loading}
            loading={loading}
            onClick={onAccept}
            data={{ cy: 'semantic-consent-accept' }}
          >
            {t('pwa.practiceQuiz.semanticConsentAcceptAction')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default SemanticEvaluationConsentModal
