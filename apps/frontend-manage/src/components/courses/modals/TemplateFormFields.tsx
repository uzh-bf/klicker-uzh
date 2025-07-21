import { FormikTextField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import EditorField from '../../activities/creation/EditorField'

function TemplateFormFields() {
  const t = useTranslations()

  return (
    <div className="flex flex-col gap-2.5">
      <FormikTextField
        required
        name="name"
        label={t('shared.generic.name')}
        tooltip={t('manage.template.nameTooltip')}
        data={{ cy: 'template-name' }}
      />
      <EditorField
        required
        showToolbarOnFocus={false}
        fieldName="description"
        label={t('shared.generic.description')}
        placeholder={t('manage.template.descriptionPlaceholder')}
        tooltip={t('manage.template.descriptionTooltip')}
        data={{ cy: 'template-description' }}
        className={{ input: { editor: 'leading-4! h-32' } }}
      />
      <EditorField
        required
        showToolbarOnFocus={false}
        fieldName="instructions"
        label={t('shared.generic.instructions')}
        placeholder={t('manage.template.instructionsPlaceholder')}
        tooltip={t('manage.template.instructionsTooltip')}
        data={{ cy: 'template-instructions' }}
        className={{ input: { editor: 'leading-4! h-32' } }}
      />
    </div>
  )
}

export default TemplateFormFields
