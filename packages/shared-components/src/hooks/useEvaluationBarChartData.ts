import type { ElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { SMALL_BAR_THRESHOLD } from '../constants'

interface UseEvaluationBarChartDataProps {
  instance: ElementInstanceEvaluation
}

function useEvaluationBarChartData({
  instance,
}: UseEvaluationBarChartDataProps) {
  const t = useTranslations()

  const labeledData = useMemo(() => {
    if (instance.__typename === 'ChoicesActivityEvaluationData') {
      const results = instance.results
      return results.choices.map((choice, idx) => ({
        count: choice.count,
        labelIn:
          choice.count / results.totalAnswers > SMALL_BAR_THRESHOLD
            ? choice.count
            : undefined,
        labelOut:
          choice.count / results.totalAnswers <= SMALL_BAR_THRESHOLD
            ? choice.count
            : undefined,
        xLabel: String.fromCharCode(Number(idx) + 65),
      }))
    } else if (instance.__typename === 'FlashcardActivityEvaluationData') {
      const results = instance.results
      return [
        {
          count: results.incorrectCount,
          labelIn:
            results.incorrectCount / results.totalAnswers > SMALL_BAR_THRESHOLD
              ? results.incorrectCount
              : undefined,
          labelOut:
            results.incorrectCount / results.totalAnswers <= SMALL_BAR_THRESHOLD
              ? results.incorrectCount
              : undefined,
          xLabel: t('manage.evaluation.answerNotRemembered'),
        },
        {
          count: results.partialCount,
          labelIn:
            results.partialCount / results.totalAnswers > SMALL_BAR_THRESHOLD
              ? results.partialCount
              : undefined,
          labelOut:
            results.partialCount / results.totalAnswers <= SMALL_BAR_THRESHOLD
              ? results.partialCount
              : undefined,
          xLabel: t('manage.evaluation.answerPartiallyRemembered'),
        },
        {
          count: results.correctCount,
          labelIn:
            results.correctCount / results.totalAnswers > SMALL_BAR_THRESHOLD
              ? results.correctCount
              : undefined,
          labelOut:
            results.correctCount / results.totalAnswers <= SMALL_BAR_THRESHOLD
              ? results.correctCount
              : undefined,
          xLabel: t('manage.evaluation.answerRemembered'),
        },
      ]
    } else {
      return []
    }
  }, [instance, t])

  return labeledData
}

export default useEvaluationBarChartData
