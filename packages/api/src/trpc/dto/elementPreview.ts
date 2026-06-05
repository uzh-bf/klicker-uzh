import { ElementType } from '@klicker-uzh/prisma/client'
import type { ElementData } from '@klicker-uzh/types'

function toPreviewElementDataBase(elementData: ElementData) {
  return {
    id: elementData.id,
    elementId: elementData.elementId,
    name: elementData.name,
    type: elementData.type,
    content: elementData.content,
    explanation: elementData.explanation ?? null,
    basePoints: elementData.basePoints,
    pointsMultiplier: elementData.pointsMultiplier,
  }
}

export function toPreviewElementData(elementData: ElementData) {
  const base = toPreviewElementDataBase(elementData)

  switch (elementData.type) {
    case ElementType.SC:
    case ElementType.MC:
    case ElementType.KPRIM:
      return {
        ...base,
        __typename: 'ChoicesElementData' as const,
        options: {
          __typename: 'ChoiceElementOptions' as const,
          hasSampleSolution: elementData.options.hasSampleSolution ?? null,
          hasAnswerFeedbacks: elementData.options.hasAnswerFeedbacks ?? null,
          displayMode: elementData.options.displayMode,
          choices: elementData.options.choices.map((choice) => ({
            ix: choice.ix,
            correct: choice.correct ?? null,
            feedback: choice.feedback ?? null,
            value: choice.value,
          })),
        },
      }

    case ElementType.NUMERICAL:
      return {
        ...base,
        __typename: 'NumericalElementData' as const,
        options: {
          __typename: 'NumericalElementOptions' as const,
          hasSampleSolution: elementData.options.hasSampleSolution ?? null,
          accuracy: elementData.options.accuracy ?? null,
          placeholder: elementData.options.placeholder ?? null,
          unit: elementData.options.unit ?? null,
          restrictions: elementData.options.restrictions ?? null,
          solutionRanges: elementData.options.solutionRanges ?? null,
          exactSolutions: elementData.options.exactSolutions ?? null,
        },
      }

    case ElementType.FREE_TEXT:
      return {
        ...base,
        __typename: 'FreeTextElementData' as const,
        options: {
          __typename: 'FreeTextElementOptions' as const,
          hasSampleSolution: elementData.options.hasSampleSolution ?? null,
          restrictions: elementData.options.restrictions ?? null,
          solutions: elementData.options.solutions ?? null,
        },
      }

    case ElementType.SELECTION:
      return {
        ...base,
        __typename: 'SelectionElementData' as const,
        options: {
          __typename: 'SelectionElementOptions' as const,
          hasSampleSolution: elementData.options.hasSampleSolution ?? null,
          numberOfInputs: elementData.options.numberOfInputs ?? null,
          answerCollection: elementData.options.answerCollection
            ? {
                __typename: 'ElementOptionsAnswerCollection' as const,
                id: elementData.options.answerCollection.id,
                entries: elementData.options.answerCollection.entries.map(
                  (entry) => ({
                    __typename: 'ElementOptionsAnswerCollectionEntry' as const,
                    id: entry.id,
                    value: entry.value,
                  })
                ),
              }
            : null,
          answerCollectionSolutionIds:
            elementData.options.answerCollectionSolutionIds ?? null,
        },
      }

    case ElementType.CASE_STUDY:
      return {
        ...base,
        __typename: 'CaseStudyElementData' as const,
        options: {
          __typename: 'CaseStudyElementOptions' as const,
          hasSampleSolution: elementData.options.hasSampleSolution ?? null,
          answerCollectionId: elementData.options.answerCollectionId ?? null,
          items:
            elementData.options.items?.map((item) => ({
              __typename: 'ElementOptionsAnswerCollectionEntry' as const,
              id: item.id,
              value: item.value,
            })) ?? null,
          criteria: elementData.options.criteria.map((criterion) => ({
            __typename: 'CaseStudyCriterion' as const,
            id: criterion.id,
            name: criterion.name,
            min: criterion.min,
            max: criterion.max,
            step: criterion.step,
            unit: criterion.unit ?? null,
            labels: criterion.labels
              ? {
                  __typename: 'CaseStudyCriterionLabels' as const,
                  min: criterion.labels.min,
                  mid: criterion.labels.mid ?? null,
                  max: criterion.labels.max,
                }
              : null,
          })),
          cases: elementData.options.cases.map((caseItem) => ({
            __typename: 'CaseStudyCase' as const,
            id: caseItem.id,
            title: caseItem.title,
            description: caseItem.description,
            solutions:
              caseItem.solutions?.map((solution) => ({
                __typename: 'CaseStudyCaseSolution' as const,
                itemId: solution.itemId,
                criteriaSolutions: solution.criteriaSolutions.map(
                  (criteriaSolution) => ({
                    __typename: 'CaseStudyCaseCriterionSolution' as const,
                    criterionId: criteriaSolution.criterionId,
                    min: criteriaSolution.min,
                    max: criteriaSolution.max,
                  })
                ),
              })) ?? null,
          })),
        },
      }

    case ElementType.FLASHCARD:
      return {
        ...base,
        __typename: 'FlashcardElementData' as const,
      }

    case ElementType.CONTENT:
      return {
        ...base,
        __typename: 'ContentElementData' as const,
      }
  }
}
