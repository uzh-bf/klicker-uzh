import { NumberField, TextareaField, TextField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { CompetenceTreeForm } from './types'

function MetadataEditor({
  form,
  onChange,
  metadataDisabled,
  structureDisabled,
}: {
  form: CompetenceTreeForm
  onChange: (form: CompetenceTreeForm) => void
  metadataDisabled: boolean
  structureDisabled: boolean
}) {
  const t = useTranslations()

  return (
    <section
      id="competence-tree-section-metadata"
      tabIndex={-1}
      className="focus:outline-primary-80 scroll-mt-4 border-t border-slate-300 py-5 focus:outline focus:outline-2"
      data-cy="competence-tree-metadata"
    >
      <h2 className="mb-1 text-lg font-semibold">
        {t('manage.competenceTree.metadataTitle')}
      </h2>
      <p className="mb-4 text-sm text-slate-600">
        {t('manage.competenceTree.metadataDescription')}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          id="competence-tree-name"
          value={form.name}
          onChange={(name) => onChange({ ...form, name })}
          label={t('manage.competenceTree.internalName')}
          disabled={metadataDisabled}
          required
          data={{ cy: 'competence-tree-name' }}
        />
        <TextField
          id="competence-tree-display-name"
          value={form.displayName}
          onChange={(displayName) => onChange({ ...form, displayName })}
          label={t('manage.competenceTree.displayName')}
          disabled={metadataDisabled}
          required
          data={{ cy: 'competence-tree-display-name' }}
        />
      </div>
      <div className="mt-4">
        <TextareaField
          id="competence-tree-description"
          value={form.description}
          onChange={(description) => onChange({ ...form, description })}
          label={t('manage.competenceTree.description')}
          disabled={metadataDisabled}
          data={{ cy: 'competence-tree-description' }}
          className={{ input: 'min-h-20' }}
        />
      </div>

      <h3 className="mb-3 mt-6 text-base font-semibold">
        {t('manage.competenceTree.structureSettings')}
      </h3>
      <div className="max-w-sm">
        <NumberField
          id="competence-tree-max-depth"
          value={form.maxDepth}
          onChange={(value) =>
            onChange({ ...form, maxDepth: Number(value || 1) })
          }
          min={1}
          max={5}
          precision={0}
          label={t('manage.competenceTree.maxDepth')}
          disabled={structureDisabled}
          data={{ cy: 'competence-tree-max-depth' }}
        />
      </div>
    </section>
  )
}

export default MetadataEditor
