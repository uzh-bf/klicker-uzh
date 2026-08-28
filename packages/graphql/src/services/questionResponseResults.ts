import { createHash } from 'node:crypto'
import {
  gradeQuestionCaseStudy,
  gradeQuestionFreeText,
  gradeQuestionKPRIM,
  gradeQuestionMC,
  gradeQuestionNumerical,
  gradeQuestionSC,
  gradeQuestionSelection,
} from '@klicker-uzh/grading'
import * as DB from '@klicker-uzh/prisma/client'
import type {
  CaseStudyElementData,
  CaseStudySolutionsObject,
  ChoicesElementData,
  ElementData,
  ElementInstanceResults,
  ElementResultsCaseStudy,
  ElementResultsChoices,
  ElementResultsOpen,
  ElementResultsSelection,
  FreeTextElementData,
  NumericalElementData,
  SelectionElementData,
  SingleQuestionResponseChoices,
} from '@klicker-uzh/types'
import { toLowerCase } from 'remeda'
import type { CaseStudyElementOptions, ResponseInput } from '../ops.js'

export function evaluateChoicesAnswerCorrectness({
  elementData,
  response,
}: {
  elementData: ChoicesElementData
  response: ResponseInput
}) {
  if (
    !('choices' in response) ||
    response.choices === null ||
    typeof response.choices === 'undefined' ||
    ((elementData.type === DB.ElementType.SC ||
      elementData.type === DB.ElementType.MC) &&
      response.choices.length === 0)
  ) {
    return null
  }

  const elementOptions = elementData.options
  const solution = elementOptions.choices.reduce<number[]>((acc, choice) => {
    if (choice.correct) return [...acc, choice.ix]
    return acc
  }, [])

  if (elementData.type === DB.ElementType.SC) {
    return gradeQuestionSC({
      responseCount: elementOptions.choices.length,
      response: response.choices,
      solution,
    })
  } else if (elementData.type === DB.ElementType.MC) {
    return gradeQuestionMC({
      responseCount: elementOptions.choices.length,
      response: response.choices,
      solution,
    })
  }

  return gradeQuestionKPRIM({
    responseCount: elementOptions.choices.length,
    response: response.choices,
    solution,
  })
}

export function evaluateNumericalAnswerCorrectness({
  elementData,
  response,
}: {
  elementData: NumericalElementData
  response: ResponseInput
}) {
  if (
    !('value' in response) ||
    response.value === null ||
    typeof response.value === 'undefined'
  ) {
    return null
  }

  return gradeQuestionNumerical({
    response: parseFloat(String(response.value)),
    solutionRanges: elementData.options.solutionRanges ?? [],
    exactSolutions: elementData.options.exactSolutions ?? [],
  })
}

export function evaluateFreeTextAnswerCorrectness({
  elementData,
  response,
  treatFTDefaultCorrect = false,
}: {
  elementData: FreeTextElementData
  response: ResponseInput
  treatFTDefaultCorrect?: boolean
}) {
  if (treatFTDefaultCorrect && !elementData.options.hasSampleSolution) {
    return 1
  }

  if (
    !('value' in response) ||
    response.value === null ||
    typeof response.value === 'undefined'
  ) {
    return null
  }

  return gradeQuestionFreeText({
    response: response.value,
    solutions: elementData.options.solutions ?? [],
  })
}

export function evaluateSelectionAnswerCorrectness({
  elementData,
  response,
}: {
  elementData: SelectionElementData
  response: ResponseInput
}) {
  if (!elementData.options.hasSampleSolution) {
    return 1
  }

  if (
    !('selection' in response) ||
    !response.selection ||
    response.selection.length === 0
  ) {
    return null
  }

  return gradeQuestionSelection({
    numberOfInputs: elementData.options.numberOfInputs!,
    response: response.selection,
    correctAnswers: elementData.options.answerCollectionSolutionIds,
  })
}

export function evaluateCaseStudyAnswerCorrectness({
  elementData,
  response,
}: {
  elementData: CaseStudyElementData
  response: ResponseInput
}) {
  if (!elementData.options.hasSampleSolution) {
    return 1
  }

  if (
    !('assessment' in response) ||
    !response.assessment ||
    response.assessment.length === 0
  ) {
    return null
  }

  const hasSolutions = elementData.options.cases.every(
    (caseItem) => caseItem.solutions && caseItem.solutions.length > 0
  )
  return hasSolutions
    ? gradeQuestionCaseStudy({
        response: response.assessment,
        solutions: elementData.options.cases.map((caseItem) => ({
          caseId: caseItem.id,
          itemSolutions: caseItem.solutions!,
        })),
      })
    : null
}

