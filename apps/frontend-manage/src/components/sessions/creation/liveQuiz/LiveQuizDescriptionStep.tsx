import { useFormikContext } from 'formik'
import { useTranslations } from 'next-intl'
import DescriptionStep from '../DescriptionStep'
import { LiveSessionFormValues } from '../MultistepWizard'
import { LiveQuizWizardStepProps } from './LiveSessionWizard'

function LiveQuizDescriptionStep(props: LiveQuizWizardStepProps) {
  const t = useTranslations()
  const { values } = useFormikContext<LiveSessionFormValues>()

  return (
    <DescriptionStep
      displayName={values.displayName}
      description={values.description}
      displayNameTooltip={t('manage.sessionForms.displayNameTooltip')}
      descriptionTooltip={t('manage.sessionForms.liveQuizDescField')}
      dataDisplayName={{ cy: 'insert-live-display-name' }}
      dataDescription={{ cy: 'insert-live-description' }}
      validationSchema={props.validationSchema}
    />
  )
}

export default LiveQuizDescriptionStep
