import { MIN_PRODUCT_ITEMS_PER_COVERAGE_CELL } from '@klicker-uzh/adaptive-contract'
import { Button, NumberField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import ConfirmationModal from './ConfirmationModal'
import {
  applyCoverageBulkPlan,
  type CoverageBulkAction,
  type CoverageBulkPlan,
  planCoverageBulkAction,
} from './coverageBulkSelection'
import { parseNumberDraft } from './numberDraft'
import type { CompetenceTreeForm } from './types'

const MAX_MINIMUM = 1000

function CoverageBulkActions({
  form,
  onChange,
  leafKeys,
  scopeLabel,
  disabled,
}: {
  form: CompetenceTreeForm
  onChange: (form: CompetenceTreeForm) => void
  /** Leaves currently shown in the content blueprint. */
  leafKeys: string[]
  scopeLabel: string
  disabled: boolean
}) {
  const t = useTranslations()
  const [minimumDraft, setMinimumDraft] = useState(
    String(MIN_PRODUCT_ITEMS_PER_COVERAGE_CELL)
  )
  const [pending, setPending] = useState<{
    action: CoverageBulkAction
    plan: CoverageBulkPlan
  } | null>(null)

  const minimum = parseNumberDraft(minimumDraft, { min: 1, max: MAX_MINIMUM })
  const minimumValue =
    minimum.ok && Number.isInteger(minimum.value) ? minimum.value : null

  const plans = useMemo(() => {
    const plan = (action: CoverageBulkAction) => ({
      action,
      plan: planCoverageBulkAction(form, leafKeys, action),
    })
    return {
      empty: plan({ type: 'switchOffEmpty' }),
      below:
        minimumValue === null
          ? null
          : plan({ type: 'switchOffBelow', minimum: minimumValue }),
      on: plan({ type: 'switchOnAll' }),
    }
  }, [form, leafKeys, minimumValue])

  const buttonFor = (
    entry: { action: CoverageBulkAction; plan: CoverageBulkPlan } | null,
    label: string,
    cy: string
  ) => (
    <Button
      onClick={() => entry && setPending(entry)}
      disabled={disabled || !entry || entry.plan.cells.length === 0}
      data={{ cy }}
      className={{ root: 'h-9 text-sm' }}
    >
      <Button.Label>
        {t('manage.competenceTree.coverageBulk.actionWithCount', {
          label,
          count: entry?.plan.cells.length ?? 0,
        })}
      </Button.Label>
    </Button>
  )

  const confirmationMessage = (plan: CoverageBulkPlan) =>
    [
      t(
        plan.enabled
          ? 'manage.competenceTree.coverageBulk.confirmOnMessage'
          : 'manage.competenceTree.coverageBulk.confirmOffMessage',
        { cells: plan.cells.length, scope: scopeLabel }
      ),
      plan.disabledAssignmentKeys.length > 0
        ? t('manage.competenceTree.coverageBulk.assignmentsDisabled', {
            count: plan.disabledAssignmentKeys.length,
          })
        : null,
      plan.removedAdditionalLinks.length > 0
        ? t('manage.competenceTree.coverageBulk.linksRemoved', {
            count: plan.removedAdditionalLinks.length,
          })
        : null,
      plan.skippedLeafKeys.length > 0
        ? t('manage.competenceTree.coverageBulk.leavesSkipped', {
            count: plan.skippedLeafKeys.length,
          })
        : null,
      t('manage.competenceTree.coverageBulk.saveHint'),
    ]
      .filter(Boolean)
      .join(' ')

  return (
    <div
      className="mb-3 flex flex-wrap items-end gap-2 rounded border border-slate-200 bg-slate-50 p-3"
      data-cy="competence-tree-coverage-bulk"
    >
      <div className="w-full text-sm">
        <span className="font-semibold">
          {t('manage.competenceTree.coverageBulk.title')}
        </span>{' '}
        <span className="text-slate-600">
          {t('manage.competenceTree.coverageBulk.scope', {
            scope: scopeLabel,
            leaves: leafKeys.length,
          })}
        </span>
      </div>
      {buttonFor(
        plans.empty,
        t('manage.competenceTree.coverageBulk.switchOffEmpty'),
        'competence-tree-coverage-bulk-off-empty'
      )}
      <div className="flex items-end gap-2">
        <div className="w-24">
          <NumberField
            id="competence-tree-coverage-bulk-minimum"
            label={t('manage.competenceTree.coverageBulk.minimumLabel')}
            value={minimumDraft}
            onChange={setMinimumDraft}
            precision={0}
            max={MAX_MINIMUM}
            disabled={disabled}
            error={
              minimumValue === null
                ? t('manage.competenceTree.coverageBulk.minimumInvalid')
                : undefined
            }
            isTouched
            data={{ cy: 'competence-tree-coverage-bulk-minimum' }}
            className={{ input: 'h-9 text-sm' }}
          />
        </div>
        {buttonFor(
          plans.below,
          t('manage.competenceTree.coverageBulk.switchOffBelow', {
            minimum: minimumValue ?? '–',
          }),
          'competence-tree-coverage-bulk-off-below'
        )}
      </div>
      {buttonFor(
        plans.on,
        t('manage.competenceTree.coverageBulk.switchOnAll'),
        'competence-tree-coverage-bulk-on-all'
      )}

      {pending && (
        <ConfirmationModal
          title={t(
            pending.plan.enabled
              ? 'manage.competenceTree.coverageBulk.confirmOnTitle'
              : 'manage.competenceTree.coverageBulk.confirmOffTitle'
          )}
          message={confirmationMessage(pending.plan)}
          confirmLabel={t('manage.competenceTree.coverageBulk.confirm')}
          cancelLabel={t('manage.competenceTree.cancel')}
          destructive={!pending.plan.enabled}
          onConfirm={() => {
            // Re-plan against the current form so the change matches the
            // latest state even if it moved while the dialog was open.
            onChange(
              applyCoverageBulkPlan(
                form,
                planCoverageBulkAction(form, leafKeys, pending.action)
              )
            )
            setPending(null)
          }}
          onClose={() => setPending(null)}
          dataCy="competence-tree-coverage-bulk-modal"
        />
      )}
    </div>
  )
}

export default CoverageBulkActions
