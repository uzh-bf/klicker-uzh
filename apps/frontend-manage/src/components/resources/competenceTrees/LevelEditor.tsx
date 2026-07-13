import {
  faArrowDown,
  faArrowUp,
  faPlus,
  faTrashCan,
} from '@fortawesome/free-solid-svg-icons'
import { mapLevelsToTheta } from '@klicker-uzh/adaptive-learning'
import { Button, TextField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import ConfirmationModal from './ConfirmationModal'
import IconAction from './IconAction'
import { getLeafNodes, getNextLocalKey } from './treeHelpers'
import { CompetenceTreeForm } from './types'

interface PendingLevelAction {
  message: string
  run: () => void
}

function LevelEditor({
  form,
  onChange,
  disabled,
}: {
  form: CompetenceTreeForm
  onChange: (form: CompetenceTreeForm) => void
  disabled: boolean
}) {
  const t = useTranslations()
  const [pendingAction, setPendingAction] = useState<PendingLevelAction | null>(
    null
  )
  const orderedLevels = useMemo(
    () => form.levels.slice().sort((a, b) => a.order - b.order),
    [form.levels]
  )
  const bands = useMemo(
    () =>
      mapLevelsToTheta(
        orderedLevels.map((level) => ({
          label: level.label,
          order: level.order,
        })),
        { min: form.thetaMin, max: form.thetaMax },
        form.levelMappingRule
      ),
    [form.levelMappingRule, form.thetaMax, form.thetaMin, orderedLevels]
  )

  const runWithAssignmentWarning = (message: string, run: () => void) => {
    if (form.assignments.length === 0) {
      run()
      return
    }
    setPendingAction({ message, run })
  }

  const moveLevel = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= orderedLevels.length) return

    runWithAssignmentWarning(
      t('manage.competenceTree.levelReorderWarning'),
      () => {
        const current = orderedLevels[index]
        const target = orderedLevels[targetIndex]
        onChange({
          ...form,
          levels: form.levels.map((level) => {
            if (level.key === current.key) {
              return { ...level, order: target.order }
            }
            if (level.key === target.key) {
              return { ...level, order: current.order }
            }
            return level
          }),
        })
      }
    )
  }

  const deleteLevel = (levelKey: string) => {
    runWithAssignmentWarning(
      t('manage.competenceTree.levelDeleteWarning'),
      () => {
        const levels = orderedLevels
          .filter((level) => level.key !== levelKey)
          .map((level, order) => ({ ...level, order }))
        onChange({
          ...form,
          levels,
          coverages: form.coverages.filter(
            (coverage) => coverage.levelKey !== levelKey
          ),
          assignments: form.assignments.filter(
            (assignment) => assignment.levelKey !== levelKey
          ),
        })
      }
    )
  }

  const addLevel = () => {
    const key = getNextLocalKey(
      form.levels.map((level) => level.key),
      'level'
    )
    const level = {
      key,
      label: t('manage.competenceTree.newLevel'),
      order: orderedLevels.length,
    }
    onChange({
      ...form,
      levels: [...form.levels, level],
      coverages: [
        ...form.coverages,
        ...getLeafNodes(form.nodes).map((leaf) => ({
          leafKey: leaf.key,
          levelKey: key,
          targetItemCount: 5,
          enabled: true,
        })),
      ],
    })
  }

  return (
    <section
      id="competence-tree-section-levels"
      tabIndex={-1}
      className="focus:outline-primary-80 scroll-mt-4 border-t border-slate-300 py-5 focus:outline focus:outline-2"
      data-cy="competence-tree-levels"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {t('manage.competenceTree.levelsTitle')}
          </h2>
          <p className="text-sm text-slate-600">
            {t('manage.competenceTree.levelsDescription')}
          </p>
        </div>
        <Button
          onClick={addLevel}
          disabled={disabled}
          data={{ cy: 'competence-tree-add-level' }}
        >
          <Button.Icon icon={faPlus} />
          <Button.Label>{t('manage.competenceTree.addLevel')}</Button.Label>
        </Button>
      </div>

      <div className="overflow-x-auto border-y border-slate-200">
        <div className="min-w-180 grid grid-cols-[minmax(16rem,1fr)_8rem_16rem_7rem] gap-3 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
          <div>{t('manage.competenceTree.levelLabel')}</div>
          <div>{t('manage.competenceTree.theta')}</div>
          <div>{t('manage.competenceTree.band')}</div>
          <div className="text-right">{t('manage.competenceTree.actions')}</div>
        </div>
        {orderedLevels.map((level, index) => {
          const band = bands[index]
          const lower = Number.isFinite(band.lowerBound)
            ? band.lowerBound.toFixed(2)
            : '-Infinity'
          const upper = Number.isFinite(band.upperBound)
            ? band.upperBound.toFixed(2)
            : 'Infinity'

          return (
            <div
              key={level.key}
              className="min-w-180 grid grid-cols-[minmax(16rem,1fr)_8rem_16rem_7rem] items-center gap-3 border-t border-slate-200 px-3 py-2 first:border-t-0"
              data-cy={`competence-tree-level-${index}`}
            >
              <TextField
                value={level.label}
                onChange={(label) =>
                  onChange({
                    ...form,
                    levels: form.levels.map((candidate) =>
                      candidate.key === level.key
                        ? { ...candidate, label }
                        : candidate
                    ),
                  })
                }
                disabled={disabled}
                data={{ cy: `competence-tree-level-label-${index}` }}
              />
              <div className="font-mono text-sm">{band.theta.toFixed(2)}</div>
              <div className="font-mono text-sm">
                {lower} - {upper}
              </div>
              <div className="flex justify-end gap-0.5">
                <IconAction
                  icon={faArrowUp}
                  label={t('manage.competenceTree.moveUp')}
                  onClick={() => moveLevel(index, -1)}
                  disabled={disabled || index === 0}
                  dataCy={`competence-tree-level-up-${index}`}
                />
                <IconAction
                  icon={faArrowDown}
                  label={t('manage.competenceTree.moveDown')}
                  onClick={() => moveLevel(index, 1)}
                  disabled={disabled || index === orderedLevels.length - 1}
                  dataCy={`competence-tree-level-down-${index}`}
                />
                <IconAction
                  icon={faTrashCan}
                  label={t('manage.competenceTree.deleteLevel')}
                  onClick={() => deleteLevel(level.key)}
                  disabled={disabled || orderedLevels.length === 1}
                  destructive
                  dataCy={`competence-tree-level-delete-${index}`}
                />
              </div>
            </div>
          )
        })}
      </div>

      {pendingAction && (
        <ConfirmationModal
          title={t('manage.competenceTree.assignmentsAffectedTitle')}
          message={pendingAction.message}
          confirmLabel={t('manage.competenceTree.confirm')}
          cancelLabel={t('manage.competenceTree.cancel')}
          onConfirm={() => {
            pendingAction.run()
            setPendingAction(null)
          }}
          onClose={() => setPendingAction(null)}
          dataCy="competence-tree-level-warning"
        />
      )}
    </section>
  )
}

export default LevelEditor