export function updateChoicesResults({
  previousResults,
  response,
}: {
  previousResults: ElementResultsChoices
  response: ResponseInput
}): { results: ElementResultsChoices; modified: boolean } {
  const results = previousResults
  const updatedResults = results

  if (
    !('choices' in response) ||
    response.choices === null ||
    typeof response.choices === 'undefined'
  ) {
    return { results, modified: false }
  }

  updatedResults.choices = (
    response as SingleQuestionResponseChoices
  ).choices.reduce((acc, choiceResponse) => {
    acc[choiceResponse.ix] = (acc[choiceResponse.ix] ?? 0) + 1
    return acc
  }, results.choices)
  updatedResults.total = results.total + 1
  return { results: updatedResults, modified: true }
}

export function updateNumericalResults({
  previousResults,
  elementData,
  response,
  correct,
}: {
  previousResults: ElementResultsOpen
  elementData: ElementData
  response: ResponseInput
  correct?: boolean
}): { results: ElementResultsOpen; modified: boolean } {
  if (elementData.type !== DB.ElementType.NUMERICAL) {
    return { results: previousResults, modified: false }
  }

  const MD5 = createHash('md5')
  const results = previousResults
  const updatedResults = results

  if (
    !('value' in response) ||
    typeof response.value === 'undefined' ||
    response.value === null ||
    response.value === ''
  ) {
    return { results, modified: false }
  }

  const parsedValue = parseFloat(response.value)
  if (
    isNaN(parsedValue) ||
    (typeof elementData.options.restrictions?.min === 'number' &&
      parsedValue < elementData.options.restrictions.min) ||
    (typeof elementData.options.restrictions?.max === 'number' &&
      parsedValue > elementData.options.restrictions.max) ||
    parsedValue > 1e30 ||
    parsedValue < -1e30
  ) {
    return { results, modified: false }
  }

  const value = String(parsedValue)
  MD5.update(value)
  const hashedValue = MD5.digest('hex')

  if (Object.keys(results.responses).includes(hashedValue)) {
    updatedResults.responses = {
      ...results.responses,
      [hashedValue]: {
        ...results.responses[hashedValue]!,
        count: results.responses[hashedValue]!.count + 1,
      },
    }
  } else {
    updatedResults.responses = {
      ...results.responses,
      [hashedValue]: { value, count: 1, correct },
    }
  }
  updatedResults.total = results.total + 1
  return { results: updatedResults, modified: true }
}

export function updateFreeTextResults({
  previousResults,
  elementData,
  response,
  correct,
}: {
  previousResults: ElementResultsOpen
  elementData: ElementData
  response: ResponseInput
  correct?: boolean
}): { results: ElementResultsOpen; modified: boolean } {
  if (elementData.type !== DB.ElementType.FREE_TEXT) {
    return { results: previousResults, modified: false }
  }

  const MD5 = createHash('md5')
  const results = previousResults
  const updatedResults = results

  if (
    !('value' in response) ||
    typeof response.value === 'undefined' ||
    response.value === null ||
    response.value === '' ||
    (typeof elementData.options.restrictions?.maxLength === 'number' &&
      response.value.length > elementData.options.restrictions.maxLength)
  ) {
    return { results, modified: false }
  }

  const value = toLowerCase(response.value.trim())
  MD5.update(value)
  const hashedValue = MD5.digest('hex')

  if (Object.keys(results.responses).includes(hashedValue)) {
    updatedResults.responses = {
      ...results.responses,
      [hashedValue]: {
        ...results.responses[hashedValue]!,
        count: results.responses[hashedValue]!.count + 1,
      },
    }
  } else {
    updatedResults.responses = {
      ...results.responses,
      [hashedValue]: {
        value,
        count: 1,
        correct,
      },
    }
  }
  updatedResults.total = results.total + 1
  return { results: updatedResults, modified: true }
}

export function updateSelectionResults({
  previousResults,
  response,
}: {
  previousResults: ElementResultsSelection
  response: ResponseInput
}) {
  if (
    !('selection' in response) ||
    !response.selection ||
    response.selection.length === 0
  ) {
    return { results: previousResults, modified: false }
  }

  const updatedSelections = { ...previousResults.selections }
  response.selection.forEach((ix) => {
    if (ix in updatedSelections && typeof updatedSelections[ix] === 'number') {
      updatedSelections[ix] = updatedSelections[ix] + 1
    }
  })

  return {
    results: {
      selections: updatedSelections,
      total: previousResults.total + 1,
    },
    modified: true,
  }
}

export function convertCaseStudySolutionsObject({
  instance,
}: {
  instance: DB.ElementInstance
}): CaseStudySolutionsObject | undefined {
  const options = instance.elementData.options as CaseStudyElementOptions
  return options.hasSampleSolution
    ? options.cases.reduce<CaseStudySolutionsObject>((acc, caseObj) => {
        acc[caseObj.id] = caseObj.solutions!.reduce(
          (itemAcc, { itemId, criteriaSolutions }) => {
            itemAcc[String(itemId)] = criteriaSolutions.reduce(
              (criterionAcc, { criterionId, min, max }) => {
                criterionAcc[criterionId] = { min, max }
                return criterionAcc
              },
              {}
            )
            return itemAcc
          },
          {}
        )
        return acc
      }, {})
    : undefined
}

