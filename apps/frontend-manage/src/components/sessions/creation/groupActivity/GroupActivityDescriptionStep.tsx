import { useTranslations } from 'next-intl'
import DescriptionStep from '../DescriptionStep'
import { GroupActivityWizardStepProps } from './GroupActivityWizard'

function GroupActivityDescriptionStep({
  editMode,
  formRef,
  formData,
  continueDisabled,
  activeStep,
  stepValidity,
  validationSchema,
  setStepValidity,
  onNextStep,
  closeWizard,
}: GroupActivityWizardStepProps) {
  const t = useTranslations()

  return (
    <DescriptionStep
      descriptionRequired
      displayNameTooltip={t('manage.sessionForms.displayNameTooltip')}
      descriptionTooltip={t('manage.sessionForms.groupActivityDescField')}
      descriptionLabel={t('shared.generic.taskDescription')}
      dataDisplayName={{ cy: 'insert-groupactivity-display-name' }}
      dataDescription={{ cy: 'insert-groupactivity-description' }}
      validationSchema={validationSchema}
      editMode={editMode}
      formRef={formRef}
      formData={formData}
      continueDisabled={continueDisabled}
      activeStep={activeStep}
      stepValidity={stepValidity}
      setStepValidity={setStepValidity}
      onNextStep={onNextStep}
      closeWizard={closeWizard}
    />
  )
}

export default GroupActivityDescriptionStep
