import { useFormikContext } from 'formik'
import { useTranslations } from 'next-intl'
import DescriptionStep from '../DescriptionStep'
import { MicroLearningFormValues } from '../MultistepWizard'
import { MicroLearningWizardStepProps } from './MicroLearningWizard'

function MicroLearningDescriptionStep(props: MicroLearningWizardStepProps) {
  const t = useTranslations()
  const { values } = useFormikContext<MicroLearningFormValues>()

  return (
    <DescriptionStep
      displayName={values.displayName}
      description={values.description}
      displayNameTooltip={t('manage.sessionForms.displayNameTooltip')}
      descriptionTooltip={t('manage.sessionForms.microlearningDescField')}
      dataDisplayName={{ cy: 'insert-microlearning-display-name' }}
      dataDescription={{ cy: 'insert-microlearning-description' }}
      validationSchema={props.validationSchema}
    />
  )
}

export default MicroLearningDescriptionStep
