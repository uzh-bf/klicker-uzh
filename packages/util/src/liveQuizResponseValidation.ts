function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parsePositiveInteger(value: string | undefined) {
  if (!value) return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function parseNumberArray(value: string | undefined): number[] | null {
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) &&
      parsed.every((entry) => Number.isInteger(entry))
      ? (parsed as number[])
      : null
  } catch {
    return null
  }
}

type CaseStudyResponseShape = {
  cases: string[]
  items: number[]
  criteria: { id: string; min: number; max: number }[]
}

function parseCaseStudyResponseShape(
  value: string | undefined
): CaseStudyResponseShape | null {
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(value)
    if (
      !isRecord(parsed) ||
      !Array.isArray(parsed.cases) ||
      !parsed.cases.every((entry) => typeof entry === 'string') ||
      !Array.isArray(parsed.items) ||
      !parsed.items.every((entry) => Number.isInteger(entry)) ||
      !Array.isArray(parsed.criteria) ||
      !parsed.criteria.every(
        (entry) =>
          isRecord(entry) &&
          typeof entry.id === 'string' &&
          typeof entry.min === 'number' &&
          Number.isFinite(entry.min) &&
          typeof entry.max === 'number' &&
          Number.isFinite(entry.max)
      )
    ) {
      return null
    }

    return parsed as CaseStudyResponseShape
  } catch {
    return null
  }
}

function hasExactKeys(record: Record<string, unknown>, expected: string[]) {
  const actual = Object.keys(record).sort()
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  )
}

