import { useTranslations } from 'next-intl'
import DescriptionStep from '../DescriptionStep'
import { PollWizardStepProps } from './PollWizard'

function PollDescriptionStep({
  editMode,
  formRef,
  formData,
  continueDisabled,
  activeStep,
  stepValidity,
  validationSchema,
  setStepValidity,
  onNextStep,
  onPrevStep,
  closeWizard,
}: PollWizardStepProps) {
  const t = useTranslations()

  return (
    <DescriptionStep
      displayNameTooltip={t('manage.activityWizard.displayNameTooltip')}
      descriptionTooltip={t('manage.activityWizard.pollDescField')}
      dataDisplayName={{ cy: 'insert-poll-display-name' }}
      dataDescription={{ cy: 'insert-poll-description' }}
      validationSchema={validationSchema}
      editMode={editMode}
      formRef={formRef}
      formData={formData}
      continueDisabled={continueDisabled}
      activeStep={activeStep}
      stepValidity={stepValidity}
      setStepValidity={setStepValidity}
      onNextStep={onNextStep}
      onPrevStep={onPrevStep}
      closeWizard={closeWizard}
    />
  )
}

export default PollDescriptionStep
