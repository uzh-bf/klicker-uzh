import { Markdown } from '@klicker-uzh/markdown'
import { H2, H3, NewFormikTextField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import EditorField from './EditorField'

interface DescriptionStepProps {
  displayName: string
  description?: string
  displayNameTooltip: string
  descriptionTooltip: string
  descriptionLabel?: string
  dataDisplayName?: { test?: string; cy?: string }
  dataDescription?: { test?: string; cy?: string }
  descriptionRequired?: boolean
  [key: string]: any
}

function DescriptionStep({
  displayName,
  description,
  displayNameTooltip,
  descriptionTooltip,
  descriptionLabel,
  dataDisplayName,
  dataDescription,
  descriptionRequired = false,
}: DescriptionStepProps) {
  const t = useTranslations()

  return (
    <div className="flex flex-row -mt-2">
      <div className="flex-1 w-3/5 md:mr-6">
        <NewFormikTextField
          required
          autoComplete="off"
          name="displayName"
          label={t('manage.sessionForms.displayName')}
          tooltip={displayNameTooltip}
          className={{
            root: 'mb-1 w-full md:w-1/2',
            tooltip: 'z-20',
            label: 'text-base mb-0.5 mt-0',
          }}
          data-test={dataDisplayName?.test}
          data-cy={dataDisplayName?.cy}
        />
        <EditorField
          // key={fieldName.value}
          required={descriptionRequired}
          label={descriptionLabel ?? t('shared.generic.description')}
          tooltip={descriptionTooltip}
          fieldName="description"
          showToolbarOnFocus={false}
          className={{ label: 'text-base mb-0.5' }}
          data={dataDescription}
        />
      </div>
      <div className="hidden md:flex flex-col gap-1 w-2/5">
        <H2>{t('shared.generic.preview')}</H2>
        <div className="h-full w-full border border-solid rounded-md overflow-y-auto">
          <div className="p-4">
            <H3>{displayName}</H3>
            <Markdown content={description} className={{ root: 'h-24' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default DescriptionStep
