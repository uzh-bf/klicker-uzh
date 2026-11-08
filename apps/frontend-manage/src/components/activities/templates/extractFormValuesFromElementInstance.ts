import {
  CaseStudyElementData,
  ChoicesElementData,
  ElementDisplayMode,
  ElementInstance,
  ElementStatus,
  ElementType,
  FreeTextElementData,
  NumericalElementData,
  SelectionElementData,
} from '@klicker-uzh/graphql/dist/ops'
import { nanoid } from 'nanoid'
import { sort } from 'remeda'
import {
  ElementFormTypes,
  ElementFormTypesCaseStudySolution,
  ElementFormTypesCaseStudySolutions,
} from '../../elements/manipulation/types'

function extractFormValuesFromElementInstance({
  instance,
}: {
  instance: ElementInstance
}): ElementFormTypes {
  const element = instance.elementData
  const sharedAttributes = {
    name: element.name,
    status: ElementStatus.Ready,
    content: element.content,
    explanation: element.explanation,
    tags: [],
    basePoints: element.basePoints,
    pointsMultiplier: String(element.pointsMultiplier),
  }

  if (
    element.type === ElementType.Sc ||
    element.type === ElementType.Mc ||
    element.type === ElementType.Kprim
  ) {
    const options = (element as ChoicesElementData).options

    return {
      ...sharedAttributes,
      type: element.type,
      options: {
        hasSampleSolution: options.hasSampleSolution ?? false,
        hasAnswerFeedbacks: options.hasAnswerFeedbacks ?? false,
        displayMode: options.displayMode,
        choices: sort(
          options.choices.map((choice) => ({
            ...choice,
            id: nanoid(),
          })),
          (a, b) => (a.ix > b.ix ? 1 : -1)
        ),
      },
    }
  } else if (element.type === ElementType.Numerical) {
    const options = (element as NumericalElementData).options

    return {
      ...sharedAttributes,
      type: ElementType.Numerical,
      options: {
        hasSampleSolution: options.hasSampleSolution ?? false,
        solutionType: options.exactSolutions ? 'exact' : 'range',
        accuracy: options.accuracy,
        unit: options.unit,
        restrictions: options.restrictions
          ? {
              min: options.restrictions.min,
              max: options.restrictions.max,
            }
          : undefined,
        solutionRanges: options.solutionRanges
          ? options.solutionRanges.map((range) => ({
              min: range.min,
              max: range.max,
            }))
          : undefined,
        exactSolutions: options.exactSolutions ?? undefined,
      },
    }
  } else if (element.type === ElementType.FreeText) {
    const options = (element as FreeTextElementData).options

    return {
      ...sharedAttributes,
      type: ElementType.FreeText,
      options: {
        hasSampleSolution: options.hasSampleSolution ?? false,
        restrictions: options.restrictions
          ? {
              maxLength: options.restrictions.maxLength,
            }
          : undefined,
        solutions: options.solutions,
      },
    }
  } else if (element.type === ElementType.Selection) {
    const options = (element as SelectionElementData).options

    return {
      ...sharedAttributes,
      type: ElementType.Selection,
      options: {
        hasSampleSolution: options.hasSampleSolution ?? false,
        numberOfInputs: String(options.numberOfInputs),
        answerCollection: options.answerCollection
          ? String(options.answerCollection?.id)
          : '',
        correctAnswers: options.answerCollectionSolutionIds ?? undefined,
      },
    }
  } else if (element.type === ElementType.CaseStudy) {
    const options = (element as CaseStudyElementData).options

    return {
      ...sharedAttributes,
      type: ElementType.CaseStudy,
      options: {
        hasSampleSolution: options.hasSampleSolution ?? false,
        answerCollection: options.answerCollectionId
          ? String(options.answerCollectionId)
          : '',
        selectedItems: options.items?.map((item) => item.id) ?? [],
        criteria:
          options.criteria?.map((criterion) => ({
            ...criterion,
            mode: !!criterion.labels ? 'steps' : 'range',
            min: criterion.min,
            max: criterion.max,
            step: String(criterion.step),
          })) ?? [],
        cases:
          options.cases.map((caseItem) => ({
            id: caseItem.id,
            title: caseItem.title,
            description: caseItem.description,
            solutions: options.hasSampleSolution
              ? caseItem.solutions!.reduce<ElementFormTypesCaseStudySolutions>(
                  (acc, solution) => {
                    const criteriaSolutions =
                      solution.criteriaSolutions.reduce<ElementFormTypesCaseStudySolution>(
                        (acc, sol) => {
                          acc[sol.criterionId] = {
                            min: String(sol.min),
                            max: String(sol.max),
                          }

                          return acc
                        },
                        {}
                      )

                    acc[`itemId-${solution.itemId}`] = criteriaSolutions
                    return acc
                  },
                  {}
                )
              : undefined,
          })) ?? [],
      },
    }
  } else if (element.type === ElementType.Flashcard) {
    return {
      ...sharedAttributes,
      type: ElementType.Flashcard,
      explanation: element.explanation ?? '',
    }
  } else if (element.type === ElementType.Content) {
    return {
      ...sharedAttributes,
      type: ElementType.Content,
    }
  } else if (element.type === ElementType.QrScan) {
    return {
      ...sharedAttributes,
      type: ElementType.QrScan,
    }
  }

  // default / fallback case (should not happen)
  return {
    type: ElementType.Sc,
    name: '',
    status: ElementStatus.Ready,
    content: '',
    explanation: '',
    tags: [],
    basePoints: true,
    pointsMultiplier: '1',
    options: {
      hasSampleSolution: false,
      hasAnswerFeedbacks: false,
      displayMode: ElementDisplayMode.List,
      choices: [
        {
          id: nanoid(),
          value: undefined,
          correct: false,
          feedback: undefined,
        },
      ],
    },
  }
}

export default extractFormValuesFromElementInstance
