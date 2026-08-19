import type {
  FreeTextElementOptions,
  FreeTextInstanceEvaluation,
  FreeTextPracticeStateDataFragment,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import FreeTextRubricBreakdown from './FreeTextRubricBreakdown'

interface FTEvaluationProps {
  options: FreeTextElementOptions
  evaluation?: FreeTextInstanceEvaluation
  semanticState?: FreeTextPracticeStateDataFragment | null
}

function FTEvaluation({
  options,
  evaluation,
  semanticState,
}: FTEvaluationProps) {
  const t = useTranslations()
  const solutions = options.solutions ? options.solutions : []

  if (semanticState?.solutionAuthorized) {
    return (
      <div className="flex flex-col gap-4" data-cy="semantic-solution-details">
        {semanticState.peerAnswers.length > 0 && (
          <div>
            <div className="font-bold">
              {t('pwa.practiceQuiz.othersAnswered')}
            </div>
            <div>
              {semanticState.peerAnswers
                .map((answer) => `${answer.value} (${answer.count})`)
                .join(', ')}
            </div>
          </div>
        )}
        {semanticState.referenceSolution && (
          <div>
            <div className="font-bold">
              {t('shared.generic.sampleSolution')}
            </div>
            <div>{semanticState.referenceSolution}</div>
          </div>
        )}
        <FreeTextRubricBreakdown
          result={semanticState.currentAttempt?.structuredResult}
        />
      </div>
    )
  }

  if (!evaluation) return null

  return (
    <div>
      {evaluation.answers && evaluation.answers.length > 0 ? (
        <div className="mb-4">
          <div className="font-bold">
            {t('pwa.practiceQuiz.othersAnswered')}
          </div>
          <div>
            {evaluation.answers
              .map((answer) => `${answer.value} (${answer.count})`)
              .filter((count) => typeof count !== 'undefined')
              .join(', ')}
          </div>
        </div>
      ) : null}
      {solutions.length > 0 && (
        <div>
          <div className="font-bold">{t('shared.generic.sampleSolution')}</div>
          <div>{solutions.join(', ')}</div>
        </div>
      )}
    </div>
  )
}

export default FTEvaluation
