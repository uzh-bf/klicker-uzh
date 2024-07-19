import { Markdown } from '@klicker-uzh/markdown'
import { H2, H3, NewFormikTextField } from '@uzh-bf/design-system'
import { useFormikContext } from 'formik'
import { useTranslations } from 'next-intl'
import EditorField from '../EditorField'
import { LiveSessionFormValues } from '../MultistepWizard'
import { LiveQuizWizardStepProps } from './LiveSessionWizard'

function LiveQuizDescriptionStep(_: LiveQuizWizardStepProps) {
  const t = useTranslations()
  const { values } = useFormikContext<LiveSessionFormValues>()

  return (
    <div className="flex flex-row -mt-2">
      <div className="flex-1 w-3/5 md:mr-6">
        <NewFormikTextField
          required
          autoComplete="off"
          name="displayName"
          label={t('manage.sessionForms.displayName')}
          tooltip={t('manage.sessionForms.displayNameTooltip')}
          className={{
            root: 'mb-1 w-full md:w-1/2',
            tooltip: 'z-20',
            label: 'text-base mb-0.5 mt-0',
          }}
          data-cy="insert-live-display-name"
        />
        <EditorField
          // key={fieldName.value}
          label={t('shared.generic.description')}
          tooltip={t('manage.sessionForms.liveQuizDescField')}
          fieldName="description"
          showToolbarOnFocus={false}
          className={{ label: 'text-base mb-0.5' }}
        />
      </div>
      <div className="hidden md:flex flex-col gap-1 w-2/5">
        <H2>{t('shared.generic.preview')}</H2>
        <div className="h-full w-full border border-solid rounded-md overflow-y-auto">
          <div className="p-4">
            <H3>{values.displayName}</H3>
            <Markdown
              content={values.description}
              className={{ root: 'h-24' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default LiveQuizDescriptionStep
