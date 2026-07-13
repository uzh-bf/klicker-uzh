import { AdaptiveLevelMappingRule } from '@klicker-uzh/graphql/dist/ops'
import {
  NumberField,
  Select,
  TextareaField,
  TextField,
} from '@uzh-bf/design-system'
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
          value={form.name}
          onChange={(name) => onChange({ ...form, name })}
          label={t('manage.competenceTree.internalName')}
          disabled={metadataDisabled}
          required
          data={{ cy: 'competence-tree-name' }}
        />
        <TextField
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
          value={form.description}
          onChange={(description) => onChange({ ...form, description })}
          label={t('manage.competenceTree.description')}
          disabled={metadataDisabled}
          data={{ cy: 'competence-tree-description' }}
          className={{ input: 'min-h-20' }}
        />
      </div>

      <h3 className="mb-3 mt-6 text-base font-semibold">
        {t('manage.competenceTree.modelSettings')}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <NumberField
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
        <NumberField
          value={form.thetaMin}
          onChange={(value) =>
            onChange({ ...form, thetaMin: Number(value || 0) })
          }
          min={-10}
          max={10}
          precision={2}
          label={t('manage.competenceTree.thetaMin')}
          disabled={structureDisabled}
          data={{ cy: 'competence-tree-theta-min' }}
        />
        <NumberField
          value={form.thetaMax}
          onChange={(value) =>
            onChange({ ...form, thetaMax: Number(value || 0) })
          }
          min={-10}
          max={10}
          precision={2}
          label={t('manage.competenceTree.thetaMax')}
          disabled={structureDisabled}
          data={{ cy: 'competence-tree-theta-max' }}
        />
        <NumberField
          value={form.defaultDiscrimination}
          onChange={(value) =>
            onChange({ ...form, defaultDiscrimination: Number(value || 0) })
          }
          min={0}
          max={10}
          precision={2}
          label={t('manage.competenceTree.defaultDiscrimination')}
          disabled={structureDisabled}
          data={{ cy: 'competence-tree-default-discrimination' }}
        />
        <div>
          <label className="mb-1 block text-sm font-medium">
            {t('manage.competenceTree.mappingRule')}
          </label>
          <Select
            value={form.levelMappingRule}
            onChange={(levelMappingRule) =>
              onChange({
                ...form,
                levelMappingRule: levelMappingRule as AdaptiveLevelMappingRule,
              })
            }
            disabled={structureDisabled}
            items={[
              {
                value: AdaptiveLevelMappingRule.Nearest,
                label: t('manage.competenceTree.mappingNearest'),
              },
              {
                value: AdaptiveLevelMappingRule.Mastery,
                label: t('manage.competenceTree.mappingMastery'),
              },
            ]}
            data={{ cy: 'competence-tree-mapping-rule' }}
            className={{ trigger: 'h-9 w-full' }}
          />
        </div>
      </div>
    </section>
  )
}

export default MetadataEditor
