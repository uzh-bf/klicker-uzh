import {
  ChoicesQuestionData,
  FreeTextQuestionData,
  NumericalQuestionData,
  QuestionType,
} from '@klicker-uzh/graphql/dist/ops'

export default function formatResponse(
  questionData:
    | ChoicesQuestionData
    | FreeTextQuestionData
    | NumericalQuestionData
    | undefined,
  response: {} | number[] | string
) {
  if (
    questionData?.type === QuestionType.Sc ||
    questionData?.type === QuestionType.Mc
  ) {
    return { choices: response as number[] }
  } else if (questionData?.type === QuestionType.Kprim) {
    return {
      choices: Object.keys(response).flatMap<number[]>((key) =>
        response[key] === true ? [parseInt(key)] : []
      ),
    }
  } else {
    return { value: response as string }
  }
}
