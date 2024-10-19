import {
  ChoiceQuestionOptions,
  ChoicesQuestionData,
  ContentElementQData,
  Element,
  ElementType,
  FlashcardElementQData,
  FreeTextElementData,
  FreeTextQuestionData,
  FreeTextQuestionOptions,
  NumericalElementData,
  NumericalQuestionData,
  NumericalQuestionOptions,
} from '@klicker-uzh/graphql/dist/ops'

function useFakedInstance({
  element,
  questionData,
}: {
  element?: Pick<Element, 'name' | 'content' | 'type'> | null
  questionData?:
    | Pick<ChoicesQuestionData, 'options'>
    | Pick<NumericalElementData, 'options'>
    | Pick<FreeTextElementData, 'options'>
    | Partial<FlashcardElementQData>
    | Partial<ContentElementQData>
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

  if (
    'options' in questionData &&
    (element.type === ElementType.Sc ||
      element.type === ElementType.Mc ||
      element.type === ElementType.Kprim)
  ) {
    return {
      ...common,
      options: questionData.options as ChoiceQuestionOptions,
    }
  } else if (
    'options' in questionData &&
    element.type === ElementType.Numerical
  ) {
    return {
      ...common,
      options: questionData.options as NumericalQuestionOptions,
    }
  } else if (
    'options' in questionData &&
    element.type === ElementType.FreeText
  ) {
    return {
      ...common,
      options: questionData.options as FreeTextQuestionOptions,
    }
  } else {
    return null
  }
}

export default useFakedInstance
