import { faTrashCan, faXmark } from '@fortawesome/free-solid-svg-icons'
import { mapLevelsToTheta } from '@klicker-uzh/adaptive-contract'
import { Button, Switch, UserNotification } from '@uzh-bf/design-system'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import {
  ELEMENT_NAME_SORTS,
  type ElementNameSort,
  sortByName,
} from '../../../lib/elementSorting'
import {
  assignmentHasLeaf,
  getAssignmentLeaves,
  hasUnmappedElements,
  updateElementMapping,
} from './assignmentHelpers'
import CompetenceTreePagination from './CompetenceTreePagination'
import type { CoverageCellSelection } from './CoverageMatrix'
import ElementLibraryPicker from './ElementLibraryPicker'
import ElementPreview from './ElementPreview'
import IconAction from './IconAction'
import ItemParameters from './ItemParameters'
import SortSelect from './SortSelect'
import { getBreadcrumb } from './treeHelpers'
import type { CompetenceTreeForm } from './types'

const DEFAULT_PAGE_SIZE = 20

function AssignmentTable({
  form,
  onChange,
  disabled,
  selectedCell,
  onClearCell,
  filterReset = 0,
}: {
  form: CompetenceTreeForm
  onChange: (form: CompetenceTreeForm) => void
  disabled: boolean
  selectedCell: CoverageCellSelection | null
  onClearCell: () => void
  filterReset?: number
}) {
  const t = useTranslations()
  const locale = useLocale()
  const leaves = getAssignmentLeaves(form)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [addedElementId, setAddedElementId] = useState<number | null>(null)
  const levelsByKey = useMemo(
    () => new Map(form.levels.map((level) => [level.key, level])),
    [form.levels]
  )
  const mappedLevels = mapLevelsToTheta(
    form.levels,
    { min: form.thetaMin, max: form.thetaMax },
    form.levelMappingRule
  )
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [sort, setSort] = useState<ElementNameSort>('default')

  // biome-ignore lint/correctness/useExhaustiveDependencies: filterReset is an explicit parent signal to clear all filters.
  useEffect(() => {
    setSearch('')
    setType('')
    setCurrentPage(1)
  }, [filterReset])
  const assignmentsInCell = selectedCell
    ? form.assignments.filter(
        (assignment) =>
          assignmentHasLeaf(assignment, selectedCell.leafKey) &&
          assignment.levelKey === selectedCell.levelKey
      )
    : form.assignments
  const assignments = sortByName(
    assignmentsInCell.filter(
      (item) =>
        item.elementName.toLowerCase().includes(search.toLowerCase()) &&
        (!type || item.elementType === type)
    ),
    sort,
    locale
  )
  const totalPages = Math.max(1, Math.ceil(assignments.length / pageSize))
  const visibleAssignments = assignments.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: changing the selected cell must reset pagination.
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCell?.leafKey, selectedCell?.levelKey])

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages))
  }, [totalPages])

  useEffect(() => {
    if (addedElementId === null) return
    const index = assignments.findIndex(
      (item) => item.elementId === addedElementId
    )
    if (index >= 0) setCurrentPage(Math.floor(index / pageSize) + 1)
    setAddedElementId(null)
  }, [addedElementId, assignments, pageSize])

  return (
    <section
      id="competence-tree-section-assignments"
      tabIndex={-1}
      className="focus:outline-primary-80 scroll-mt-4 border-t border-slate-300 py-5 focus:outline focus:outline-2"
      data-cy="competence-tree-assignments"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {t('manage.competenceTree.assignmentsTitle')}
          </h2>
          <p className="text-sm text-slate-600">
            {t('manage.competenceTree.assignmentsDescription')}
          </p>
        </div>
        {selectedCell && (
          <Button
            onClick={onClearCell}
            data={{ cy: 'competence-tree-clear-assignment-filter' }}
          >
            <Button.Icon icon={faXmark} />
            <Button.Label>
              {t('manage.competenceTree.clearCoverageFilter')}
            </Button.Label>
          </Button>
        )}
      </div>

      {selectedCell && (
        <div className="mb-3 text-sm text-slate-600">
          {t('manage.competenceTree.assignmentFilter', {
            leaf: getBreadcrumb(form.nodes, selectedCell.leafKey),
            level: levelsByKey.get(selectedCell.levelKey)?.label ?? '',
          })}
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          {t('manage.competenceTree.assignmentSearch')}
          <input
            className="mt-1 block w-full rounded border border-slate-300 p-2"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setCurrentPage(1)
            }}
            data-cy="competence-tree-assignment-search"
          />
        </label>
        <label className="text-sm">
          {t('manage.competenceTree.elementType')}
          <select
            className="mt-1 block w-full rounded border border-slate-300 p-2"
            value={type}
            onChange={(event) => {
              setType(event.target.value)
              setCurrentPage(1)
            }}
            data-cy="competence-tree-assignment-type"
          >
            <option value="">{t('manage.competenceTree.allTypes')}</option>
            {Array.from(
              new Set(form.assignments.map((item) => item.elementType))
            ).map((value) => (
              <option key={value} value={value}>
                {t(`shared.types.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <SortSelect
          label={t('manage.competenceTree.sortBy')}
          value={sort}
          options={ELEMENT_NAME_SORTS.map((value) => ({
            value,
            label: t(`manage.competenceTree.sortOptions.${value}`),
          }))}
          onChange={(value) => {
            setSort(value)
            setCurrentPage(1)
          }}
          dataCy="competence-tree-assignment-sort"
        />
      </div>
      {!disabled && (
        <ElementLibraryPicker
          form={form}
          onChange={(next) => {
            const added = next.assignments.find(
              (item) =>
                !form.assignments.some(
                  (existing) => existing.elementId === item.elementId
                )
            )
            setAddedElementId(added?.elementId ?? null)
            onChange(next)
            onClearCell()
            setSearch('')
            setType('')
          }}
        />
      )}
      {hasUnmappedElements(form) && (
        <UserNotification type="info" className={{ root: 'mb-4' }}>
          {t('manage.competenceTree.unmappedElements')}
        </UserNotification>
      )}
      <div className="overflow-x-auto border-y border-slate-200">
        <table className="w-full min-w-[56rem] table-fixed text-left">
          <caption className="sr-only">
            {t('manage.competenceTree.assignmentsDescription')}
          </caption>
          <colgroup>
            <col className="w-60" />
            <col className="w-32" />
            <col className="w-64" />
            <col className="w-40" />
            <col className="w-28" />
            <col className="w-14" />
          </colgroup>
          <thead className="bg-slate-100 text-xs font-semibold text-slate-600">
            <tr>
              <th scope="col" className="px-3 py-2">
                {t('manage.competenceTree.element')}
              </th>
              <th scope="col" className="px-3 py-2">
                {t('manage.competenceTree.elementType')}
              </th>
              <th scope="col" className="px-3 py-2">
                {t('manage.competenceTree.leaf')}
              </th>
              <th scope="col" className="px-3 py-2">
                {t('manage.competenceTree.expectedDifficulty')}
              </th>
              <th scope="col" className="px-3 py-2">
                {t('manage.competenceTree.enabled')}
              </th>
              <th scope="col" className="px-3 py-2">
                <span className="sr-only">
                  {t('manage.competenceTree.actions')}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleAssignments.map((assignment) => (
              <tr
                key={assignment.key}
                className="border-t border-slate-200 [&>td]:align-middle [&>th]:align-middle"
                data-cy={`competence-tree-assignment-${assignment.sourceId}`}
              >
                <th scope="row" className="min-w-0 px-3 py-2 font-normal">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div
                        className="truncate text-sm font-medium"
                        title={assignment.elementName}
                      >
                        {assignment.elementName}
                      </div>
                      <div className="text-xs text-slate-500">
                        #{assignment.elementId} v{assignment.elementVersion}
                      </div>
                    </div>
                    <ElementPreview
                      elementId={assignment.elementId}
                      name={assignment.elementName}
                    />
                  </div>
                  <ItemParameters
                    elementId={assignment.elementId}
                    difficulty={
                      mappedLevels.find(
                        (level) =>
                          level.order ===
                          levelsByKey.get(assignment.levelKey)?.order
                      )?.theta
                    }
                    levelLabel={levelsByKey.get(assignment.levelKey)?.label}
                    guessing={assignment.c}
                  />
                </th>
                <td className="px-3 py-2 text-sm">
                  {t(`shared.types.${assignment.elementType}`)}
                </td>
                <td className="truncate px-3 py-2 text-sm">
                  <select
                    aria-label={t('manage.competenceTree.assignElementLeaf', {
                      name: assignment.elementName,
                    })}
                    className="w-full rounded border border-slate-300 p-2"
                    disabled={disabled}
                    value={
                      leaves.some((node) => node.key === assignment.leafKey)
                        ? assignment.leafKey
                        : ''
                    }
                    onChange={(event) =>
                      onChange(
                        updateElementMapping(form, assignment.key, {
                          leafKey: event.target.value,
                        })
                      )
                    }
                    data-cy={
                      'competence-tree-assignment-leaf-' + assignment.elementId
                    }
                  >
                    <option value="">
                      {t('manage.competenceTree.chooseSubcompetence')}
                    </option>
                    {form.nodes.map((node) => (
                      <option
                        key={node.key}
                        value={node.key}
                        disabled={!leaves.some((leaf) => leaf.key === node.key)}
                      >
                        {getBreadcrumb(form.nodes, node.key)}
                        {!leaves.some((leaf) => leaf.key === node.key)
                          ? ' — ' + t('manage.competenceTree.competenceGroup')
                          : ''}
                      </option>
                    ))}
                  </select>
                  {assignment.additionalLeafKeys.length > 0 ? (
                    <p className="mt-1 text-xs text-slate-600">
                      {t('manage.elements.adaptiveMapping.additionalLeaves')}:{' '}
                      {assignment.additionalLeafKeys
                        .map((leafKey) => getBreadcrumb(form.nodes, leafKey))
                        .join(', ')}
                    </p>
                  ) : null}
                </td>
                <td className="truncate px-3 py-2 text-sm">
                  <select
                    aria-label={t('manage.competenceTree.assignElementLevel', {
                      name: assignment.elementName,
                    })}
                    className="w-full rounded border border-slate-300 p-2"
                    disabled={disabled}
                    value={
                      levelsByKey.has(assignment.levelKey)
                        ? assignment.levelKey
                        : ''
                    }
                    onChange={(event) =>
                      onChange(
                        updateElementMapping(form, assignment.key, {
                          levelKey: event.target.value,
                        })
                      )
                    }
                    data-cy={
                      'competence-tree-assignment-level-' + assignment.elementId
                    }
                  >
                    <option value="">
                      {t('manage.competenceTree.chooseLevel')}
                    </option>
                    {form.levels.map((level) => (
                      <option key={level.key} value={level.key}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <label
                    htmlFor={`competence-tree-assignment-enabled-${assignment.sourceId}`}
                    className="sr-only"
                  >
                    {t('manage.competenceTree.assignmentEnabledLabel', {
                      element: assignment.elementName,
                    })}
                  </label>
                  <Switch
                    id={`competence-tree-assignment-enabled-${assignment.sourceId}`}
                    checked={assignment.enabled}
                    onCheckedChange={(enabled) =>
                      onChange({
                        ...form,
                        assignments: form.assignments.map((candidate) =>
                          candidate.key === assignment.key
                            ? { ...candidate, enabled }
                            : candidate
                        ),
                      })
                    }
                    disabled={disabled}
                    size="sm"
                    data={{
                      cy: `competence-tree-assignment-enabled-${assignment.sourceId}`,
                    }}
                  />
                </td>
                <td className="px-3 py-2">
                  <IconAction
                    icon={faTrashCan}
                    label={t('manage.competenceTree.removeAssignment')}
                    onClick={() =>
                      onChange({
                        ...form,
                        assignments: form.assignments.filter(
                          (candidate) => candidate.key !== assignment.key
                        ),
                      })
                    }
                    disabled={disabled}
                    destructive
                    dataCy={`competence-tree-assignment-remove-${assignment.sourceId}`}
                  />
                </td>
              </tr>
            ))}
            {assignments.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="p-6 text-center text-sm text-slate-600"
                >
                  <div>
                    {t(
                      selectedCell
                        ? 'manage.competenceTree.noFilteredAssignments'
                        : 'manage.competenceTree.noAssignments'
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {assignments.length > 0 ? (
        <CompetenceTreePagination
          totalPages={totalPages}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          numOfObjects={assignments.length}
          pageSize={pageSize}
          setPageSize={setPageSize}
        />
      ) : null}
    </section>
  )
}

export default AssignmentTable
