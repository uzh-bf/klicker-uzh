import { type ElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { type EvaluationTableRowType } from '../charts/ElementTableChart'

interface UseEvaluationTableColumnsProps {
  instance: ElementInstanceEvaluation
}

function useEvaluationTableData({
  instance,
}: UseEvaluationTableColumnsProps): EvaluationTableRowType[] {
  if (instance.__typename === 'ChoicesElementInstanceEvaluation') {
    const results = instance.results
    return results.choices.map((choice) => {
      return {
        count: choice.count,
        value: choice.value,
        correct: choice.correct ?? false,
        percentage:
          results.totalAnswers > 0 ? choice.count / results.totalAnswers : 0,
      }
    })
  } else if (instance.__typename === 'NumericalElementInstanceEvaluation') {
    // TODO: check why multiple identical numbers are treated as different values - e.g. 70 for Excel question
    const results = instance.results

    return results.responseValues.map((response) => {
      return {
        count: response.count,
        value: response.value,
        correct: response.correct ?? false,
        percentage:
          results.totalAnswers > 0 ? response.count / results.totalAnswers : 0,
      }
    })
  } else if (instance.__typename === 'FreeElementInstanceEvaluation') {
    const results = instance.results
    return results.responses.map((response) => {
      return {
        count: response.count,
        value: response.value,
        correct: response.correct ?? false,
        percentage:
          results.totalAnswers > 0 ? response.count / results.totalAnswers : 0,
      }
    })
  }

  return []
}

export default useEvaluationTableData
