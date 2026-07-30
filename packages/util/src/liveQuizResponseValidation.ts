function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validateStudentResponse({
  type,
  response,
  restrictions,
}: {
  type: string | undefined
  response: unknown
  restrictions?: unknown
}): { valid: boolean; message?: string } {
  if (!isRecord(response)) {
    return {
      valid: false,
      message: `Invalid response object ${JSON.stringify(response)}`,
    }
  }

  if (type === 'SC' || type === 'MC' || type === 'KPRIM') {
    if (
      !Array.isArray(response.choices) ||
      response.choices.length === 0 ||
      !response.choices.every(
        (choice) =>
          isRecord(choice) &&
          typeof choice.ix === 'number' &&
          (typeof choice.selected === 'boolean' ||
            typeof choice.selected === 'undefined')
      )
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
    if (
      !Array.isArray(response.selection) ||
      response.selection.length === 0 ||
      response.selection.filter(
        (entry) =>
          entry !== -1 && typeof entry !== 'undefined' && entry !== null
      ).length === 0
    ) {
      return {
        valid: false,
        message: `Invalid response submitted for selection question ${JSON.stringify(response)}`,
      }
    }

    return { valid: true }
  }

  if (type === 'CASE_STUDY') {
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
