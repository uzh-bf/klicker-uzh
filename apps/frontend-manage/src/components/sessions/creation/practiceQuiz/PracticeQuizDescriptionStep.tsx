import { useFormikContext } from 'formik'
import { useTranslations } from 'next-intl'
import DescriptionStep from '../DescriptionStep'
import { MicroLearningFormValues } from '../MultistepWizard'
import { PracticeQuizWizardStepProps } from './PracticeQuizWizard'

function PracticeQuizDescriptionStep(props: PracticeQuizWizardStepProps) {
  const t = useTranslations()
  const { values } = useFormikContext<MicroLearningFormValues>()

  return (
    <DescriptionStep
      displayName={values.displayName}
      description={values.description}
      displayNameTooltip={t('manage.sessionForms.displayNameTooltip')}
      descriptionTooltip={t('manage.sessionForms.practiceQuizDescField')}
      dataDisplayName={{ cy: 'insert-practice-quiz-display-name' }}
      dataDescription={{ cy: 'insert-practice-quiz-description' }}
      validationSchema={props.validationSchema}
    />
  )
}

export default PracticeQuizDescriptionStep
