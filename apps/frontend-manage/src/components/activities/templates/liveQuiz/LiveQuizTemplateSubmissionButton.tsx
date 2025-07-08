import { faSave } from '@fortawesome/free-regular-svg-icons'
import { Button, Tooltip } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { LiveQuizTemplateFormValues } from '../types'

function SubmissionButton({
  disabled = false,
  loading,
  onSubmit,
}: {
  disabled?: boolean
  loading: boolean
  onSubmit: () => Promise<void>
}) {
  const t = useTranslations()

  return (
    <Button
      primary
      disabled={disabled}
      loading={loading}
      onClick={onSubmit}
      data={{ cy: 'live-quiz-template-submit' }}
    >
      <Button.Icon icon={faSave} />
      <Button.Label>{t('manage.template.createLIVE_QUIZ')}</Button.Label>
    </Button>
  )
}

function LiveQuizTemplateSubmissionButton({
  quizData,
  loading,
  onSubmit,
}: {
  quizData: LiveQuizTemplateFormValues
  loading: boolean
  onSubmit: () => Promise<void>
}) {
  const t = useTranslations()
  const submissionDisabled =
    !quizData ||
    !quizData.settingsProcessed ||
    !quizData.blocks?.every(
      (block) => block.elements?.every((element) => element.processed) ?? false
    )

  if (submissionDisabled) {
    return (
      <Tooltip
        tooltip={t('manage.template.templateInputsIncomplete')}
        className={{ tooltip: 'max-w-120 z-20' }}
      >
        <SubmissionButton disabled loading={loading} onSubmit={onSubmit} />
      </Tooltip>
    )
  }

  return <SubmissionButton loading={loading} onSubmit={onSubmit} />
}

export default LiveQuizTemplateSubmissionButton
