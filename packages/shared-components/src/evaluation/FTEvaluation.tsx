import type {
  FreeTextElementOptions,
  FreeTextInstanceEvaluation,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'

interface FTEvaluationProps {
  options: FreeTextElementOptions
  evaluation: FreeTextInstanceEvaluation
}

function FTEvaluation({ options, evaluation }: FTEvaluationProps) {
  const t = useTranslations()
  const solutions = options.solutions ? options.solutions : []

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
