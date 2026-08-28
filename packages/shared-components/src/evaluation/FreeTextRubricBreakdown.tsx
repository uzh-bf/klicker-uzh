import {
  faChevronDown,
  faCircleCheck,
  faCircleHalfStroke,
  faCircleXmark,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { FreeTextEvaluationFeedback } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'

type RubricAssessment = {
  rubricId: string
  rubricName: string
  proposedLevel: string
  normalizedScore: number
  rationale: string
  feedback?: string
}

type RubricStatus = 'MET' | 'PARTIAL' | 'OPEN'

const STATUS_STYLES: Record<
  RubricStatus,
  {
    icon: IconDefinition
    iconClassName: string
    segmentClassName: string
    badgeClassName: string
    detailClassName: string
  }
> = {
  MET: {
    icon: faCircleCheck,
    iconClassName: 'text-uzh-darkgreen-100',
    segmentClassName: 'bg-uzh-darkgreen-100',
    badgeClassName: 'bg-uzh-darkgreen-20 text-uzh-darkgreen-100',
    detailClassName: 'border-uzh-darkgreen-60',
  },
  PARTIAL: {
    icon: faCircleHalfStroke,
    iconClassName: 'text-uzh-blue-100',
    segmentClassName: 'bg-uzh-blue-100',
    badgeClassName: 'bg-uzh-blue-20 text-uzh-blue-100',
    detailClassName: 'border-uzh-blue-40',
  },
  OPEN: {
    icon: faCircleXmark,
    iconClassName: 'text-uzh-red-100',
    segmentClassName: 'bg-uzh-red-100',
    badgeClassName: 'bg-uzh-red-20 text-uzh-red-100',
    detailClassName: 'border-uzh-red-40',
  },
}

function getFeedbackByRubric(
  result?: FreeTextEvaluationFeedback | null
): Map<string, string> {
  return new Map(
    (result?.feedbackProposals ?? []).flatMap((proposal) => {
      const feedback = proposal.feedback.trim()
      if (feedback.length === 0) return []

      return [[proposal.rubricId, feedback] as const]
    })
  )
}

function getRubricAssessments(
  result?: FreeTextEvaluationFeedback | null
): RubricAssessment[] {
  const feedbackByRubric = getFeedbackByRubric(result)

  return (result?.rubricAssessments ?? []).flatMap((assessment) => {
    const rationale = assessment.rationale.trim()
    if (
      !Number.isFinite(assessment.normalizedScore) ||
      rationale.length === 0
    ) {
      return []
    }

    return [
      {
        rubricId: assessment.rubricId,
        rubricName: assessment.rubricName,
        proposedLevel: assessment.proposedLevel,
        normalizedScore: Math.min(100, Math.max(0, assessment.normalizedScore)),
        rationale,
        feedback: feedbackByRubric.get(assessment.rubricId),
      },
    ]
  })
}

function getRubricStatus(normalizedScore: number): RubricStatus {
  if (normalizedScore >= 100) return 'MET'
  if (normalizedScore > 0) return 'PARTIAL'
  return 'OPEN'
}

function FreeTextRubricBreakdown({
  result,
}: {
  result?: FreeTextEvaluationFeedback | null
}) {
  const t = useTranslations()
  const assessments = getRubricAssessments(result)
  if (assessments.length === 0) return null

  const fullyMet = assessments.filter(
    (assessment) => getRubricStatus(assessment.normalizedScore) === 'MET'
  ).length

  return (
    <section
      className="rounded-md border border-gray-200 bg-white p-4"
      data-cy="semantic-rubric-breakdown"
    >
      <div data-cy="semantic-rubric-summary">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h4 className="font-bold">
              {t('pwa.practiceQuiz.semanticRubricFeedback')}
            </h4>
            <p className="text-sm text-gray-600">
              {t('pwa.practiceQuiz.semanticRubricCriterionCount', {
                count: assessments.length,
              })}
            </p>
          </div>
          <p className="text-sm font-semibold text-gray-700">
            {t('pwa.practiceQuiz.semanticRubricCriteriaMet', {
              met: fullyMet,
              total: assessments.length,
            })}
          </p>
        </div>

        <div className="mt-3 flex gap-1" aria-hidden="true">
          {assessments.map((assessment) => {
            const status = getRubricStatus(assessment.normalizedScore)
            return (
              <div
                key={assessment.rubricId}
                className={`h-2 min-w-0 flex-1 rounded-full ${STATUS_STYLES[status].segmentClassName}`}
              />
            )
          })}
        </div>

        <ul className="mt-3 flex flex-col gap-2">
          {assessments.map((assessment) => {
            const status = getRubricStatus(assessment.normalizedScore)
            const style = STATUS_STYLES[status]

            return (
              <li
                key={assessment.rubricId}
                className="flex min-w-0 items-center gap-2 text-sm"
                data-cy={`semantic-rubric-overview-${assessment.rubricId}`}
              >
                <FontAwesomeIcon
                  icon={style.icon}
                  className={style.iconClassName}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 break-words font-medium">
                  {assessment.rubricName}
                </span>
                <span
                  className={`max-w-1/2 break-words rounded-full px-2 py-0.5 text-right text-xs font-semibold ${style.badgeClassName}`}
                >
                  {assessment.proposedLevel}
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="mt-5 border-t border-gray-200 pt-4">
        <div className="flex items-center gap-2">
          <h5 className="font-bold">
            {t('pwa.practiceQuiz.semanticRubricDetails')}
          </h5>
          <span className="rounded-full bg-uzh-blue-20 px-2 py-0.5 text-xs font-semibold text-uzh-blue-100">
            {assessments.length}
          </span>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {assessments.map((assessment, index) => {
            const status = getRubricStatus(assessment.normalizedScore)
            const style = STATUS_STYLES[status]

            return (
              <details
                key={assessment.rubricId}
                open={index === 0}
                className={`group overflow-hidden rounded-md border bg-white ${style.detailClassName}`}
                data-cy={`semantic-rubric-result-${assessment.rubricId}`}
              >
                <summary
                  className="flex cursor-pointer list-none items-center gap-3 p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uzh-blue-100"
                  data-cy={`semantic-rubric-result-toggle-${assessment.rubricId}`}
                >
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${style.badgeClassName}`}
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-semibold">
                      {assessment.rubricName}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span
                        className={`text-xs font-semibold ${style.iconClassName}`}
                      >
                        {assessment.proposedLevel}
                      </span>
                      <span className="text-xs font-medium text-gray-600">
                        {t('pwa.practiceQuiz.semanticRubricScore', {
                          score: assessment.normalizedScore,
                        })}
                      </span>
                    </span>
                  </span>
                  <FontAwesomeIcon
                    icon={faChevronDown}
                    className="text-xs text-gray-500 transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <div className="border-t border-gray-200 bg-gray-50 p-3">
                  <div
                    className="border-l-4 border-uzh-blue-100 bg-white p-3"
                    data-cy={`semantic-rubric-ai-feedback-${assessment.rubricId}`}
                  >
                    <div className="text-sm font-semibold text-uzh-blue-100">
                      {t('pwa.practiceQuiz.semanticAiFeedback')}
                    </div>
                    <div className="mt-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                        {t('pwa.practiceQuiz.semanticWhyThisScore')}
                      </div>
                      <p className="mt-1 break-words text-sm leading-relaxed text-gray-700">
                        {assessment.rationale}
                      </p>
                    </div>
                    {assessment.feedback && (
                      <div className="mt-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                          {t('pwa.practiceQuiz.semanticHowToImprove')}
                        </div>
                        <p className="mt-1 break-words text-sm leading-relaxed text-gray-700">
                          {assessment.feedback}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </details>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default FreeTextRubricBreakdown
