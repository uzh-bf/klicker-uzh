import { Button, Modal } from '@uzh-bf/design-system'

const DISCLOSURE_COPY = {
  en: {
    title: 'AI-assisted feedback',
    intro:
      'This question can use an external AI evaluation service to compare your answer with the lecturer’s rubric and provide formative feedback.',
    data: 'If you accept, KlickerUZH sends the question, your answer, the reference solution, and the rubric to {provider}. Your participant identity is not included.',
    responsibility:
      'The feedback can be incomplete or wrong. Use it as learning support and compare detailed feedback with the reference solution.',
    decline:
      'If you decline, your answer stays in KlickerUZH. Only accepted exact-answer matching is used; a non-match remains unevaluated.',
    policy: 'Disclosure version: {version}',
    actionError: 'The action could not be completed. Please try again.',
    declineAction: 'Decline and use exact matching',
    acceptAction: 'Accept and evaluate answer',
  },
  de: {
    title: 'KI-gestütztes Feedback',
    intro:
      'Diese Frage kann einen externen KI-Bewertungsdienst verwenden, um Ihre Antwort mit der Rubrik der Lehrperson zu vergleichen und formatives Feedback zu geben.',
    data: 'Wenn Sie zustimmen, sendet KlickerUZH die Frage, Ihre Antwort, die Referenzlösung und die Rubrik an {provider}. Ihre Teilnehmendenidentität wird nicht übermittelt.',
    responsibility:
      'Das Feedback kann unvollständig oder falsch sein. Nutzen Sie es als Lernhilfe und vergleichen Sie detailliertes Feedback mit der Referenzlösung.',
    decline:
      'Wenn Sie ablehnen, bleibt Ihre Antwort in KlickerUZH. Es wird nur der Abgleich mit akzeptierten exakten Antworten verwendet; eine Abweichung bleibt unbewertet.',
    policy: 'Version der Information: {version}',
    actionError:
      'Die Aktion konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut.',
    declineAction: 'Ablehnen und exakt abgleichen',
    acceptAction: 'Zustimmen und Antwort bewerten',
  },
} as const

function interpolate(value: string, variables: Record<string, string>): string {
  return Object.entries(variables).reduce(
    (result, [key, replacement]) => result.replaceAll(`{${key}}`, replacement),
    value
  )
}

function SemanticEvaluationConsentModal({
  language,
  provider,
  disclosureVersion,
  loading,
  error,
  onAccept,
  onDecline,
}: {
  language: string
  provider: string
  disclosureVersion: string
  loading: boolean
  error: boolean
  onAccept: () => void
  onDecline: () => void
}) {
  const copy = language === 'de' ? DISCLOSURE_COPY.de : DISCLOSURE_COPY.en

  return (
    <Modal
      open
      hideCloseButton
      escapeDisabled
      onClose={() => {}}
      title={copy.title}
      data-cy="semantic-evaluation-consent"
      className={{ content: 'max-w-2xl', title: 'self-start' }}
    >
      <div className="flex flex-col gap-4 text-sm">
        <p>{copy.intro}</p>
        <div className="rounded-md bg-gray-50 p-3">
          {interpolate(copy.data, { provider })}
        </div>
        <p>{copy.responsibility}</p>
        <div className="rounded-md bg-yellow-50 p-3 text-yellow-900">
          {copy.decline}
        </div>
        <p className="text-xs text-gray-500">
          {interpolate(copy.policy, { version: disclosureVersion })}
        </p>
        {error && (
          <p className="text-sm text-red-700" role="alert">
            {copy.actionError}
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            disabled={loading}
            onClick={onDecline}
            data={{ cy: 'semantic-consent-decline' }}
          >
            {copy.declineAction}
          </Button>
          <Button
            primary
            disabled={loading}
            loading={loading}
            onClick={onAccept}
            data={{ cy: 'semantic-consent-accept' }}
          >
            {copy.acceptAction}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default SemanticEvaluationConsentModal
