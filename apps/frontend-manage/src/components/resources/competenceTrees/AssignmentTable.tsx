import { faTrashCan, faXmark } from '@fortawesome/free-solid-svg-icons'
import { mapLevelsToTheta } from '@klicker-uzh/adaptive-learning'
import { Button, Switch } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { CoverageCellSelection } from './CoverageMatrix'
import IconAction from './IconAction'
import { getBreadcrumb } from './treeHelpers'
import { CompetenceTreeForm } from './types'

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
  const levelsByKey = useMemo(
    () => new Map(form.levels.map((level) => [level.key, level])),
    [form.levels]
  )
  const difficultyByLevelKey = useMemo(() => {
    const levels = form.levels.slice().sort((a, b) => a.order - b.order)
    const mapped = mapLevelsToTheta(
      levels.map((level) => ({ label: level.label, order: level.order })),
      { min: form.thetaMin, max: form.thetaMax },
      form.levelMappingRule
    )
    return new Map(
      levels.map((level, index) => [level.key, mapped[index]?.theta ?? 0])
    )
  }, [form.levelMappingRule, form.levels, form.thetaMax, form.thetaMin])
  const assignments = selectedCell
    ? form.assignments.filter(
        (assignment) =>
          assignment.leafKey === selectedCell.leafKey &&
          assignment.levelKey === selectedCell.levelKey
      )
    : form.assignments

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

      <div className="overflow-x-auto border-y border-slate-200">
        <div className="min-w-260 grid grid-cols-[minmax(13rem,1fr)_8rem_minmax(16rem,1.2fr)_10rem_5rem_5rem_5rem_7rem_6rem_3rem] gap-3 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
          <div>{t('manage.competenceTree.element')}</div>
          <div>{t('manage.competenceTree.elementType')}</div>
          <div>{t('manage.competenceTree.leaf')}</div>
          <div>{t('manage.competenceTree.level')}</div>
          <div>a</div>
          <div>b</div>
          <div>c</div>
          <div>{t('manage.competenceTree.enabled')}</div>
          <div>{t('manage.competenceTree.percentInput')}</div>
          <div />
        </div>

        {assignments.map((assignment) => (
          <div
            key={assignment.key}
            className="min-w-260 grid grid-cols-[minmax(13rem,1fr)_8rem_minmax(16rem,1.2fr)_10rem_5rem_5rem_5rem_7rem_6rem_3rem] items-center gap-3 border-t border-slate-200 px-3 py-2 first:border-t-0"
            data-cy={`competence-tree-assignment-${assignment.sourceId}`}
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {assignment.elementName}
              </div>
              <div className="text-xs text-slate-500">
                #{assignment.elementId} v{assignment.elementVersion}
              </div>
            </div>
            <div className="text-sm">
              {t(`shared.types.${assignment.elementType}`)}
            </div>
            <div className="truncate text-sm">
              {getBreadcrumb(form.nodes, assignment.leafKey)}
            </div>
            <div className="truncate text-sm">
              {levelsByKey.get(assignment.levelKey)?.label ?? ''}
            </div>
            <div className="font-mono text-sm">
              {(
                assignment.discrimination ?? form.defaultDiscrimination
              ).toFixed(2)}
            </div>
            <div className="font-mono text-sm">
              {(
                difficultyByLevelKey.get(assignment.levelKey) ?? assignment.b
              ).toFixed(2)}
            </div>
            <div className="font-mono text-sm">{assignment.c.toFixed(2)}</div>
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
            <div className="text-sm">
              {t(
                assignment.enablePercentInput
                  ? 'manage.competenceTree.yes'
                  : 'manage.competenceTree.no'
              )}
            </div>
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
          </div>
        ))}

        {assignments.length === 0 && (
          <div className="p-6 text-center text-sm text-slate-600">
            {t(
              selectedCell
                ? 'manage.competenceTree.noFilteredAssignments'
                : 'manage.competenceTree.noAssignments'
            )}
          </div>
        )}
      </div>
    </section>
  )
}

export default AssignmentTable
