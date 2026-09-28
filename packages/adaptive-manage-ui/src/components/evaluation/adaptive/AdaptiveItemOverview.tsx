import {
  faChevronDown,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useId, useMemo, useState } from 'react'
import CompetenceTreePagination from '../../resources/competenceTrees/CompetenceTreePagination'
import AdaptiveItemDiagnosticTable from './AdaptiveItemDiagnosticTable'
import type { AdaptiveItemDiagnostic } from './types'

type ItemGroup = {
  key: string
  name: string
  count: number
  items: AdaptiveItemDiagnostic[]
  children: Map<string, ItemGroup>
}

function ItemGroupPanel({
  group,
  practiceQuizId,
}: {
  group: ItemGroup
  practiceQuizId: string
}) {
  const t = useTranslations()
  const [expanded, setExpanded] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const id = useId()
  const totalPages = Math.max(1, Math.ceil(group.items.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  return (
    <div
      className="min-w-0 rounded border border-gray-200"
      data-cy="adaptive-item-group"
    >
      <Button
        basic
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls={id}
        className={{
          root: 'flex w-full items-center gap-2 px-3 py-3 text-left',
        }}
        data={{ cy: 'adaptive-item-group-toggle' }}
      >
        <Button.Icon
          withoutLabel
          icon={expanded ? faChevronDown : faChevronRight}
        />
        <span className="min-w-0 flex-1 break-words font-medium">
          {group.name}
        </span>
        <span className="shrink-0 text-xs font-normal text-gray-600">
          {t('manage.evaluation.adaptive.pilot.itemCount', {
            count: group.count,
          })}
        </span>
      </Button>
      {expanded ? (
        <div id={id} className="space-y-3 border-t border-gray-200 p-2 sm:p-3">
          {Array.from(group.children.values()).map((child) => (
            <ItemGroupPanel
              key={child.key}
              group={child}
              practiceQuizId={practiceQuizId}
            />
          ))}
          {group.items.length > 0 ? (
            <>
              <AdaptiveItemDiagnosticTable
                practiceQuizId={practiceQuizId}
                items={group.items.slice(
                  (currentPage - 1) * pageSize,
                  currentPage * pageSize
                )}
              />
              <CompetenceTreePagination
                currentPage={currentPage}
                totalPages={totalPages}
                setCurrentPage={setPage}
                numOfObjects={group.items.length}
                pageSize={pageSize}
                setPageSize={(value) => {
                  setPageSize(value)
                  setPage(1)
                }}
              />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function AdaptiveItemOverview({
  items,
  practiceQuizId,
}: {
  items: AdaptiveItemDiagnostic[]
  practiceQuizId: string
}) {
  const t = useTranslations()
  const [expanded, setExpanded] = useState(false)
  const id = useId()
  const fallback = t('manage.evaluation.adaptive.pilot.unassignedItems')
  const groups = useMemo(() => {
    const roots = new Map<string, ItemGroup>()
    for (const item of items) {
      const path = item.nodeNamePath.length ? item.nodeNamePath : [fallback]
      let siblings = roots
      path.forEach((name, index) => {
        const key = JSON.stringify(path.slice(0, index + 1))
        let group = siblings.get(key)
        if (!group) {
          group = { key, name, count: 0, items: [], children: new Map() }
          siblings.set(key, group)
        }
        group.count++
        if (index === path.length - 1) group.items.push(item)
        siblings = group.children
      })
    }
    return Array.from(roots.values())
  }, [items, fallback])
  return (
    <div
      className="rounded border border-gray-200"
      data-cy="adaptive-item-overview"
    >
      <Button
        basic
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls={id}
        className={{
          root: 'flex w-full items-center gap-2 px-4 py-3 text-left',
        }}
        data={{ cy: 'adaptive-item-overview-toggle' }}
      >
        <Button.Icon
          withoutLabel
          icon={expanded ? faChevronDown : faChevronRight}
        />
        <span className="min-w-0 flex-1 font-semibold">
          {t('manage.evaluation.adaptive.pilot.itemOverview')}
        </span>
        <span className="shrink-0 text-sm font-normal text-gray-600">
          {t('manage.evaluation.adaptive.pilot.itemCount', {
            count: items.length,
          })}
        </span>
      </Button>
      {expanded ? (
        <div id={id} className="space-y-3 border-t border-gray-200 p-3 sm:p-4">
          <p className="text-sm text-gray-600">
            {t('manage.evaluation.adaptive.pilot.itemOverviewHelp')}
          </p>
          {groups.map((group) => (
            <ItemGroupPanel
              key={group.key}
              group={group}
              practiceQuizId={practiceQuizId}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
export default AdaptiveItemOverview
