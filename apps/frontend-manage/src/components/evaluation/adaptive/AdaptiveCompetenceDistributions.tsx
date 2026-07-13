import {
  faChevronDown,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons'
import { AdaptiveEstimateNodeKind } from '@klicker-uzh/graphql/dist/ops'
import { Button, H3, H4 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import AdaptiveDistributionBars from './AdaptiveDistributionBars'
import { AdaptiveCohortDistribution } from './types'

function NestedDistribution({
  distribution,
  childrenByParent,
}: {
  distribution: AdaptiveCohortDistribution
  childrenByParent: Map<number | null, AdaptiveCohortDistribution[]>
}) {
  const t = useTranslations()
  const children =
    typeof distribution.nodeId === 'number'
      ? (childrenByParent.get(distribution.nodeId) ?? [])
      : []
  const [expanded, setExpanded] = useState(distribution.depth === 0)
  const nodeId = distribution.nodeId ?? 'overall'

  return (
    <div data-cy={`adaptive-evaluation-node-${nodeId}`}>
      <div className="flex min-w-0 items-start gap-2">
        {children.length > 0 ? (
          <Button
            basic
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-label={t(
              expanded
                ? 'manage.evaluation.adaptive.collapseNode'
                : 'manage.evaluation.adaptive.expandNode',
              { node: distribution.nodeName }
            )}
            className={{ root: 'h-8 w-8 shrink-0 p-0' }}
            data={{ cy: `adaptive-evaluation-node-toggle-${nodeId}` }}
          >
            <Button.Icon
              withoutLabel
              icon={expanded ? faChevronDown : faChevronRight}
            />
          </Button>
        ) : (
          <span className="h-8 w-8 shrink-0" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <H4 className={{ root: 'mb-2 mt-1 break-words' }}>
            {distribution.nodeName}
          </H4>
          <AdaptiveDistributionBars
            distribution={distribution}
            dataCy={`adaptive-evaluation-distribution-${nodeId}`}
          />
        </div>
      </div>

      {expanded && children.length > 0 ? (
        <div className="ml-4 mt-4 space-y-5 border-l border-gray-200 pl-2 sm:ml-8 sm:pl-4">
          {children.map((child) => (
            <NestedDistribution
              key={child.nodeId}
              distribution={child}
              childrenByParent={childrenByParent}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function AdaptiveCompetenceDistributions({
  distributions,
}: {
  distributions: AdaptiveCohortDistribution[]
}) {
  const t = useTranslations()
  const roots = distributions
    .filter(
      (distribution) =>
        distribution.nodeKind === AdaptiveEstimateNodeKind.Competence &&
        distribution.parentNodeId === null
    )
    .toSorted(
      (left, right) =>
        left.order - right.order || left.nodeName.localeCompare(right.nodeName)
    )
  const childrenByParent = useMemo(() => {
    const result = new Map<number | null, AdaptiveCohortDistribution[]>()

    for (const distribution of distributions) {
      if (distribution.nodeKind !== AdaptiveEstimateNodeKind.Subcompetence) {
        continue
      }

      const parentNodeId = distribution.parentNodeId ?? null
      const siblings = result.get(parentNodeId) ?? []
      siblings.push(distribution)
      result.set(parentNodeId, siblings)
    }

    result.forEach((siblings) => {
      siblings.sort(
        (left, right) =>
          left.order - right.order ||
          left.nodeName.localeCompare(right.nodeName)
      )
    })

    return result
  }, [distributions])

  return (
    <section
      className="border-t border-gray-200 py-6"
      data-cy="adaptive-evaluation-root-distributions"
    >
      <H3>{t('manage.evaluation.adaptive.rootDistributions')}</H3>
      {roots.length > 0 ? (
        <div className="mt-4 space-y-8">
          {roots.map((root) => (
            <NestedDistribution
              key={root.nodeId}
              distribution={root}
              childrenByParent={childrenByParent}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-600">
          {t('manage.evaluation.adaptive.noDistributionData')}
        </p>
      )}
    </section>
  )
}

export default AdaptiveCompetenceDistributions
