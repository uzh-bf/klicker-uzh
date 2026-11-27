import { useMutation } from '@apollo/client'
import { MSaveAdaptivePracticeQuizAttemptReviewDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, Select, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { AdaptiveAttemptSummaryData } from './adaptiveAttemptCsv'
import { REVIEW_VERDICTS } from './reviewVerdicts'

const NONE = '__none__'

// The lecturer's check of one attempt: expected levels and whether the
// result matched. Feeds the accuracy summary and the CSV export.
function AdaptiveAttemptReviewForm({
  practiceQuizId,
  attempt,
  levelLabels,
  onSaved,
}: {
  practiceQuizId: string
  attempt: AdaptiveAttemptSummaryData
  levelLabels: string[]
  onSaved: () => void
}) {
  const t = useTranslations()
  const review = attempt.review
  const [verdict, setVerdict] = useState<string>(review?.verdict ?? NONE)
  const [overall, setOverall] = useState<string>(
    review?.expectedOverallLevelLabel ?? NONE
  )
  const [competences, setCompetences] = useState<Record<number, string>>(
    Object.fromEntries(
      (review?.expectedCompetenceLevels ?? []).map(({ nodeId, levelLabel }) => [
        nodeId,
        levelLabel,
      ])
    )
  )
  const [comment, setComment] = useState(review?.comment ?? '')
  const [save, { loading, error, data }] = useMutation(
    MSaveAdaptivePracticeQuizAttemptReviewDocument
  )
  const levelItems = [
    {
      value: NONE,
      label: t('manage.evaluation.adaptive.attemptDiagnostics.review.noLevel'),
    },
    ...levelLabels.map((label) => ({ value: label, label })),
  ]

  return (
    <form
      className="space-y-2 rounded border border-gray-200 bg-white p-3 text-xs"
      onSubmit={async (event) => {
        event.preventDefault()
        if (verdict === NONE) return
        await save({
          variables: {
            practiceQuizId,
            attemptCode: attempt.attemptCode,
            verdict,
            expectedOverallLevelLabel: overall === NONE ? null : overall,
            expectedCompetenceLevels: Object.entries(competences)
              .filter(([, levelLabel]) => levelLabel !== NONE)
              .map(([nodeId, levelLabel]) => ({
                nodeId: Number(nodeId),
                levelLabel,
              })),
            comment: comment.trim() || null,
          },
        })
        onSaved()
      }}
      data-cy="adaptive-attempt-review"
    >
      <div className="text-sm font-semibold">
        {t('manage.evaluation.adaptive.attemptDiagnostics.review.title')}
      </div>
      <div className="block">
        <span className="mb-0.5 block text-gray-700">
          {t('manage.evaluation.adaptive.attemptDiagnostics.review.verdict')}
        </span>
        <Select
          value={verdict}
          onChange={setVerdict}
          items={[
            {
              value: NONE,
              label: t(
                'manage.evaluation.adaptive.attemptDiagnostics.review.chooseVerdict'
              ),
            },
            ...REVIEW_VERDICTS.map((value) => ({
              value,
              label: t(
                `manage.evaluation.adaptive.attemptDiagnostics.review.verdicts.${value}`
              ),
            })),
          ]}
          data={{ cy: 'adaptive-attempt-review-verdict' }}
        />
      </div>
      <div className="block">
        <span className="mb-0.5 block text-gray-700">
          {t(
            'manage.evaluation.adaptive.attemptDiagnostics.review.expectedOverall',
            { level: attempt.overall.levelLabel ?? '–' }
          )}
        </span>
        <Select value={overall} onChange={setOverall} items={levelItems} />
      </div>
      {attempt.competences.map((competence) => (
        <div key={competence.nodeId} className="block">
          <span className="mb-0.5 block text-gray-700">
            {t(
              'manage.evaluation.adaptive.attemptDiagnostics.review.expectedCompetence',
              {
                competence: competence.name,
                level: competence.levelLabel ?? '–',
              }
            )}
          </span>
          <Select
            value={competences[competence.nodeId!] ?? NONE}
            onChange={(value) =>
              setCompetences((current) => ({
                ...current,
                [competence.nodeId!]: value,
              }))
            }
            items={levelItems}
          />
        </div>
      ))}
      <label className="block">
        <span className="mb-0.5 block text-gray-700">
          {t('manage.evaluation.adaptive.attemptDiagnostics.review.comment')}
        </span>
        <textarea
          className="w-full rounded border border-gray-300 p-1.5"
          rows={3}
          maxLength={2000}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          data-cy="adaptive-attempt-review-comment"
        />
      </label>
      {error ? <UserNotification type="error" message={error.message} /> : null}
      <div className="flex items-center justify-between gap-2">
        <span className="text-gray-500">
          {data
            ? t('manage.evaluation.adaptive.attemptDiagnostics.review.saved')
            : null}
        </span>
        <Button
          type="submit"
          disabled={verdict === NONE}
          loading={loading}
          data={{ cy: 'adaptive-attempt-review-save' }}
        >
          <Button.Label>
            {t('manage.evaluation.adaptive.attemptDiagnostics.review.save')}
          </Button.Label>
        </Button>
      </div>
    </form>
  )
}

export default AdaptiveAttemptReviewForm
