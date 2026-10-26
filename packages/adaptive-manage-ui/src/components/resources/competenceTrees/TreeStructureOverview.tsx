import {
  faSitemap,
  faLayerGroup,
  faListCheck,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { H3 } from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import { getChildren, getNormalizedRootWeights } from './treeHelpers'
import type { CompetenceTreeForm, CompetenceTreeNodeForm } from './types'

function TreeStructureOverview({ form }: { form: CompetenceTreeForm }) {
  const t = useTranslations()
  const formatter = useFormatter()
  const roots = getChildren(form.nodes, null)
  const weights = getNormalizedRootWeights(form.nodes)
  function renderNode(node: CompetenceTreeNodeForm) {
    const children = getChildren(form.nodes, node.key)
    return (
      <li key={node.key} className="relative border-l border-gray-200 pl-5">
        <span
          className="absolute left-0 top-5 w-3 border-t border-gray-200"
          aria-hidden="true"
        />
        <div className="py-2">
          <div className="break-words text-sm font-medium">{node.name}</div>
          {node.description && (
            <p className="mt-1 text-sm text-gray-500">{node.description}</p>
          )}
        </div>
        {children.length > 0 && <ul>{children.map(renderNode)}</ul>}
      </li>
    )
  }
  const stats = [
    { label: 'overviewRoots', value: roots.length, icon: faSitemap },
    {
      label: 'overviewChildren',
      value: form.nodes.length - roots.length,
      icon: faLayerGroup,
    },
    {
      label: 'overviewElements',
      value: form.assignments.length,
      icon: faListCheck,
    },
  ] as const
  return (
    <section data-cy="competence-tree-structure-overview">
      {form.description && (
        <p className="mb-5 max-w-3xl text-sm text-gray-600">
          {form.description}
        </p>
      )}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-3 rounded-md border border-solid bg-gray-50 px-4 py-3"
          >
            <FontAwesomeIcon
              icon={stat.icon}
              className="h-5 w-5 text-gray-500"
            />
            <div>
              <div className="text-xl font-semibold tabular-nums">
                {formatter.number(stat.value)}
              </div>
              <div className="text-sm text-gray-600">
                {t(`manage.competenceTree.${stat.label}`)}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mb-4">
        <H3>{t('manage.competenceTree.structure')}</H3>
        <p className="text-sm text-gray-600">
          {t('manage.competenceTree.weightExplanation')}
        </p>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {roots.map((root) => {
          const weight = weights.get(root.key) ?? 0
          return (
            <article
              key={root.key}
              className="overflow-hidden rounded-md border border-solid bg-white shadow-sm"
              data-cy={`competence-overview-${root.key}`}
            >
              <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="min-w-0 break-words font-semibold">
                    {root.name}
                  </h3>
                  <span className="shrink-0 font-semibold tabular-nums text-primary-100">
                    {formatter.number(weight, {
                      style: 'percent',
                      maximumFractionDigits: 1,
                    })}
                  </span>
                </div>
                {root.description && (
                  <p className="mt-1 text-sm text-gray-600">
                    {root.description}
                  </p>
                )}
                <div
                  className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-200"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-primary-100"
                    style={{
                      width: `${Math.max(0, Math.min(1, weight)) * 100}%`,
                    }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-gray-500">
                  {t('manage.competenceTree.overviewWeightHint')}
                </p>
              </div>
              <ul className="px-4 py-3">
                {getChildren(form.nodes, root.key).map(renderNode)}
              </ul>
            </article>
          )
        })}
      </div>
    </section>
  )
}
export default TreeStructureOverview
