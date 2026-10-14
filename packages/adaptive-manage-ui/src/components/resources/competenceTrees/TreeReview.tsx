import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { getAssignmentLeaves, hasUnmappedElements } from './assignmentHelpers'
import type { CompetenceTreeForm } from './types'

function TreeReview({
  form,
  onEdit,
}: {
  form: CompetenceTreeForm
  onEdit: (sectionId: string) => void
}) {
  const t = useTranslations()
  const leaves = getAssignmentLeaves(form)
  const unmapped = hasUnmappedElements(form)
  return (
    <section data-cy="competence-tree-review">
      <h2 className="text-lg font-semibold">
        {t('manage.competenceTree.reviewTitle')}
      </h2>
      <p className="mb-5 text-sm text-slate-600">
        {t('manage.competenceTree.reviewHint')}
      </p>
      <dl className="divide-y divide-slate-200 border-y border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <dt className="font-semibold">
              {form.displayName || t('manage.competenceTree.stepStructure')}
            </dt>
            <dd className="text-sm text-slate-600">
              {t('manage.competenceTree.reviewStructureCount', {
                roots: form.nodes.filter((node) => !node.parentKey).length,
                leaves: leaves.length,
              })}
            </dd>
          </div>
          <Button
            onClick={() => onEdit('competence-tree-section-metadata')}
            data={{ cy: 'competence-tree-review-edit-structure' }}
          >
            <Button.Label>
              {t('manage.competenceTree.editStructure')}
            </Button.Label>
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <dt className="font-semibold">
              {t('manage.competenceTree.stepQuestions')}
            </dt>
            <dd className="text-sm text-slate-600">
              {t('manage.competenceTree.reviewQuestionCount', {
                count: form.assignments.length,
              })}
            </dd>
            {unmapped && (
              <dd className="mt-1 text-sm text-red-700">
                {t('manage.competenceTree.reviewUnmapped')}
              </dd>
            )}
          </div>
          <Button
            onClick={() => onEdit('competence-tree-section-assignments')}
            data={{ cy: 'competence-tree-review-edit-questions' }}
          >
            <Button.Label>
              {t('manage.competenceTree.editQuestions')}
            </Button.Label>
          </Button>
        </div>
      </dl>
      {(!form.name.trim() || !form.displayName.trim()) && (
        <UserNotification type="warning" className={{ root: 'mt-4' }}>
          {t('manage.competenceTree.reviewMissingNames')}
        </UserNotification>
      )}
    </section>
  )
}
export default TreeReview
