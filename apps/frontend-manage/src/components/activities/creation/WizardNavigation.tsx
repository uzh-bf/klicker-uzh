import {
  faArrowLeft,
  faArrowRight,
  faCancel,
  faSave,
} from '@fortawesome/free-solid-svg-icons'
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
    <div className="flex flex-none flex-row justify-between pt-2">
      <div className="flex flex-row items-center gap-2">
        {typeof onPrevStep !== 'undefined' && (
          <Button
            type="button"
            onClick={() => onPrevStep()}
            className={{ root: 'h-8' }}
            data={{ cy: 'back-activity-creation' }}
          >
            <Button.Icon icon={faArrowLeft} />
            <Button.Label>{t('shared.generic.back')}</Button.Label>
          </Button>
        )}
        <Button
          className={{ root: 'h-8 border-red-400' }}
          onClick={() => onCloseWizard()}
          data={{ cy: 'cancel-activity-creation' }}
          type="button"
        >
          <Button.Icon icon={faCancel} />
          <Button.Label>
            {editMode
              ? t('manage.elements.cancelEditing')
              : t('manage.elements.cancelCreation')}
          </Button.Label>
        </Button>
      </div>
      <Button
        primary={lastStep}
        disabled={!stepValidity[activeStep] || continueDisabled}
        loading={isSubmitting}
        type="submit"
        data={{ cy: 'next-or-submit' }}
        className={{ root: 'h-8 w-max' }}
      >
        <Button.Icon
          icon={lastStep ? faSave : faArrowRight}
          loading={isSubmitting}
        />
        <Button.Label>
          {lastStep
            ? editMode
              ? t('shared.generic.save')
              : t('shared.generic.create')
            : t('shared.generic.continue')}
        </Button.Label>
      </Button>
    </div>
  )
}

export default WizardNavigation
