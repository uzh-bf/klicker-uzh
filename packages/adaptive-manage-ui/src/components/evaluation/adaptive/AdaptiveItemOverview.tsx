import {
  faChevronDown,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons'
import { Button } from '@uzh-bf/design-system'
import { useLocale, useTranslations } from 'next-intl'
import { type SetStateAction, useId, useMemo, useState } from 'react'
import {
  ELEMENT_RESPONSE_SORTS,
  type ElementResponseSort,
  sortByNameOrResponses,
} from '../../../lib/elementSorting'
import CompetenceTreePagination from '../../resources/competenceTrees/CompetenceTreePagination'
import SortSelect from '../../resources/competenceTrees/SortSelect'
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
  sort,
}: {
  group: ItemGroup
  practiceQuizId: string
  sort: ElementResponseSort
}) {
  const t = useTranslations()
  const locale = useLocale()
  const [expanded, setExpanded] = useState(false)
  // Changing the sort order returns the list to its first page.
  const [pageState, setPageState] = useState({ sort, page: 1 })
  const page = pageState.sort === sort ? pageState.page : 1
  const setPage = (value: SetStateAction<number>) =>
    setPageState((current) => ({
      sort,
      page:
        typeof value === 'function'
          ? value(current.sort === sort ? current.page : 1)
          : value,
    }))
  const [pageSize, setPageSize] = useState(10)
  const id = useId()
  const items = useMemo(
    () => sortByNameOrResponses(group.items, sort, locale),
    [group.items, sort, locale]
  )
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
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
              sort={sort}
            />
          ))}
          {items.length > 0 ? (
            <>
              <AdaptiveItemDiagnosticTable
                practiceQuizId={practiceQuizId}
                items={items.slice(
                  (currentPage - 1) * pageSize,
                  currentPage * pageSize
                )}
              />
              <CompetenceTreePagination
                currentPage={currentPage}
                totalPages={totalPages}
                setCurrentPage={setPage}
                numOfObjects={items.length}
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
  const [sort, setSort] = useState<ElementResponseSort>('default')
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
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="min-w-0 flex-1 text-sm text-gray-600">
              {t('manage.evaluation.adaptive.pilot.itemOverviewHelp')}
            </p>
            <SortSelect
              label={t('manage.evaluation.adaptive.pilot.sortBy')}
              value={sort}
              options={ELEMENT_RESPONSE_SORTS.map((value) => ({
                value,
                label: t(
                  `manage.evaluation.adaptive.pilot.sortOptions.${value}`
                ),
              }))}
              onChange={setSort}
              className="w-full sm:w-56"
              dataCy="adaptive-item-overview-sort"
            />
          </div>
          {groups.map((group) => (
            <ItemGroupPanel
              key={group.key}
              group={group}
              practiceQuizId={practiceQuizId}
              sort={sort}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
export default AdaptiveItemOverview