export function updateCaseStudyResults({
  previousResults,
  response,
  solutions,
}: {
  previousResults: ElementResultsCaseStudy
  response: ResponseInput
  solutions?: CaseStudySolutionsObject
}) {
  if (
    !('assessment' in response) ||
    !response.assessment ||
    response.assessment.length === 0
  ) {
    return { results: previousResults, modified: false }
  }

  const newAssessments = { ...previousResults.assessments }
  response.assessment.forEach((caseResponse) => {
    const caseId = caseResponse.caseId

    caseResponse.itemResponses.forEach((itemResponse) => {
      const itemId = itemResponse.itemId

      itemResponse.criterionResponses.forEach((criterionResponse) => {
        const criterionId = criterionResponse.criterionId
        const responseValue = criterionResponse.response
        const MD5 = createHash('md5')
        MD5.update(String(responseValue))
        const responseHash = MD5.digest('hex')
        const existingCombinedResponses =
          newAssessments[caseId]?.[String(itemId)]?.[criterionId]
        const sampleSolution =
          solutions?.[caseId]?.[String(itemId)]?.[criterionId]
        const responseCorrectness = sampleSolution
          ? responseValue >= sampleSolution.min - Number.EPSILON &&
            responseValue <= sampleSolution.max + Number.EPSILON
          : undefined

        if (!existingCombinedResponses) {
          throw new Error('Existing combined responses are missing')
        } else if (
          Object.keys(existingCombinedResponses).includes(responseHash)
        ) {
          newAssessments[caseId]![String(itemId)]![criterionId]![responseHash] =
            {
              ...existingCombinedResponses[responseHash]!,
              count: existingCombinedResponses[responseHash]!.count + 1,
            }
        } else {
          newAssessments[caseId]![String(itemId)]![criterionId]![responseHash] =
            {
              value: responseValue,
              count: 1,
              correct: responseCorrectness,
            }
        }
      })
    })
  })

  return {
    results: {
      assessments: newAssessments,
      total: previousResults.total + 1,
    },
    modified: true,
  }
}

export function updateQuestionResults({
  existingInstance,
  participation,
  response,
  caseStudySolutions,
  correctnessOverride,
}: {
  existingInstance: DB.ElementInstance
  participation: (DB.Participation & { participant: DB.Participant }) | null
  response: ResponseInput
  caseStudySolutions?: CaseStudySolutionsObject
  correctnessOverride?: number
}): {
  correctness: number | null
  results: ElementInstanceResults
  modified: boolean
} {
  let correctness: number | null
  const elementData = existingInstance.elementData
  const previousResults = participation
    ? existingInstance.results
    : existingInstance.anonymousResults

  if (
    (elementData.type === DB.ElementType.SC ||
      elementData.type === DB.ElementType.MC ||
      elementData.type === DB.ElementType.KPRIM) &&
    'choices' in previousResults
  ) {
    correctness = elementData.options.hasSampleSolution
      ? evaluateChoicesAnswerCorrectness({ elementData, response })
      : 1
    return {
      ...updateChoicesResults({ previousResults, response }),
      correctness,
    }
  } else if (
    elementData.type === DB.ElementType.NUMERICAL &&
    'responses' in previousResults
  ) {
    correctness = elementData.options.hasSampleSolution
      ? evaluateNumericalAnswerCorrectness({ elementData, response })
      : 1
    return {
      ...updateNumericalResults({
        previousResults,
        elementData,
        response,
        correct: correctness === 1,
      }),
      correctness,
    }
  } else if (
    elementData.type === DB.ElementType.FREE_TEXT &&
    'responses' in previousResults
  ) {
    correctness =
      correctnessOverride ??
      (elementData.options.hasSampleSolution
        ? evaluateFreeTextAnswerCorrectness({ elementData, response })
        : 1)
    return {
      ...updateFreeTextResults({
        previousResults,
        elementData,
        response,
        correct: correctness === 1,
      }),
      correctness,
    }
  } else if (
    elementData.type === DB.ElementType.SELECTION &&
    'selections' in previousResults
  ) {
    correctness = elementData.options.hasSampleSolution
      ? evaluateSelectionAnswerCorrectness({ elementData, response })
      : 1
    return {
      ...updateSelectionResults({ previousResults, response }),
      correctness,
    }
  } else if (
    elementData.type === DB.ElementType.CASE_STUDY &&
    'assessments' in previousResults
  ) {
    correctness = elementData.options.hasSampleSolution
      ? evaluateCaseStudyAnswerCorrectness({ elementData, response })
      : 1
    return {
      ...updateCaseStudyResults({
        previousResults,
        response,
        solutions: caseStudySolutions,
      }),
      correctness,
    }
  }

  return {
    correctness: null,
    results: previousResults,
    modified: true,
  }
}
