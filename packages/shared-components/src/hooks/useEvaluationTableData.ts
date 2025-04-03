import { type ElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { type EvaluationTableRowType } from '../charts/ElementTableChart'

interface UseEvaluationTableColumnsProps {
  instance: ElementInstanceEvaluation
}

function useEvaluationTableData({
  instance,
}: UseEvaluationTableColumnsProps): EvaluationTableRowType[] {
  const t = useTranslations()

  if (instance.__typename === 'ChoicesActivityEvaluationData') {
    const results = instance.results
    return results.choices.map((choice) => ({
      count: choice.count,
      value: choice.value,
      correct: choice.correct ?? false,
      percentage:
        results.totalAnswers > 0 ? choice.count / results.totalAnswers : 0,
    }))
  } else if (instance.__typename === 'NumericalActivityEvaluationData') {
    // TODO: check why multiple identical numbers are treated as different values - e.g. 70 for Excel question
    const results = instance.results

    return results.responseValues.map((response) => ({
      count: response.count,
      value: response.value,
      correct: response.correct ?? false,
      percentage:
        results.totalAnswers > 0 ? response.count / results.totalAnswers : 0,
    }))
  } else if (instance.__typename === 'FreeTextActivityEvaluationData') {
    const results = instance.results
    return results.responses.map((response) => ({
      count: response.count,
      value: response.value,
      correct: response.correct ?? false,
      percentage:
        results.totalAnswers > 0 ? response.count / results.totalAnswers : 0,
    }))
  } else if (instance.__typename === 'SelectionActivityEvaluationData') {
    const results = instance.results
    const solutionIds = instance.results.answerSolutionIds

    return results.selectionResponses.map((response) => ({
      count: response.count,
      value: response.value,
      correct: solutionIds?.includes(response.answerId) ?? false,
      percentage:
        results.totalAnswers > 0 ? response.count / results.totalAnswers : 0,
      selectionRate:
        results.totalAnswers > 0
          ? (response.count / results.totalAnswers) * 100
          : 0,
    }))
  } else if (instance.__typename === 'FlashcardActivityEvaluationData') {
    const results = instance.results
    return [
      {
        count: results.incorrectCount,
        value: t('manage.evaluation.answerNotRemembered'),
        percentage: results.incorrectCount / results.totalAnswers,
        correct: false,
      },
      {
        count: results.partialCount,
        value: t('manage.evaluation.answerPartiallyRemembered'),
        percentage: results.partialCount / results.totalAnswers,
        correct: false,
      },
      {
        count: results.correctCount,
        value: t('manage.evaluation.answerRemembered'),
        percentage: results.correctCount / results.totalAnswers,
        correct: false,
      },
    ]
  }

  return []
}

export default useEvaluationTableData