export function validateStudentResponse({
  type,
  response,
  restrictions,
  instanceInfo,
}: {
  type: string | undefined
  response: unknown
  restrictions?: unknown
  instanceInfo?: Record<string, string>
}): { valid: boolean; message?: string } {
  if (!isRecord(response)) {
    return {
      valid: false,
      message: `Invalid response object ${JSON.stringify(response)}`,
    }
  }

  if (type === 'SC' || type === 'MC' || type === 'KPRIM') {
    const choiceCount = parsePositiveInteger(instanceInfo?.choiceCount)
    if (
      !Array.isArray(response.choices) ||
      response.choices.length === 0 ||
      (choiceCount !== null && response.choices.length !== choiceCount) ||
      !response.choices.every(
        (choice) =>
          isRecord(choice) &&
          (hasExactKeys(choice, ['ix']) ||
            hasExactKeys(choice, ['ix', 'selected'])) &&
          Number.isInteger(choice.ix) &&
          (choiceCount === null ||
            (Number(choice.ix) >= 0 && Number(choice.ix) < choiceCount)) &&
          (typeof choice.selected === 'boolean' ||
            typeof choice.selected === 'undefined')
      ) ||
      new Set(response.choices.map((choice) => choice.ix)).size !==
        response.choices.length
    ) {
      return {
        valid: false,
        message: `Invalid response submitted for choices question ${JSON.stringify(response)}`,
      }
    }

    if (
      type === 'SC' &&
      response.choices.filter((choice) => choice.selected).length !== 1
    ) {
      return {
        valid: false,
        message: `Invalid response submitted for single choice question ${JSON.stringify(response)}`,
      }
    }

    if (
      type === 'MC' &&
      response.choices.filter((choice) => choice.selected).length === 0
    ) {
      return {
        valid: false,
        message: `Invalid response submitted for multiple choice question ${JSON.stringify(response)}`,
      }
    }

    if (type === 'KPRIM' && response.choices.length !== 4) {
      return {
        valid: false,
        message: `Invalid response submitted for KPRIM question ${JSON.stringify(response)}`,
      }
    }

    return { valid: true }
  }

  if (type === 'NUMERICAL') {
    const parsedResponse =
      typeof response.value === 'string' && response.value.trim()
        ? Number(response.value.trim())
        : Number.NaN
    if (
      typeof response.value !== 'string' ||
      !Number.isFinite(parsedResponse)
    ) {
      return {
        valid: false,
        message: `Invalid response submitted for numerical question ${JSON.stringify(response)}`,
      }
    }

    if (
      isRecord(restrictions) &&
      (('min' in restrictions &&
        typeof restrictions.min === 'number' &&
        parsedResponse < restrictions.min) ||
        ('max' in restrictions &&
          typeof restrictions.max === 'number' &&
          parsedResponse > restrictions.max))
    ) {
      return {
        valid: false,
        message: `Numerical response ${parsedResponse} out of bounds for numerical question with restrictions ${JSON.stringify(restrictions)}`,
      }
    }

    return { valid: true }
  }

  if (type === 'FREE_TEXT') {
    if (!response.value || typeof response.value !== 'string') {
      return {
        valid: false,
        message: `Invalid response submitted for free text question ${JSON.stringify(response)}`,
      }
    }

    const trimmedResponse = response.value.trim()
    if (
      isRecord(restrictions) &&
      'maxLength' in restrictions &&
      typeof restrictions.maxLength === 'number' &&
      trimmedResponse.length > restrictions.maxLength
    ) {
      return {
        valid: false,
        message: `Free text response exceeds maximum length of ${restrictions.maxLength} characters for free text question`,
      }
    }

    return { valid: true }
  }

  if (type === 'SELECTION') {
    const numberOfInputs = parsePositiveInteger(instanceInfo?.numberOfInputs)
    const answerIds = parseNumberArray(instanceInfo?.selectionAnswerIds)
    if (
      !Array.isArray(response.selection) ||
      response.selection.length === 0 ||
      (numberOfInputs !== null &&
        response.selection.length !== numberOfInputs) ||
      !response.selection.every((entry) => Number.isInteger(entry)) ||
      (answerIds !== null &&
        !response.selection.every(
          (entry) => entry === -1 || answerIds.includes(entry)
        ))
    ) {
      return {
        valid: false,
        message: `Invalid response submitted for selection question ${JSON.stringify(response)}`,
      }
    }

    const selectedAnswerIds = response.selection.filter((entry) => entry !== -1)
    if (
      selectedAnswerIds.length === 0 ||
      new Set(selectedAnswerIds).size !== selectedAnswerIds.length
    ) {
      return {
        valid: false,
        message: `Invalid response submitted for selection question ${JSON.stringify(response)}`,
      }
    }

    return { valid: true }
  }

  if (type === 'CASE_STUDY') {
    const responseShape = parseCaseStudyResponseShape(
      instanceInfo?.caseStudyResponseShape
    )
    if (
      !isRecord(response.assessment) ||
      Object.keys(response.assessment).length === 0 ||
      !Object.values(response.assessment).every(
        (caseObject) =>
          isRecord(caseObject) &&
          Object.keys(caseObject).length > 0 &&
          Object.values(caseObject).every(
            (itemObject) =>
              isRecord(itemObject) &&
              Object.keys(itemObject).length > 0 &&
              Object.values(itemObject).every(
                (criterionResponse) => typeof criterionResponse === 'number'
              )
          )
      )
    ) {
      return {
        valid: false,
        message: `Invalid response submitted for case study question ${JSON.stringify(response)}`,
      }
    }

    if (responseShape) {
      const expectedCases = [...responseShape.cases].sort()
      const expectedItems = responseShape.items.map(String).sort()
      const expectedCriteria = responseShape.criteria
        .map((criterion) => criterion.id)
        .sort()
      if (
        !hasExactKeys(response.assessment, expectedCases) ||
        !Object.values(response.assessment).every(
          (caseObject) =>
            isRecord(caseObject) &&
            hasExactKeys(caseObject, expectedItems) &&
            Object.values(caseObject).every(
              (itemObject) =>
                isRecord(itemObject) &&
                hasExactKeys(itemObject, expectedCriteria) &&
                responseShape.criteria.every((criterion) => {
                  const value = itemObject[criterion.id]
                  return (
                    typeof value === 'number' &&
                    Number.isFinite(value) &&
                    value >= criterion.min &&
                    value <= criterion.max
                  )
                })
            )
        )
      ) {
        return {
          valid: false,
          message: `Invalid response submitted for case study question ${JSON.stringify(response)}`,
        }
      }
    }

    return { valid: true }
  }

  if (type === 'CONTENT') {
    if (response.viewed !== true) {
      return {
        valid: false,
        message: `Invalid response submitted for content question ${JSON.stringify(response)}`,
      }
    }

    return { valid: true }
  }

  return {
    valid: false,
    message: `Provided invalid question type in answer submission: ${type}`,
  }
}
