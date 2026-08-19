import { useTranslations } from 'next-intl'

type RubricAssessment = {
  rubricId: string
  rubricName: string
  proposedLevel: string
  rationale: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getRubricAssessments(value: unknown): RubricAssessment[] {
  if (!isRecord(value) || !Array.isArray(value.rubric_assessments)) return []

  return value.rubric_assessments.flatMap((assessment) => {
    if (
      !isRecord(assessment) ||
      typeof assessment.rubric_id !== 'string' ||
      typeof assessment.rubric_name !== 'string' ||
      typeof assessment.proposed_level !== 'string' ||
      typeof assessment.rationale !== 'string'
    ) {
      return []
    }

    return [
      {
        rubricId: assessment.rubric_id,
        rubricName: assessment.rubric_name,
        proposedLevel: assessment.proposed_level,
        rationale: assessment.rationale,
      },
    ]
  })
}

function FreeTextRubricBreakdown({ result }: { result: unknown }) {
  const t = useTranslations()
  const assessments = getRubricAssessments(result)
  if (assessments.length === 0) return null

  return (
    <section data-cy="semantic-rubric-breakdown">
      <h4 className="font-bold">
        {t('pwa.practiceQuiz.semanticRubricFeedback')}
      </h4>
      <div className="mt-2 flex flex-col gap-2">
        {assessments.map((assessment) => (
          <article
            key={assessment.rubricId}
            className="rounded-md border border-gray-200 bg-white p-3"
            data-cy={`semantic-rubric-result-${assessment.rubricId}`}
          >
            <div className="font-semibold">{assessment.rubricName}</div>
            <div className="text-sm">
              <span className="font-medium">
                {t('pwa.practiceQuiz.semanticAchievedLevel')}:{' '}
              </span>
              {assessment.proposedLevel}
            </div>
            <p className="mt-1 text-sm text-gray-700">{assessment.rationale}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export default FreeTextRubricBreakdown
