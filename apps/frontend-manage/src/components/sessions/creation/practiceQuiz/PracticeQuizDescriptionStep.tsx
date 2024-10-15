import { useTranslations } from 'next-intl'
import DescriptionStep from '../DescriptionStep'
import { PracticeQuizWizardStepProps } from './PracticeQuizWizard'

function PracticeQuizDescriptionStep({
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
}: PracticeQuizWizardStepProps) {
  const t = useTranslations()

  return (
    <DescriptionStep
      displayNameTooltip={t('manage.sessionForms.displayNameTooltip')}
      descriptionTooltip={t('manage.sessionForms.practiceQuizDescField')}
      dataDisplayName={{ cy: 'insert-practice-quiz-display-name' }}
      dataDescription={{ cy: 'insert-practice-quiz-description' }}
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

export default PracticeQuizDescriptionStep
