import { normalizeEnabledRootWeights } from '@klicker-uzh/adaptive-learning'
import {
  AdaptiveNodeKind,
  AdaptivePracticeQuizSetupPreviewQuery,
  CompetenceTreeQuery,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Checkbox, Modal, NumberField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { AdaptivePracticeQuizConfigFormValues } from '../WizardLayout'

type CompetenceTreeData = NonNullable<CompetenceTreeQuery['competenceTree']>
type AdaptiveHierarchyNodeData = CompetenceTreeData['nodes'][number]
type AdaptiveHierarchyAssignmentData =
  CompetenceTreeData['elementAssignments'][number]
type AdaptiveEffectiveNodeData = NonNullable<
  AdaptivePracticeQuizSetupPreviewQuery['adaptivePracticeQuizSetupPreview']
>['nodes'][number]

function AdaptiveHierarchyOverrides({
  nodes,
  assignments,
  config,
  effectiveNodes,
  effectiveStateStale = false,
  onChange,
}: {
  nodes: AdaptiveHierarchyNodeData[]
  assignments: AdaptiveHierarchyAssignmentData[]
  config: AdaptivePracticeQuizConfigFormValues
  effectiveNodes?: AdaptiveEffectiveNodeData[]
  effectiveStateStale?: boolean
  onChange: (config: AdaptivePracticeQuizConfigFormValues) => void
}) {
  const t = useTranslations()
  const [pendingDisableId, setPendingDisableId] = useState<number | null>(null)
  const nodesByParent = useMemo(() => {
    const result = new Map<number | null, AdaptiveHierarchyNodeData[]>()
    for (const node of nodes) {
      const parentId = node.parentId ?? null
      result.set(parentId, [...(result.get(parentId) ?? []), node])
    }
    result.forEach((children) => {
      children.sort((a, b) => a.order - b.order || a.id - b.id)
    })
    return result
  }, [nodes])
  const overrideByNode = useMemo(
    () => new Map(config.nodeOverrides.map((value) => [value.nodeId, value])),
    [config.nodeOverrides]
  )
  const nodeById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes]
  )
  const effectiveByNode = useMemo(
    () => new Map(effectiveNodes?.map((value) => [value.id, value]) ?? []),
    [effectiveNodes]
  )
  const roots = nodesByParent.get(null) ?? []
  const normalizedRootWeights = useMemo(() => {
    const normalized = normalizeEnabledRootWeights(
      roots
        .filter((root) => overrideByNode.get(root.id)?.enabled !== false)
        .map((root) => ({
          key: root.id,
          weight: parseWeight(overrideByNode.get(root.id)?.weight, root.weight),
        }))
    )
    return normalized.ok
      ? new Map(
          normalized.normalized.map(({ key, weight }) => [key, weight * 100])
        )
      : new Map<number, number>()
  }, [overrideByNode, roots])

  const updateNode = (
    node: AdaptiveHierarchyNodeData,
    patch: Partial<{
      enabled: boolean
      weight: string
      questionCap: string
    }>
  ) => {
    const current = overrideByNode.get(node.id) ?? {
      nodeId: node.id,
      enabled: true,
      weight: '',
      questionCap: '',
    }
    onChange({
      ...config,
      nodeOverrides: [
        ...config.nodeOverrides.filter((value) => value.nodeId !== node.id),
        { ...current, ...patch },
      ],
    })
  }

  const getDescendantIds = (nodeId: number): number[] => {
    const directChildren = nodesByParent.get(nodeId) ?? []
    return directChildren.flatMap((child) => [
      child.id,
      ...getDescendantIds(child.id),
    ])
  }

  const pendingNode = nodes.find((node) => node.id === pendingDisableId)
  const pendingDescendantIds = pendingNode
    ? getDescendantIds(pendingNode.id)
    : []
  const pendingAffectedAssignmentCount = pendingNode
    ? assignments.filter(
        (assignment) =>
          assignment.leafNodeId === pendingNode.id ||
          pendingDescendantIds.includes(assignment.leafNodeId)
      ).length
    : 0

  const renderNode = (node: AdaptiveHierarchyNodeData): React.ReactNode => {
    const override = overrideByNode.get(node.id)
    const directEnabled = override?.enabled ?? true
    const effective = effectiveByNode.get(node.id)
    const effectiveEnabled =
      !effectiveStateStale && effective
        ? effective.effectiveEnabled
        : isNodeLocallyEnabled(node.id, nodeById, overrideByNode)
    const normalizedWeight =
      node.kind === AdaptiveNodeKind.Competence
        ? (normalizedRootWeights.get(node.id) ?? 0)
        : 0
    const descendants = nodesByParent.get(node.id) ?? []

    return (
      <div key={node.id} className="min-w-0 max-w-full">
        <div
          className="border-uzh-grey-80 grid min-h-12 w-full min-w-0 max-w-full items-center gap-2 border-b py-1.5 text-sm md:grid-cols-[minmax(12rem,1fr)_8rem_8rem_7rem]"
          style={{ paddingLeft: `${Math.min(node.depth, 5) * 1.25}rem` }}
          data-cy={`adaptive-node-${node.id}`}
        >
          <div className="min-w-0">
            <label
              className="sr-only"
              htmlFor={`adaptive-node-enabled-${node.id}`}
            >
              {node.name}
            </label>
            <Checkbox
              id={`adaptive-node-enabled-${node.id}`}
              checked={directEnabled}
              onCheck={() => {
                if (directEnabled) {
                  setPendingDisableId(node.id)
                } else {
                  updateNode(node, { enabled: true })
                }
              }}
              label={
                <span className="block min-w-0">
                  <span className="block truncate font-bold" title={node.name}>
                    {node.name}
                  </span>
                  <span className="text-xs text-slate-600">
                    {t(
                      node.kind === AdaptiveNodeKind.Competence
                        ? 'manage.activityWizard.adaptive.hierarchy.competence'
                        : 'manage.activityWizard.adaptive.hierarchy.subcompetence'
                    )}
                  </span>
                </span>
              }
              data={{ cy: `adaptive-node-enabled-${node.id}` }}
              className={{ label: 'min-w-0 flex-1' }}
            />
          </div>
          <div>
            {node.kind === AdaptiveNodeKind.Competence ? (
              <NumberField
                id={`adaptive-node-weight-${node.id}`}
                value={override?.weight || String(node.weight)}
                onChange={(weight) => updateNode(node, { weight })}
                min={0.01}
                precision={2}
                label={t('manage.activityWizard.adaptive.hierarchy.weight')}
                unit={`${normalizedWeight.toFixed(0)}%`}
                disabled={!directEnabled}
                data={{ cy: `adaptive-node-weight-${node.id}` }}
                className={{ input: 'h-8' }}
              />
            ) : null}
          </div>
          <NumberField
            id={`adaptive-node-cap-${node.id}`}
            value={override?.questionCap ?? ''}
            onChange={(questionCap) => updateNode(node, { questionCap })}
            min={1}
            max={1000}
            precision={0}
            label={t('manage.activityWizard.adaptive.hierarchy.cap')}
            disabled={!directEnabled}
            data={{ cy: `adaptive-node-cap-${node.id}` }}
            className={{ input: 'h-8' }}
          />
          <div
            className={
              effectiveEnabled
                ? 'text-xs font-bold text-green-700'
                : 'text-xs font-bold text-red-700'
            }
            data-cy={`adaptive-node-effective-${node.id}`}
          >
            {t(
              effectiveEnabled
                ? 'manage.activityWizard.adaptive.hierarchy.effectiveEnabled'
                : 'manage.activityWizard.adaptive.hierarchy.effectiveDisabled'
            )}
          </div>
        </div>
        {descendants.map(renderNode)}
      </div>
    )
  }

  return (
    <section
      className="min-w-0 max-w-full"
      data-cy="adaptive-hierarchy-overrides"
    >
      <div className="mb-2 flex min-w-0 items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="font-bold">
            {t('manage.activityWizard.adaptive.hierarchy.title')}
          </div>
          <div className="text-sm text-slate-600">
            {t('manage.activityWizard.adaptive.hierarchy.directIntent')}
          </div>
        </div>
        <div className="hidden text-xs font-bold md:block">
          {t('manage.activityWizard.adaptive.hierarchy.effectiveState')}
        </div>
      </div>
      <div className="border-uzh-grey-80 min-w-0 max-w-full rounded-md border border-solid">
        {roots.map(renderNode)}
      </div>

      {pendingNode ? (
        <Modal
          open
          title={t(
            'manage.activityWizard.adaptive.hierarchy.disableConfirmTitle'
          )}
          onClose={() => setPendingDisableId(null)}
          dataCloseButton={{ cy: 'cancel-adaptive-node-disable' }}
          className={{ content: 'max-w-lg' }}
        >
          <div className="flex flex-col gap-4">
            <p>
              {t(
                'manage.activityWizard.adaptive.hierarchy.disableConfirmDescription',
                {
                  name: pendingNode.name,
                  descendants: pendingDescendantIds.length,
                  assignments: pendingAffectedAssignmentCount,
                }
              )}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                onClick={() => setPendingDisableId(null)}
                data={{ cy: 'keep-adaptive-node-enabled' }}
              >
                <Button.Label>{t('shared.generic.cancel')}</Button.Label>
              </Button>
              <Button
                destructive
                type="button"
                onClick={() => {
                  updateNode(pendingNode, { enabled: false })
                  setPendingDisableId(null)
                }}
                data={{ cy: 'confirm-adaptive-node-disable' }}
              >
                <Button.Label>
                  {t('manage.activityWizard.adaptive.hierarchy.disableAction')}
                </Button.Label>
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </section>
  )
}

function parseWeight(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function isNodeLocallyEnabled(
  nodeId: number,
  nodeById: Map<number, AdaptiveHierarchyNodeData>,
  overrideById: Map<
    number,
    AdaptivePracticeQuizConfigFormValues['nodeOverrides'][number]
  >
): boolean {
  const visited = new Set<number>()
  let current = nodeById.get(nodeId)

  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    if (overrideById.get(current.id)?.enabled === false) return false
    current =
      typeof current.parentId === 'number'
        ? nodeById.get(current.parentId)
        : undefined
  }

  return true
}

export default AdaptiveHierarchyOverrides
