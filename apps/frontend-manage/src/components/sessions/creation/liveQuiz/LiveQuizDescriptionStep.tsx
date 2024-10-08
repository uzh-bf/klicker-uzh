import { useTranslations } from 'next-intl'
import DescriptionStep from '../DescriptionStep'
import { LiveQuizWizardStepProps } from './LiveSessionWizard'

function LiveQuizDescriptionStep({
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
}: LiveQuizWizardStepProps) {
  const t = useTranslations()

  return (
    <DescriptionStep
      displayNameTooltip={t('manage.sessionForms.displayNameTooltip')}
      descriptionTooltip={t('manage.sessionForms.liveQuizDescField')}
      dataDisplayName={{ cy: 'insert-live-display-name' }}
      dataDescription={{ cy: 'insert-live-description' }}
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

export default LiveQuizDescriptionStep
