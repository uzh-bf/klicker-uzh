import {
  faArrowLeft,
  faArrowRight,
  faCancel,
  faPlus,
  faSave,
} from '@fortawesome/free-solid-svg-icons'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { useWizardActions, useWizardCloseGuard } from './WizardLayout'

interface WizardNavigationProps {
  editMode: boolean
  isSubmitting: boolean
  stepValidity: boolean[]
  activeStep: number
  lastStep: boolean
  continueDisabled: boolean
  disabledReason?: string
  onDisabledReasonChange?: (reason?: string) => void
  onPrevStep?: () => void
  onCloseWizard: () => void
}

const disabledReasonId = 'activity-creation-disabled-reason'

function WizardNavigation({
  editMode,
  isSubmitting,
  stepValidity,
  activeStep,
  lastStep,
  continueDisabled,
  disabledReason,
  onDisabledReasonChange,
  onPrevStep,
  onCloseWizard,
}: WizardNavigationProps) {
  const t = useTranslations()
  const onDisabledReasonChangeRef = useRef(onDisabledReasonChange)
  const closeGuard = useWizardCloseGuard()
  const { onCreateElement } = useWizardActions()
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)

  useEffect(() => {
    onDisabledReasonChangeRef.current = onDisabledReasonChange
  }, [onDisabledReasonChange])

  useEffect(() => {
    onDisabledReasonChangeRef.current?.(lastStep ? disabledReason : undefined)
  }, [disabledReason, lastStep])

  useEffect(
    () => () => {
      onDisabledReasonChangeRef.current?.(undefined)
    },
    []
  )

  const requestClose = () => {
    if (closeGuard.forceClean || !closeGuard.isDirty()) {
      onCloseWizard()
      return
    }

    setConfirmCancelOpen(true)
  }

  return (
    <div
      className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2 pt-2"
      data-cy="activity-wizard-navigation"
    >
      <div className="flex flex-row items-center gap-2 justify-self-start">
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
          onClick={() => requestClose()}
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
      {onCreateElement ? (
        <Button
          className={{ root: 'h-8 justify-self-center font-bold' }}
          onClick={onCreateElement}
          data={{ cy: 'create-question' }}
          type="button"
        >
          <Button.Icon icon={faPlus} />
          <Button.Label>{t('manage.questionPool.createElement')}</Button.Label>
        </Button>
      ) : (
        <span />
      )}
      <div
        className={`flex flex-col items-end justify-self-end${lastStep && disabledReason ? ' gap-1' : ''}`}
      >
        {lastStep && (
          <div
            id={disabledReasonId}
            className={
              disabledReason ? 'text-sm text-red-600' : 'h-0 overflow-hidden'
            }
            data-cy={disabledReasonId}
          >
            {disabledReason}
          </div>
        )}
        <Button
          primary={lastStep}
          disabled={!stepValidity[activeStep] || continueDisabled}
          loading={isSubmitting}
          type="submit"
          data={{ cy: 'next-or-submit' }}
          className={{ root: 'h-8 w-max' }}
          aria-describedby={
            lastStep && disabledReason ? disabledReasonId : undefined
          }
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
      <Modal
        open={confirmCancelOpen}
        onClose={() => setConfirmCancelOpen(false)}
        title={t(
          editMode
            ? 'manage.activityWizard.confirmCancelEditTitle'
            : 'manage.activityWizard.confirmCancelTitle'
        )}
        primaryButtonStyle="primary"
        primaryLabel={t('manage.activityWizard.confirmCancelKeepEditing')}
        onPrimaryAction={() => setConfirmCancelOpen(false)}
        dataPrimaryAction={{ cy: 'keep-editing-activity-creation' }}
        secondaryLabel={t('manage.activityWizard.confirmCancelDiscard')}
        onSecondaryAction={onCloseWizard}
        dataSecondaryAction={{ cy: 'discard-activity-creation' }}
        className={{ content: 'max-w-lg' }}
      >
        <div className="mb-2 text-sm">
          {t(
            editMode
              ? 'manage.activityWizard.confirmCancelEditBody'
              : 'manage.activityWizard.confirmCancelBody'
          )}
        </div>
      </Modal>
    </div>
  )
}

export default WizardNavigation
