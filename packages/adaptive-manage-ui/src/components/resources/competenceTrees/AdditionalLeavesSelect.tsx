import { useTranslations } from 'next-intl'
import { getAdditionalLeafOptions } from './assignmentHelpers'
import { getBreadcrumb } from './treeHelpers'
import type { CompetenceTreeAssignmentForm, CompetenceTreeForm } from './types'

// An element stays one question: it is asked at most once per attempt and its
// single answer counts for the primary subcompetence and every selected one.
// Only other leaves of the primary leaf's root competence are offered.
function AdditionalLeavesSelect({
  form,
  assignment,
  disabled,
  onChange,
}: {
  form: CompetenceTreeForm
  assignment: CompetenceTreeAssignmentForm
  disabled: boolean
  onChange: (additionalLeafKeys: string[]) => void
}) {
  const t = useTranslations()
  const options = getAdditionalLeafOptions(form, assignment.leafKey)
  const optionKeys = new Set(options.map((leaf) => leaf.key))
  // Keep invalid selections (e.g. from another competence) visible so they
  // can be removed; the tree validation rejects them on save.
  const staleKeys = assignment.additionalLeafKeys.filter(
    (leafKey) => !optionKeys.has(leafKey)
  )
  if (options.length === 0 && staleKeys.length === 0) return null
  const selected = new Set(assignment.additionalLeafKeys)
  const choices = [
    ...options.map((leaf) => ({ key: leaf.key, stale: false })),
    ...staleKeys.map((key) => ({ key, stale: true })),
  ]

  return (
    <details
      className="basis-full text-sm"
      data-cy={`competence-tree-assigned-additional-${assignment.elementId}`}
    >
      <summary className="cursor-pointer text-slate-700">
        {t('manage.competenceTree.alsoCountsFor')}:{' '}
        {t('manage.competenceTree.alsoCountsForSummary', {
          count: assignment.additionalLeafKeys.length,
        })}
      </summary>
      <fieldset disabled={disabled} className="mt-2 space-y-1 pl-4">
        <legend className="sr-only">
          {t('manage.competenceTree.alsoCountsForLabel', {
            name: assignment.elementName,
          })}
        </legend>
        <p className="text-xs text-gray-500">
          {t('manage.competenceTree.alsoCountsForHelp')}
        </p>
        {choices.map(({ key, stale }) => (
          <label key={key} className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={selected.has(key)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...assignment.additionalLeafKeys, key]
                    : assignment.additionalLeafKeys.filter(
                        (leafKey) => leafKey !== key
                      )
                )
              }
              data-cy={`competence-tree-assigned-additional-${assignment.elementId}-${key}`}
            />
            <span className="min-w-0 break-words">
              {getBreadcrumb(form.nodes, key) || key}
              {stale && (
                <span className="block text-xs text-red-700">
                  {t('manage.competenceTree.alsoCountsForOtherCompetence')}
                </span>
              )}
            </span>
          </label>
        ))}
      </fieldset>
    </details>
  )
}

export default AdditionalLeavesSelect
