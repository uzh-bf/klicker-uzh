import { useTranslations } from 'next-intl'
import DescriptionStep from '../DescriptionStep'
import { MicroLearningWizardStepProps } from './MicroLearningWizard'

function MicroLearningDescriptionStep({
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
}: MicroLearningWizardStepProps) {
  const t = useTranslations()

  return (
    <DescriptionStep
      displayNameTooltip={t('manage.sessionForms.displayNameTooltip')}
      descriptionTooltip={t('manage.sessionForms.microlearningDescField')}
      dataDisplayName={{ cy: 'insert-microlearning-display-name' }}
      dataDescription={{ cy: 'insert-microlearning-description' }}
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

export default MicroLearningDescriptionStep
