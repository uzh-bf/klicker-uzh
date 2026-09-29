import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import { Button, FormLabel, Select, Switch } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import {
  AdaptiveMappingDraft,
  AdaptiveTreeAssignment,
  AdaptiveTreeDetail,
  getNodeBreadcrumb,
  getSubcompetenceLeaves,
} from './types'

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
  const mappedLeafIds = useMemo(
    () =>
      Array.from(
        new Set(
          [value.leafNodeId, ...value.additionalLeafNodeIds].filter(
            (leafId): leafId is number => typeof leafId === 'number'
          )
        )
      ),
    [value.additionalLeafNodeIds, value.leafNodeId]
  )
  const availableLevelIds = useMemo(
    () =>
      new Set(
        tree.levels
          .filter((level) =>
            mappedLeafIds.every((leafId) =>
              enabledCoverage.some(
                (coverage) =>
                  coverage.leafNodeId === leafId &&
                  coverage.levelId === level.id
              )
            )
          )
          .map((level) => level.id)
      ),
    [enabledCoverage, mappedLeafIds, tree.levels]
  )
  const additionalLeaves = useMemo(
    () =>
      leaves.filter(
        (leaf) =>
          leaf.id !== value.leafNodeId &&
          (value.additionalLeafNodeIds.includes(leaf.id) ||
            (eligibleLeafIds.has(leaf.id) &&
              typeof value.levelId === 'number' &&
              enabledCoverage.some(
                (coverage) =>
                  coverage.leafNodeId === leaf.id &&
                  coverage.levelId === value.levelId
              )))
      ),
    [
      eligibleLeafIds,
      enabledCoverage,
      leaves,
      value.additionalLeafNodeIds,
      value.leafNodeId,
      value.levelId,
    ]
  )
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
              const additionalLeafNodeIds = value.additionalLeafNodeIds.filter(
                (nodeId) => nodeId !== parsedLeafId
              )
              const nextLeafIds = [parsedLeafId, ...additionalLeafNodeIds]
              const firstLevel = tree.levels
                .toSorted((left, right) => left.order - right.order)
                .find((level) =>
                  nextLeafIds.every((targetLeafId) =>
                    enabledCoverage.some(
                      (coverage) =>
                        coverage.leafNodeId === targetLeafId &&
                        coverage.levelId === level.id
                    )
                  )
                )

              onChange({
                ...value,
                leafNodeId: parsedLeafId,
                levelId: firstLevel?.id ?? null,
                additionalLeafNodeIds,
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
            label={t('manage.elements.adaptiveMapping.expectedDifficulty')}
            labelType="small"
            tooltip={t(
              'manage.elements.adaptiveMapping.expectedDifficultyTooltip'
            )}
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

      {value.additionalLeafNodeIds.length > 0 ? (
        <div className="space-y-3">
          <FormLabel
            required={false}
            id={`adaptive-mapping-additional-leaves-${tree.id}`}
            label={t('manage.elements.adaptiveMapping.additionalLeaves')}
            labelType="small"
          />
          {value.additionalLeafNodeIds.map((selectedLeafId, index) => (
            <div
              key={`${selectedLeafId}-${index}`}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <Select
                id={`adaptive-mapping-additional-leaf-${tree.id}-${index}`}
                value={selectedLeafId.toString()}
                disabled={disabled || value.levelId === null}
                items={additionalLeaves.map((leaf) => ({
                  value: leaf.id.toString(),
                  label: getNodeBreadcrumb(tree, leaf.id),
                  disabled:
                    leaf.id !== selectedLeafId &&
                    value.additionalLeafNodeIds.includes(leaf.id),
                }))}
                onChange={(leafId) => {
                  const nextLeafId = Number(leafId)
                  onChange({
                    ...value,
                    additionalLeafNodeIds: value.additionalLeafNodeIds.map(
                      (currentLeafId) =>
                        currentLeafId === selectedLeafId
                          ? nextLeafId
                          : currentLeafId
                    ),
                  })
                }}
                data={{
                  cy: `adaptive-mapping-additional-leaf-select-${tree.id}-${index}`,
                }}
                className={{ root: 'min-w-0 flex-1', trigger: 'w-full' }}
              />
              <Button
                destructive
                onClick={() =>
                  onChange({
                    ...value,
                    additionalLeafNodeIds: value.additionalLeafNodeIds.filter(
                      (leafId) => leafId !== selectedLeafId
                    ),
                  })
                }
                disabled={disabled}
                data={{
                  cy: `adaptive-mapping-additional-leaf-remove-${tree.id}-${index}`,
                }}
              >
                <Button.Label>
                  {t('manage.elements.adaptiveMapping.removeAdditionalLeaf')}
                </Button.Label>
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      <div className="space-y-1">
        <Button
          onClick={() => {
            const firstAvailable = additionalLeaves.find(
              (leaf) => !value.additionalLeafNodeIds.includes(leaf.id)
            )
            if (!firstAvailable) return
            onChange({
              ...value,
              additionalLeafNodeIds: [
                ...value.additionalLeafNodeIds,
                firstAvailable.id,
              ],
            })
          }}
          disabled={
            disabled ||
            value.levelId === null ||
            additionalLeaves.every((leaf) =>
              value.additionalLeafNodeIds.includes(leaf.id)
            )
          }
          data={{ cy: `adaptive-mapping-additional-leaf-add-${tree.id}` }}
        >
          <Button.Label>
            {t('manage.elements.adaptiveMapping.addAdditionalLeaf')}
          </Button.Label>
        </Button>
        <p className="text-xs text-gray-600">
          {t('manage.elements.adaptiveMapping.additionalLeavesDraftOnly')}
        </p>
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
      </div>
    </div>
  )
}

export default AdaptiveMappingFields
