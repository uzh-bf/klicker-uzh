import type { ElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { SMALL_BAR_THRESHOLD } from '../constants'

interface UseEvaluationBarChartDataProps {
  instance: ElementInstanceEvaluation
  // label bars with their share of all answers instead of the absolute count
  showPercentages?: boolean
}

function useEvaluationBarChartData({
  instance,
  showPercentages = false,
}: UseEvaluationBarChartDataProps) {
  const t = useTranslations()

  const labeledData = useMemo(() => {
    const label = (count: number, total: number) =>
      showPercentages
        ? `${total > 0 ? Math.round((count / total) * 100) : 0}%`
        : count

    if (instance.__typename === 'ChoicesActivityEvaluationData') {
      const results = instance.results
      return results.choices.map((choice, idx) => ({
        count: choice.count,
        labelIn:
          choice.count / results.totalAnswers > SMALL_BAR_THRESHOLD
            ? label(choice.count, results.totalAnswers)
            : undefined,
        labelOut:
          choice.count / results.totalAnswers <= SMALL_BAR_THRESHOLD
            ? label(choice.count, results.totalAnswers)
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
              ? label(results.incorrectCount, results.totalAnswers)
              : undefined,
          labelOut:
            results.incorrectCount / results.totalAnswers <= SMALL_BAR_THRESHOLD
              ? label(results.incorrectCount, results.totalAnswers)
              : undefined,
          xLabel: t('manage.evaluation.answerNotRemembered'),
        },
        {
          count: results.partialCount,
          labelIn:
            results.partialCount / results.totalAnswers > SMALL_BAR_THRESHOLD
              ? label(results.partialCount, results.totalAnswers)
              : undefined,
          labelOut:
            results.partialCount / results.totalAnswers <= SMALL_BAR_THRESHOLD
              ? label(results.partialCount, results.totalAnswers)
              : undefined,
          xLabel: t('manage.evaluation.answerPartiallyRemembered'),
        },
        {
          count: results.correctCount,
          labelIn:
            results.correctCount / results.totalAnswers > SMALL_BAR_THRESHOLD
              ? label(results.correctCount, results.totalAnswers)
              : undefined,
          labelOut:
            results.correctCount / results.totalAnswers <= SMALL_BAR_THRESHOLD
              ? label(results.correctCount, results.totalAnswers)
              : undefined,
          xLabel: t('manage.evaluation.answerRemembered'),
        },
      ]
    } else {
      return []
    }
  }, [instance, showPercentages, t])

  return labeledData
}

export default useEvaluationBarChartData
