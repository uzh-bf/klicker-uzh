import {
  ChoicesQuestionData,
  Element,
  FreeTextQuestionData,
  NumericalQuestionData,
} from '@klicker-uzh/graphql/dist/ops'

function useFakedInstance({
  element,
}: {
  element?: Element | null
}): ChoicesQuestionData | NumericalQuestionData | FreeTextQuestionData | null {
  if (!element) {
    return null
  }

  const common = {
    id: '',
    instanceId: 0,
    content: element.content,
    name: element.name,
    type: element.type,
  }

  if (element.__typename === 'ChoicesElement') {
    return {
      ...common,
      options: element.options,
    }
  } else if (element.__typename === 'NumericalElement') {
    return {
      ...common,
      options: element.options,
    }
  } else if (element.__typename === 'FreeTextElement') {
    return {
      ...common,
      options: element.options,
    }
  } else {
    // TODO: extend this hook with flashcard and content element types (as soon as live quiz supports them)
    return null
  }
}

export default useFakedInstance
