import { useFormikContext } from 'formik'
import { useTranslations } from 'next-intl'
import DescriptionStep from '../DescriptionStep'
import { MicroLearningFormValues } from '../MultistepWizard'
import { GroupActivityWizardStepProps } from './GroupActivityWizard'

function GroupActivityDescriptionStep(props: GroupActivityWizardStepProps) {
  const t = useTranslations()
  const { values } = useFormikContext<MicroLearningFormValues>()

  return (
    <DescriptionStep
      descriptionRequired
      displayName={values.displayName}
      description={values.description}
      displayNameTooltip={t('manage.sessionForms.displayNameTooltip')}
      descriptionTooltip={t('manage.sessionForms.groupActivityDescField')}
      descriptionLabel={t('shared.generic.taskDescription')}
      dataDisplayName={{ cy: 'insert-groupactivity-display-name' }}
      dataDescription={{ cy: 'insert-groupactivity-description' }}
      validationSchema={props.validationSchema}
    />
  )
}

export default GroupActivityDescriptionStep
