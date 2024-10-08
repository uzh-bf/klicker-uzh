import {
  ChoicesElementInstanceEvaluation,
  ElementInstanceEvaluation,
  ElementType,
  FreeElementInstanceEvaluation,
  NumericalElementInstanceEvaluation,
} from '@klicker-uzh/graphql/dist/ops'
import { EvaluationTableRowType } from '../charts/ElementTableChart'

interface UseEvaluationTableColumnsProps {
  instance: ElementInstanceEvaluation
}

function useEvaluationTableData({
  instance,
}: UseEvaluationTableColumnsProps): EvaluationTableRowType[] {
  if (
    instance.type === ElementType.Sc ||
    instance.type === ElementType.Mc ||
    instance.type === ElementType.Kprim
  ) {
    const results = (instance as ChoicesElementInstanceEvaluation).results
    return results.choices.map((choice) => {
      return {
        count: choice.count,
        value: choice.value,
        correct: choice.correct ?? false,
        percentage: choice.count / results.totalAnswers,
      }
    })
  } else if (instance.type === ElementType.Numerical) {
    // TODO: check why multiple identical numbers are treated as different values - e.g. 70 for Excel question
    const results = (instance as NumericalElementInstanceEvaluation).results

    return results.responseValues.map((response) => {
      return {
        count: response.count,
        value: response.value,
        correct: response.correct ?? false,
        percentage: response.count / results.totalAnswers,
      }
    })
  } else if (instance.type === ElementType.FreeText) {
    const results = (instance as FreeElementInstanceEvaluation).results
    return results.responses.map((response) => {
      return {
        count: response.count,
        value: response.value,
        correct: response.correct ?? false,
        percentage: response.count / results.totalAnswers,
      }
    })
  }

  return []
}

export default useEvaluationTableData
