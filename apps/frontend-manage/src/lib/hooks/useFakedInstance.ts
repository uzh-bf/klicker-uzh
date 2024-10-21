import {
  ChoicesQuestionData,
  ContentQuestionData,
  Element,
  FlashcardQuestionData,
  FreeTextQuestionData,
  NumericalQuestionData,
} from '@klicker-uzh/graphql/dist/ops'

function useFakedInstance({
  element,
  questionData,
}: {
  element?: Pick<Element, 'name' | 'content' | 'type'> | null
  questionData?:
    | Pick<ChoicesQuestionData, '__typename' | 'options'>
    | Pick<NumericalQuestionData, '__typename' | 'options'>
    | Pick<FreeTextQuestionData, '__typename' | 'options'>
    | Pick<FlashcardQuestionData, '__typename'>
    | Pick<ContentQuestionData, '__typename'>
    | null
}): ChoicesQuestionData | NumericalQuestionData | FreeTextQuestionData | null {
  if (!element || !questionData) {
    return null
  }

  const common = {
    id: '',
    instanceId: 0,
    content: element.content,
    name: element.name,
    type: element.type,
  }

  if (questionData.__typename === 'ChoicesQuestionData') {
    return {
      ...common,
      options: questionData.options,
    }
  } else if (questionData.__typename === 'NumericalQuestionData') {
    return {
      ...common,
      options: questionData.options,
    }
  } else if (questionData.__typename === 'FreeTextQuestionData') {
    return {
      ...common,
      options: questionData.options,
    }
  } else {
    return null
  }
}

export default useFakedInstance
