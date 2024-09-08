import {
  faArrowLeft,
  faArrowRight,
  faCancel,
  faSave,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface WizardNavigationProps {
  editMode: boolean
  isSubmitting: boolean
  stepValidity: boolean[]
  activeStep: number
  lastStep: boolean
  continueDisabled: boolean
  onPrevStep?: () => void
  onCloseWizard: () => void
}

function WizardNavigation({
  editMode,
  isSubmitting,
  stepValidity,
  activeStep,
  lastStep,
  continueDisabled,
  onPrevStep,
  onCloseWizard,
}: WizardNavigationProps) {
  const t = useTranslations()

  return (
    <div className="flex flex-row justify-between pt-2">
      <div className="flex flex-row items-center gap-2">
        {typeof onPrevStep !== 'undefined' && (
          <Button
            onClick={() => onPrevStep()}
            data={{ cy: 'back-session-creation' }}
            type="button"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            <div>{t('shared.generic.back')}</div>
          </Button>
        )}
        <Button
          className={{ root: 'border-red-400' }}
          onClick={() => onCloseWizard()}
          data={{ cy: 'cancel-session-creation' }}
          type="button"
        >
          <FontAwesomeIcon icon={faCancel} />
          <div>
            {editMode
              ? t('manage.questionForms.cancelEditing')
              : t('manage.questionForms.cancelCreation')}
          </div>
        </Button>
      </div>
      <Button
        disabled={isSubmitting || !stepValidity[activeStep] || continueDisabled}
        type="submit"
        data={{ cy: 'next-or-submit' }}
        className={{ root: 'w-max' }}
      >
        {lastStep ? (
          <FontAwesomeIcon icon={faSave} />
        ) : (
          <FontAwesomeIcon icon={faArrowRight} />
        )}
        {lastStep
          ? editMode
            ? t('shared.generic.save')
            : t('shared.generic.create')
          : t('shared.generic.continue')}
      </Button>
    </div>
  )
}

export default WizardNavigation
