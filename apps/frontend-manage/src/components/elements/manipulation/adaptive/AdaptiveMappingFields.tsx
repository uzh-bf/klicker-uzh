import {
  deriveGuessingParameter,
  type AdaptiveItemType,
} from '@klicker-uzh/adaptive-learning'
import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import { FormLabel, Select, Switch } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import {
  AdaptiveMappingDraft,
  AdaptiveTreeAssignment,
  AdaptiveTreeDetail,
  getNodeBreadcrumb,
  getSubcompetenceLeaves,
} from './types'

function formatParameter(value: number | null | undefined): string {
  return typeof value === 'number' ? value.toFixed(2) : '-'
}

function AdaptiveMappingFields({
  tree,
  elementType,
  choiceCount,
  assignment,
  value,
  onChange,
  disabled,
}: {
  tree: AdaptiveTreeDetail
  elementType: ElementType
  choiceCount?: number | null
  assignment?: AdaptiveTreeAssignment
  value: AdaptiveMappingDraft
  onChange: (value: AdaptiveMappingDraft) => void
  disabled: boolean
}) {
  const t = useTranslations()
  const leaves = useMemo(() => getSubcompetenceLeaves(tree), [tree])
  const enabledCoverage = useMemo(
    () => tree.levelCoverages.filter((coverage) => coverage.enabled),
    [tree.levelCoverages]
  )
  const eligibleLeafIds = useMemo(
    () => new Set(enabledCoverage.map((coverage) => coverage.leafNodeId)),
    [enabledCoverage]
  )
  const availableLevelIds = useMemo(
    () =>
      new Set(
        enabledCoverage
          .filter((coverage) => coverage.leafNodeId === value.leafNodeId)
          .map((coverage) => coverage.levelId)
      ),
    [enabledCoverage, value.leafNodeId]
  )
  const selectedLevel = tree.levels.find((level) => level.id === value.levelId)
  const effectiveChoiceCount = assignment?.choiceCount ?? choiceCount
  const inferredGuessing =
    assignment?.c ??
    deriveGuessingParameter({
      type: elementType as AdaptiveItemType,
      choiceCount: effectiveChoiceCount,
    })

  if (leaves.length === 0 || eligibleLeafIds.size === 0) {
    return (
      <p className="text-sm text-gray-600">
        {t('manage.elements.adaptiveMapping.noAssignableLeaves')}
      </p>
    )
  }

  return (
    <div className="mt-3 space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <FormLabel
            id={`adaptive-mapping-leaf-${tree.id}`}
            required
            label={t('manage.elements.adaptiveMapping.leaf')}
            labelType="small"
          />
          <Select
            id={`adaptive-mapping-leaf-${tree.id}`}
            value={value.leafNodeId?.toString() ?? ''}
            placeholder={t('manage.elements.adaptiveMapping.selectLeaf')}
            disabled={disabled}
            items={leaves.map((leaf) => ({
              value: leaf.id.toString(),
              label: getNodeBreadcrumb(tree, leaf.id),
              disabled: !eligibleLeafIds.has(leaf.id),
              data: { cy: `adaptive-mapping-leaf-${tree.id}-${leaf.id}` },
            }))}
            onChange={(leafId) => {
              const parsedLeafId = Number(leafId)
              const firstLevel = tree.levels
                .toSorted((left, right) => left.order - right.order)
                .find((level) =>
                  enabledCoverage.some(
                    (coverage) =>
                      coverage.leafNodeId === parsedLeafId &&
                      coverage.levelId === level.id
                  )
                )

              onChange({
                ...value,
                leafNodeId: parsedLeafId,
                levelId: firstLevel?.id ?? null,
              })
            }}
            data={{ cy: `adaptive-mapping-leaf-select-${tree.id}` }}
            className={{ root: 'w-full', trigger: 'w-full' }}
          />
        </div>

        <div>
          <FormLabel
            id={`adaptive-mapping-level-${tree.id}`}
            required
            label={t('manage.elements.adaptiveMapping.level')}
            labelType="small"
          />
          <Select
            id={`adaptive-mapping-level-${tree.id}`}
            value={value.levelId?.toString() ?? ''}
            placeholder={t('manage.elements.adaptiveMapping.selectLevel')}
            disabled={disabled || value.leafNodeId === null}
            items={tree.levels
              .toSorted((left, right) => left.order - right.order)
              .map((level) => ({
                value: level.id.toString(),
                label: level.label,
                disabled: !availableLevelIds.has(level.id),
                data: {
                  cy: `adaptive-mapping-level-${tree.id}-${level.id}`,
                },
              }))}
            onChange={(levelId) => {
              onChange({ ...value, levelId: Number(levelId) })
            }}
            data={{ cy: `adaptive-mapping-level-select-${tree.id}` }}
            className={{ root: 'w-full', trigger: 'w-full' }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-3">
        <Switch
          size="sm"
          label={t('manage.elements.adaptiveMapping.enabled')}
          checked={value.enabled}
          disabled={disabled}
          onCheckedChange={(enabled) => onChange({ ...value, enabled })}
          data={{ cy: `adaptive-mapping-enabled-${tree.id}` }}
        />
        {elementType === ElementType.Numerical ? (
          <Switch
            size="sm"
            label={t('manage.elements.adaptiveMapping.enablePercentInput')}
            checked={value.enablePercentInput}
            disabled={disabled}
            onCheckedChange={(enablePercentInput) =>
              onChange({ ...value, enablePercentInput })
            }
            data={{ cy: `adaptive-mapping-percent-input-${tree.id}` }}
          />
        ) : null}
      </div>

      <dl
        className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-5"
        data-cy={`adaptive-mapping-parameters-${tree.id}`}
      >
        <div>
          <dt className="text-gray-600">
            {t('manage.elements.adaptiveMapping.selectedB')}
          </dt>
          <dd className="font-medium">
            {formatParameter(selectedLevel?.theta)}
          </dd>
        </div>
        <div>
          <dt className="text-gray-600">
            {t('manage.elements.adaptiveMapping.defaultA')}
          </dt>
          <dd className="font-medium">
            {formatParameter(tree.defaultDiscrimination)}
          </dd>
        </div>
        <div>
          <dt className="text-gray-600">
            {t('manage.elements.adaptiveMapping.effectiveA')}
          </dt>
          <dd className="font-medium">
            {formatParameter(assignment?.a ?? tree.defaultDiscrimination)}
          </dd>
        </div>
        <div>
          <dt className="text-gray-600">
            {t('manage.elements.adaptiveMapping.inferredC')}
          </dt>
          <dd className="font-medium">{formatParameter(inferredGuessing)}</dd>
        </div>
        <div>
          <dt className="text-gray-600">
            {t('manage.elements.adaptiveMapping.choiceCount')}
          </dt>
          <dd className="font-medium">{effectiveChoiceCount ?? '-'}</dd>
        </div>
      </dl>
    </div>
  )
}

export default AdaptiveMappingFields
