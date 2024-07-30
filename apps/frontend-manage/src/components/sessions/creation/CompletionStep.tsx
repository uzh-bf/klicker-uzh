import { faEye } from '@fortawesome/free-regular-svg-icons'
import { faSync, faXmark } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'

interface CompletionStepProps {
  children?: React.ReactNode
  completionSuccessMessage?: (elementName: string) => React.ReactNode
  name: string
  editMode: boolean
  onViewElement: () => void
  onRestartForm: () => void
  resetForm: () => void
  setStepNumber: (stepNumber: number) => void
  onCloseWizard: () => void
}

function CompletionStep({
  children,
  completionSuccessMessage,
  name,
  editMode,
  onViewElement,
  onRestartForm,
  resetForm,
  setStepNumber,
  onCloseWizard,
}: CompletionStepProps) {
  const t = useTranslations()
  const router = useRouter()

  return (
    <div className="flex flex-col items-center gap-4 p-4 mx-auto">
      <div>
        {completionSuccessMessage
          ? completionSuccessMessage(name)
          : editMode
          ? t('manage.sessionForms.changesSaved')
          : t('manage.sessionForms.elementCreated')}
      </div>
      <div className="space-x-2">
        {children}
        <Button
          onClick={onViewElement}
          data={{ cy: 'load-session-list' }}
          className={{ root: 'space-x-1' }}
        >
          <Button.Icon>
            <FontAwesomeIcon icon={faEye} />
          </Button.Icon>
          <Button.Label>{t('manage.sessionForms.openOverview')}</Button.Label>
        </Button>
        {editMode ? (
          <Button onClick={onCloseWizard}>
            <Button.Icon>
              <FontAwesomeIcon icon={faXmark} />
            </Button.Icon>
            <Button.Label>{t('manage.sessionForms.closeWizard')}</Button.Label>
          </Button>
        ) : (
          <Button
            onClick={() => {
              onRestartForm()
              resetForm()
              setStepNumber(0)
              router.push({ pathname: '/' }, undefined, { shallow: true })
            }}
            className={{ root: 'space-x-1' }}
            data={{ cy: 'create-new-element' }}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faSync} />
            </Button.Icon>
            <Button.Label>
              {t('manage.sessionForms.createNewElement')}
            </Button.Label>
          </Button>
        )}
      </div>
    </div>
  )
}

export default CompletionStep
