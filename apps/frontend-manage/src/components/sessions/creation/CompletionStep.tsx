import { faEye } from '@fortawesome/free-regular-svg-icons'
import { faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface CompletionStepProps {
  completionSuccessMessage?: (elementName: string) => React.ReactNode
  name: string
  editMode: boolean
  onViewElement: () => void
  onRestartForm: () => void
  resetForm: () => void
  setStepNumber: (stepNumber: number) => void
}

function CompletionStep({
  completionSuccessMessage,
  name,
  editMode,
  onViewElement,
  onRestartForm,
  resetForm,
  setStepNumber,
}: CompletionStepProps) {
  const t = useTranslations()

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <div>
        {completionSuccessMessage
          ? completionSuccessMessage(name)
          : editMode
          ? t('manage.sessionForms.changesSaved')
          : t('manage.sessionForms.elementCreated')}
      </div>
      <div className="space-x-2">
        <Button onClick={onViewElement} data={{ cy: 'load-session-list' }}>
          <Button.Icon>
            <FontAwesomeIcon icon={faEye} />
          </Button.Icon>
          <Button.Label>{t('manage.sessionForms.openOverview')}</Button.Label>
        </Button>
        <Button
          onClick={() => {
            onRestartForm()
            resetForm()
            setStepNumber(0)
          }}
        >
          <Button.Icon>
            <FontAwesomeIcon icon={faSync} />
          </Button.Icon>
          <Button.Label>
            {t('manage.sessionForms.createNewElement')}
          </Button.Label>
        </Button>
      </div>
    </div>
  )
}

export default CompletionStep
