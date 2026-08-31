import * as DB from '@klicker-uzh/prisma/client'
import type { ElementData } from '@klicker-uzh/types'

export function hideSemanticFreeTextAuthoringData(
  elementData: ElementData
): ElementData {
  if (
    elementData.type !== DB.ElementType.FREE_TEXT ||
    !elementData.options.semanticEvaluation
  ) {
    return elementData
  }

  return {
    ...elementData,
    explanation: null,
    options: {
      ...elementData.options,
      semanticEvaluation: undefined,
      solutions: null,
    },
  }
}

export function hideSemanticFreeTextConfig(
  elementData: ElementData
): ElementData {
  if (
    elementData.type !== DB.ElementType.FREE_TEXT ||
    !elementData.options.semanticEvaluation
  ) {
    return elementData
  }

  return {
    ...elementData,
    options: {
      ...elementData.options,
      semanticEvaluation: undefined,
    },
  }
}
