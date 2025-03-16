import { faSave } from '@fortawesome/free-regular-svg-icons'
import { Button, Tooltip } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { LiveQuizTemplateFormValues } from './types'

function SubmissionButton({
  disabled = false,
  onSubmit,
}: {
  disabled?: boolean
  onSubmit: () => Promise<void>
}) {
  const t = useTranslations()

  return (
    <Button primary disabled={disabled} onClick={onSubmit}>
      <Button.Icon icon={faSave} />
      <Button.Label>{t('manage.template.createLIVE_QUIZ')}</Button.Label>
    </Button>
  )
}
function LiveQuizTemplateSubmissionButton({
  quizData,
  onSubmit,
}: {
  quizData: LiveQuizTemplateFormValues
  onSubmit: () => Promise<void>
}) {
  const t = useTranslations()
  const submissionDisabled =
    !quizData.settingsProcessed ||
    !quizData?.blocks?.every((block) =>
      block.elements.every((element) => element.processed)
    )

  if (submissionDisabled) {
    return (
      <Tooltip
        tooltip={t('manage.template.templateInputsIncomplete')}
        className={{ tooltip: 'z-20' }}
      >
        <SubmissionButton disabled onSubmit={onSubmit} />
      </Tooltip>
    )
  }

  return <SubmissionButton onSubmit={onSubmit} />
}

export default LiveQuizTemplateSubmissionButton
