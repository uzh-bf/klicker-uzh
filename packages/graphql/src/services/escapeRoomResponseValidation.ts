import * as DB from '@klicker-uzh/prisma/client'
import type { ElementData, StackResponseInput } from '@klicker-uzh/types'
import { isValidQrScanCode } from '@klicker-uzh/types'

type EscapeRoomResponseInstance = Pick<
  DB.ElementInstance,
  'id' | 'elementType' | 'elementData'
>

export function hasEscapeRoomSampleSolution(
  instance: EscapeRoomResponseInstance
) {
  if (instance.elementType === DB.ElementType.QR_SCAN) return true
  const elementData = instance.elementData
  return !!(
    elementData &&
    'hasSampleSolution' in elementData.options &&
    elementData.options.hasSampleSolution
  )
}

function matchingElementData(
  instance: EscapeRoomResponseInstance,
  response: StackResponseInput
): ElementData | null {
  const elementData = instance.elementData
  return elementData?.type === response.type ? elementData : null
}

/**
 * Validates the wire shape before an escape-room response reaches grading.
 * Correctness is deliberately not checked here; this only proves that the
 * submitted value is complete, bounded, and belongs to the matching element.
 */
export function isValidEscapeRoomResponseShape(
  instance: EscapeRoomResponseInstance,
  response: StackResponseInput,
  { requireSampleSolution = false }: { requireSampleSolution?: boolean } = {}
) {
  const elementData = matchingElementData(instance, response)
  if (!elementData) return false
  if (requireSampleSolution && !hasEscapeRoomSampleSolution(instance)) {
    return false
  }

  if (response.type === DB.ElementType.QR_SCAN) {
    return (
      typeof response.qrScanResponse === 'string' &&
      isValidQrScanCode(response.qrScanResponse)
    )
  }

  if (
    (response.type === DB.ElementType.SC ||
      response.type === DB.ElementType.MC ||
      response.type === DB.ElementType.KPRIM) &&
    (elementData.type === DB.ElementType.SC ||
      elementData.type === DB.ElementType.MC ||
      elementData.type === DB.ElementType.KPRIM)
  ) {
    const expectedIds = elementData.options.choices.map((choice) => choice.ix)
    const submittedChoices = response.choicesResponse
    const responseIds = submittedChoices?.map((choice) => choice.ix)
    return !!(
      submittedChoices &&
      responseIds &&
      (responseIds.length > 0 || response.type === DB.ElementType.KPRIM) &&
      (response.type !== DB.ElementType.SC || responseIds.length === 1) &&
      new Set(responseIds).size === responseIds.length &&
      submittedChoices.every(
        (choice) => choice.selected && expectedIds.includes(choice.ix)
      )
    )
  }

  if (
    response.type === DB.ElementType.NUMERICAL &&
    elementData.type === DB.ElementType.NUMERICAL
  ) {
    const value = response.numericalResponse
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value > 1e30 ||
      value < -1e30
    ) {
      return false
    }
    const restrictions = elementData.options.restrictions
    return !(
      (typeof restrictions?.min === 'number' && value < restrictions.min) ||
      (typeof restrictions?.max === 'number' && value > restrictions.max)
    )
  }

  if (
    response.type === DB.ElementType.FREE_TEXT &&
    elementData.type === DB.ElementType.FREE_TEXT
  ) {
    const value = response.freeTextResponse
    return !!(
      typeof value === 'string' &&
      value !== '' &&
      (!elementData.options.restrictions?.maxLength ||
        value.length <= elementData.options.restrictions.maxLength)
    )
  }

  if (
    response.type === DB.ElementType.SELECTION &&
    elementData.type === DB.ElementType.SELECTION
  ) {
    const responseIds = response.selectionResponse
    const allowedIds = elementData.options.answerCollection?.entries.map(
      (entry) => entry.id
    )
    return !!(
      responseIds &&
      allowedIds &&
      responseIds.length === elementData.options.numberOfInputs &&
      new Set(responseIds).size === responseIds.length &&
      responseIds.every((id) => allowedIds.includes(id))
    )
  }

  if (
    response.type === DB.ElementType.CASE_STUDY &&
    elementData.type === DB.ElementType.CASE_STUDY
  ) {
    const caseResponses = response.caseStudyResponse
    const expectedCaseIds = elementData.options.cases.map((item) => item.id)
    const expectedItemIds = elementData.options.collectionItemIds ?? []
    const criteria = elementData.options.criteria
    return !!(
      caseResponses &&
      caseResponses.length === expectedCaseIds.length &&
      new Set(caseResponses.map((item) => item.caseId)).size ===
        caseResponses.length &&
      caseResponses.every(
        (caseResponse) =>
          expectedCaseIds.includes(caseResponse.caseId) &&
          caseResponse.itemResponses.length === expectedItemIds.length &&
          new Set(
            caseResponse.itemResponses.map(
              (itemResponse) => itemResponse.itemId
            )
          ).size === caseResponse.itemResponses.length &&
          caseResponse.itemResponses.every(
            (itemResponse) =>
              expectedItemIds.includes(itemResponse.itemId) &&
              itemResponse.criterionResponses.length === criteria.length &&
              new Set(
                itemResponse.criterionResponses.map(
                  (criterionResponse) => criterionResponse.criterionId
                )
              ).size === itemResponse.criterionResponses.length &&
              itemResponse.criterionResponses.every((criterionResponse) => {
                const criterion = criteria.find(
                  (item) => item.id === criterionResponse.criterionId
                )
                return !!(
                  criterion &&
                  Number.isFinite(criterionResponse.response) &&
                  criterionResponse.response >= criterion.min &&
                  criterionResponse.response <= criterion.max
                )
              })
          )
      )
    )
  }

  return false
}

export function hasExactEscapeRoomResponseSet({
  instances,
  responses,
  validateShape = false,
  requireSampleSolution = false,
}: {
  instances: EscapeRoomResponseInstance[]
  responses: StackResponseInput[]
  validateShape?: boolean
  requireSampleSolution?: boolean
}) {
  const requiredById = new Map(
    instances.map((instance) => [instance.id, instance])
  )
  const responseIds = responses.map((response) => response.instanceId)
  return (
    instances.length > 0 &&
    responses.length === instances.length &&
    new Set(responseIds).size === responses.length &&
    responses.every((response) => {
      const instance = requiredById.get(response.instanceId)
      return !!(
        instance &&
        instance.elementType === response.type &&
        (!validateShape ||
          isValidEscapeRoomResponseShape(instance, response, {
            requireSampleSolution,
          }))
      )
    })
  )
}
