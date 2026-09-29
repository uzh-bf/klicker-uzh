import {
  faArrowUpRightFromSquare,
  faTrashCan,
} from '@fortawesome/free-solid-svg-icons'
import { Button, Switch, TextField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { getAssignmentLeaves, updateElementMapping } from './assignmentHelpers'
import CompetenceTreePagination from './CompetenceTreePagination'
import ElementPreview from './ElementPreview'
import IconAction from './IconAction'
import ItemParameters from './ItemParameters'
import { getBreadcrumb } from './treeHelpers'
import type { CompetenceTreeForm } from './types'

// Without onChange the list is read-only (e.g. a structurally locked tree).
// With it, each assignment can be moved to another leaf or level, switched
// off, or removed; changes stay in the form until the tree is saved.
function AssignedElementsPreview({
  form,
  onChange,
  disabled = false,
}: {
  form: CompetenceTreeForm
  onChange?: (form: CompetenceTreeForm) => void
  disabled?: boolean
}) {
  const t = useTranslations()
  const leaves = getAssignmentLeaves(form)
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const elements = form.assignments.filter((item) =>
    item.elementName.toLowerCase().includes(search.toLowerCase())
  )
  const totalPages = Math.max(1, Math.ceil(elements.length / pageSize))
  useEffect(() => {
    setPage((current) => Math.min(current, totalPages))
  }, [totalPages])
  return (
    <section data-cy="competence-tree-assigned-preview">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {t('manage.competenceTree.assignedElements')}
          </h2>
          <p className="text-sm text-gray-600">
            {t('manage.competenceTree.assignFromLibrary')}
          </p>
        </div>
        <Button
          onClick={() => void router.push('/')}
          data={{ cy: 'competence-tree-open-element-library' }}
        >
          <Button.Icon icon={faArrowUpRightFromSquare} />
          <Button.Label>
            {t('manage.competenceTree.openElementLibrary')}
          </Button.Label>
        </Button>
      </div>
      <TextField
        label={t('manage.competenceTree.assignmentSearch')}
        value={search}
        onChange={(value) => {
          setSearch(value)
          setPage(1)
        }}
        data={{ cy: 'competence-tree-assigned-search' }}
      />
      <ul className="mt-4 divide-y border-y border-gray-200">
        {elements.slice((page - 1) * pageSize, page * pageSize).map((item) => (
          <li
            key={item.key}
            className="flex items-center justify-between gap-4 py-3"
          >
            <div className="min-w-0">
              <div className="break-words font-medium">{item.elementName}</div>
              <p className="text-sm text-gray-600">
                {[item.leafKey, ...item.additionalLeafKeys]
                  .map((leafKey) => getBreadcrumb(form.nodes, leafKey))
                  .join(', ')}
              </p>
              <p className="text-xs text-gray-500">
                {t(`shared.types.${item.elementType}`)} ·{' '}
                {
                  form.levels.find((level) => level.key === item.levelKey)
                    ?.label
                }{' '}
                ·{' '}
                {t(
                  item.enabled
                    ? 'manage.competenceTree.enabled'
                    : 'manage.competenceTree.assignmentInactive'
                )}
              </p>
              <ItemParameters
                elementId={item.elementId}
                difficulty={item.b}
                guessing={item.c}
                levelLabel={
                  form.levels.find((level) => level.key === item.levelKey)
                    ?.label
                }
              />
              {onChange && (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <select
                    aria-label={t('manage.competenceTree.assignElementLeaf', {
                      name: item.elementName,
                    })}
                    className="min-w-0 max-w-full rounded border border-slate-300 p-2 text-sm"
                    disabled={disabled}
                    value={
                      leaves.some((leaf) => leaf.key === item.leafKey)
                        ? item.leafKey
                        : ''
                    }
                    onChange={(event) =>
                      onChange(
                        updateElementMapping(form, item.key, {
                          leafKey: event.target.value,
                        })
                      )
                    }
                    data-cy={`competence-tree-assigned-leaf-${item.elementId}`}
                  >
                    <option value="">
                      {t('manage.competenceTree.chooseSubcompetence')}
                    </option>
                    {leaves.map((leaf) => (
                      <option key={leaf.key} value={leaf.key}>
                        {getBreadcrumb(form.nodes, leaf.key)}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={t('manage.competenceTree.assignElementLevel', {
                      name: item.elementName,
                    })}
                    className="rounded border border-slate-300 p-2 text-sm"
                    disabled={disabled}
                    value={
                      form.levels.some((level) => level.key === item.levelKey)
                        ? item.levelKey
                        : ''
                    }
                    onChange={(event) =>
                      onChange(
                        updateElementMapping(form, item.key, {
                          levelKey: event.target.value,
                        })
                      )
                    }
                    data-cy={`competence-tree-assigned-level-${item.elementId}`}
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
                  <label
                    htmlFor={`competence-tree-assigned-enabled-${item.elementId}`}
                    className="sr-only"
                  >
                    {t('manage.competenceTree.assignmentEnabledLabel', {
                      element: item.elementName,
                    })}
                  </label>
                  <Switch
                    id={`competence-tree-assigned-enabled-${item.elementId}`}
                    checked={item.enabled}
                    onCheckedChange={(enabled) =>
                      onChange({
                        ...form,
                        assignments: form.assignments.map((candidate) =>
                          candidate.key === item.key
                            ? { ...candidate, enabled }
                            : candidate
                        ),
                      })
                    }
                    disabled={disabled}
                    size="sm"
                    data={{
                      cy: `competence-tree-assigned-enabled-${item.elementId}`,
                    }}
                  />
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ElementPreview
                elementId={item.elementId}
                name={item.elementName}
              />
              {onChange && (
                <IconAction
                  icon={faTrashCan}
                  label={t('manage.competenceTree.removeAssignment')}
                  onClick={() =>
                    onChange({
                      ...form,
                      assignments: form.assignments.filter(
                        (candidate) => candidate.key !== item.key
                      ),
                    })
                  }
                  disabled={disabled}
                  destructive
                  dataCy={`competence-tree-assigned-remove-${item.elementId}`}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
      {elements.length === 0 && (
        <p className="py-4 text-sm text-gray-600">
          {t('manage.competenceTree.noAssignments')}
        </p>
      )}
      <CompetenceTreePagination
        currentPage={page}
        totalPages={totalPages}
        setCurrentPage={setPage}
        pageSize={pageSize}
        setPageSize={(value) => {
          setPageSize(value)
          setPage(1)
        }}
        numOfObjects={elements.length}
      />
    </section>
  )
}
export default AssignedElementsPreview
