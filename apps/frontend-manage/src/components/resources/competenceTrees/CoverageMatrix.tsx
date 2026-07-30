import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import { NumberField, Select, Switch, TextField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import {
  getBreadcrumb,
  getChildren,
  getLeafNodes,
  getRootNode,
} from './treeHelpers'
import { CompetenceTreeCoverageForm, CompetenceTreeForm } from './types'

export interface CoverageCellSelection {
  leafKey: string
  levelKey: string
}

function CoverageMatrix({
  form,
  onChange,
  disabled,
  selectedCell,
  onSelectCell,
}: {
  form: CompetenceTreeForm
  onChange: (form: CompetenceTreeForm) => void
  disabled: boolean
  selectedCell: CoverageCellSelection | null
  onSelectCell: (cell: CoverageCellSelection) => void
}) {
  const t = useTranslations()
  const [search, setSearch] = useState('')
  const [rootFilter, setRootFilter] = useState('all')
  const orderedLevels = useMemo(
    () => form.levels.slice().sort((a, b) => a.order - b.order),
    [form.levels]
  )
  const roots = useMemo(() => getChildren(form.nodes, null), [form.nodes])
  const leaves = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase()
    return getLeafNodes(form.nodes).filter((leaf) => {
      const root = getRootNode(form.nodes, leaf.key)
      if (rootFilter !== 'all' && root?.key !== rootFilter) return false
      if (!normalizedSearch) return true
      return getBreadcrumb(form.nodes, leaf.key)
        .toLocaleLowerCase()
        .includes(normalizedSearch)
    })
  }, [form.nodes, rootFilter, search])

  const updateCoverage = (
    leafKey: string,
    levelKey: string,
    update: (coverage: CompetenceTreeCoverageForm) => CompetenceTreeCoverageForm
  ) => {
    const existing = form.coverages.find(
      (coverage) =>
        coverage.leafKey === leafKey && coverage.levelKey === levelKey
    )
    const fallback: CompetenceTreeCoverageForm = {
      leafKey,
      levelKey,
      targetItemCount: 5,
      enabled: true,
    }
    const nextCoverage = update(existing ?? fallback)

    onChange({
      ...form,
      coverages: existing
        ? form.coverages.map((coverage) =>
            coverage.leafKey === leafKey && coverage.levelKey === levelKey
              ? nextCoverage
              : coverage
          )
        : [...form.coverages, nextCoverage],
    })
  }

  return (
    <section
      id="competence-tree-section-coverages"
      tabIndex={-1}
      className="focus:outline-primary-80 scroll-mt-4 border-t border-slate-300 py-5 focus:outline focus:outline-2"
      data-cy="competence-tree-coverage"
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold">
          {t('manage.competenceTree.coverageTitle')}
        </h2>
        <p className="text-sm text-slate-600">
          {t('manage.competenceTree.coverageDescription')}
        </p>
      </div>

      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <TextField
          value={search}
          onChange={setSearch}
          icon={faMagnifyingGlass}
          placeholder={t('manage.competenceTree.searchLeaves')}
          data={{ cy: 'competence-tree-coverage-search' }}
        />
        <Select
          value={rootFilter}
          onChange={setRootFilter}
          items={[
            {
              value: 'all',
              label: t('manage.competenceTree.allRoots'),
            },
            ...roots.map((root) => ({
              value: root.key,
              label: root.name,
            })),
          ]}
          data={{ cy: 'competence-tree-coverage-root-filter' }}
          className={{ trigger: 'h-9 w-full' }}
        />
      </div>

      <div className="max-h-160 overflow-auto border border-slate-300 [contain:paint]">
        <div
          className="grid min-w-max"
          style={{
            gridTemplateColumns: `minmax(16rem, 1fr) repeat(${Math.max(
              orderedLevels.length,
              1
            )}, minmax(11rem, 1fr))`,
          }}
        >
          <div className="sticky left-0 top-0 z-20 border-b border-r border-slate-300 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
            {t('manage.competenceTree.leaf')}
          </div>
          {orderedLevels.map((level) => (
            <div
              key={level.key}
              className="sticky top-0 z-10 border-b border-r border-slate-300 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 last:border-r-0"
            >
              {level.label}
            </div>
          ))}

          {leaves.map((leaf) => (
            <div key={leaf.key} className="contents">
              <div className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-3 py-3 text-sm">
                {getBreadcrumb(form.nodes, leaf.key)}
              </div>
              {orderedLevels.map((level) => {
                const coverage = form.coverages.find(
                  (candidate) =>
                    candidate.leafKey === leaf.key &&
                    candidate.levelKey === level.key
                ) ?? {
                  leafKey: leaf.key,
                  levelKey: level.key,
                  targetItemCount: 5,
                  enabled: true,
                }
                const assignmentCount = form.assignments.filter(
                  (assignment) =>
                    assignment.leafKey === leaf.key &&
                    assignment.levelKey === level.key &&
                    assignment.enabled
                ).length
                const isSelected =
                  selectedCell?.leafKey === leaf.key &&
                  selectedCell.levelKey === level.key
                const ready =
                  coverage.enabled &&
                  assignmentCount >= coverage.targetItemCount

                return (
                  <div
                    key={`${leaf.key}-${level.key}`}
                    className={`border-b border-r border-slate-200 p-2 last:border-r-0 ${
                      isSelected
                        ? 'ring-primary-80 bg-sky-50 ring-2 ring-inset'
                        : 'bg-white hover:bg-slate-50'
                    }`}
                    data-cy={`competence-tree-coverage-cell-${leaf.key}-${level.key}`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <label
                        htmlFor={`competence-tree-coverage-enabled-${leaf.key}-${level.key}`}
                        className="sr-only"
                      >
                        {t('manage.competenceTree.coverageEnabledLabel', {
                          leaf: getBreadcrumb(form.nodes, leaf.key),
                          level: level.label,
                        })}
                      </label>
                      <Switch
                        id={`competence-tree-coverage-enabled-${leaf.key}-${level.key}`}
                        checked={coverage.enabled}
                        onCheckedChange={(enabled) =>
                          updateCoverage(leaf.key, level.key, (current) => ({
                            ...current,
                            enabled,
                          }))
                        }
                        disabled={disabled}
                        size="sm"
                        data={{
                          cy: `competence-tree-coverage-enabled-${leaf.key}-${level.key}`,
                        }}
                      />
                      <span
                        className={`text-xs font-medium ${
                          !coverage.enabled
                            ? 'text-slate-500'
                            : ready
                              ? 'text-green-700'
                              : 'text-amber-700'
                        }`}
                      >
                        {!coverage.enabled
                          ? t('manage.competenceTree.coverageDisabled')
                          : ready
                            ? t('manage.competenceTree.coverageReady')
                            : t('manage.competenceTree.coverageMissing')}
                      </span>
                    </div>
                    <label
                      htmlFor={`competence-tree-coverage-target-${leaf.key}-${level.key}`}
                      className="sr-only"
                    >
                      {t('manage.competenceTree.coverageTargetLabel', {
                        leaf: getBreadcrumb(form.nodes, leaf.key),
                        level: level.label,
                      })}
                    </label>
                    <NumberField
                      id={`competence-tree-coverage-target-${leaf.key}-${level.key}`}
                      value={coverage.targetItemCount}
                      onChange={(value) =>
                        updateCoverage(leaf.key, level.key, (current) => ({
                          ...current,
                          targetItemCount: Number(value || 0),
                        }))
                      }
                      min={1}
                      precision={0}
                      disabled={disabled || !coverage.enabled}
                      data={{
                        cy: `competence-tree-coverage-target-${leaf.key}-${level.key}`,
                      }}
                      className={{ input: 'h-8 text-sm' }}
                    />
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={t(
                        'manage.competenceTree.coverageFilterLabel',
                        {
                          leaf: getBreadcrumb(form.nodes, leaf.key),
                          level: level.label,
                        }
                      )}
                      onClick={() =>
                        onSelectCell({
                          leafKey: leaf.key,
                          levelKey: level.key,
                        })
                      }
                      className="mt-1 text-left text-xs text-slate-600 underline hover:text-slate-900"
                    >
                      {t('manage.competenceTree.coverageAssignmentCount', {
                        count: assignmentCount,
                        target: coverage.targetItemCount,
                      })}
                    </button>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {leaves.length === 0 && (
          <div className="p-6 text-center text-sm text-slate-600">
            {t('manage.competenceTree.noMatchingLeaves')}
          </div>
        )}
      </div>
    </section>
  )
}

export default CoverageMatrix
