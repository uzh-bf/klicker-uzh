import { faTrashCan, faXmark } from '@fortawesome/free-solid-svg-icons'
import { Button, Switch } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import CompetenceTreePagination from './CompetenceTreePagination'
import type { CoverageCellSelection } from './CoverageMatrix'
import ElementLibraryPicker from './ElementLibraryPicker'
import IconAction from './IconAction'
import { getBreadcrumb } from './treeHelpers'
import type { CompetenceTreeForm } from './types'

const DEFAULT_PAGE_SIZE = 20

function AssignmentTable({
  form,
  onChange,
  disabled,
  selectedCell,
  onClearCell,
}: {
  form: CompetenceTreeForm
  onChange: (form: CompetenceTreeForm) => void
  disabled: boolean
  selectedCell: CoverageCellSelection | null
  onClearCell: () => void
}) {
  const t = useTranslations()
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const levelsByKey = useMemo(
    () => new Map(form.levels.map((level) => [level.key, level])),
    [form.levels]
  )
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const assignmentsInCell = selectedCell
    ? form.assignments.filter(
        (assignment) =>
          assignment.leafKey === selectedCell.leafKey &&
          assignment.levelKey === selectedCell.levelKey
      )
    : form.assignments
  const assignments = assignmentsInCell.filter(
    (item) =>
      item.elementName.toLowerCase().includes(search.toLowerCase()) &&
      (!type || item.elementType === type)
  )
  const totalPages = Math.max(1, Math.ceil(assignments.length / pageSize))
  const visibleAssignments = assignments.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCell?.leafKey, selectedCell?.levelKey])

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages))
  }, [totalPages])

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

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
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
      </div>
      {!disabled && <ElementLibraryPicker form={form} onChange={onChange} />}
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
                {t('manage.competenceTree.percentInput')}
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
                className="border-t border-slate-200"
                data-cy={`competence-tree-assignment-${assignment.sourceId}`}
              >
                <th scope="row" className="min-w-0 px-3 py-2 font-normal">
                  <div className="truncate text-sm font-medium">
                    {assignment.elementName}
                  </div>
                  <div className="text-xs text-slate-500">
                    #{assignment.elementId} v{assignment.elementVersion}
                  </div>
                </th>
                <td className="px-3 py-2 text-sm">
                  {t(`shared.types.${assignment.elementType}`)}
                </td>
                <td className="truncate px-3 py-2 text-sm">
                  {getBreadcrumb(form.nodes, assignment.leafKey)}
                </td>
                <td className="truncate px-3 py-2 text-sm">
                  {levelsByKey.get(assignment.levelKey)?.label ?? ''}
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
                <td className="px-3 py-2 text-sm">
                  {t(
                    assignment.enablePercentInput
                      ? 'manage.competenceTree.yes'
                      : 'manage.competenceTree.no'
                  )}
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
                  colSpan={7}
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
