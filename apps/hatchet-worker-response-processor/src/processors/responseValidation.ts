import type {
  FreeTextRestrictions,
  LiveQuizResponseInput,
  NumericalRestrictions,
  PeerInstructionQuestionType,
} from '@klicker-uzh/types'

function isValidChoiceResponse(value: unknown): value is {
  ix: number
  selected?: boolean
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.ix === 'number' &&
    Number.isInteger(entry.ix) &&
    entry.ix >= 0 &&
    (typeof entry.selected === 'boolean' ||
      typeof entry.selected === 'undefined')
  )
}

export function validateStudentResponse({
  type,
  response,
  restrictions,
}: {
  type: PeerInstructionQuestionType | 'CONTENT'
  response: LiveQuizResponseInput
  restrictions?: NumericalRestrictions | FreeTextRestrictions
}): { valid: boolean; message?: string } {
  if (type === 'SC' || type === 'MC' || type === 'KPRIM') {
    // response should be of format { ix: number, selected: boolean | undefined }[]
    if (
      !Array.isArray(response.choices) ||
      response.choices.length === 0 ||
      !response.choices.every(isValidChoiceResponse) ||
      new Set(response.choices.map((entry) => entry.ix)).size !==
        response.choices.length
    ) {
      return {
        valid: false,
        message: `Invalid response submitted for choices question ${JSON.stringify(response)}`,
      }
    }

    // for single choice questions, only exactly one choice should be selected
    if (
      type === 'SC' &&
      response.choices.filter((entry) => entry.selected).length !== 1
    ) {
      return {
        valid: false,
        message: `Invalid response submitted for single choice question ${JSON.stringify(response)}`,
      }
    }

    // for multiple choice questions, at least one choice should be selected
    if (
      type === 'MC' &&
      response.choices.filter((entry) => entry.selected).length === 0
    ) {
      return {
        valid: false,
        message: `Invalid response submitted for multiple choice question ${JSON.stringify(response)}`,
      }
    }

    // for KPRIM questions, exactly four choices should be provided
    if (type === 'KPRIM' && response.choices.length !== 4) {
      return {
        valid: false,
        message: `Invalid response submitted for KPRIM question ${JSON.stringify(response)}`,
      }
    }

    // if all cases are passed, choices response is considered to be valid
    return { valid: true }
  }

  if (type === 'NUMERICAL') {
    // response should be a string containing one finite number
    const parsedResponse =
      typeof response.value === 'string' ? Number(response.value.trim()) : NaN
    if (
      typeof response.value !== 'string' ||
      !response.value.trim() ||
      !Number.isFinite(parsedResponse)
    ) {
      return {
        valid: false,
        message: `Invalid response submitted for numerical question ${JSON.stringify(response)}`,
      }
    }

    // if restrictions are defined, check that the parsed number is within the defined bounds
    if (
      restrictions &&
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
    // response should be a string
    if (typeof response.value !== 'string' || !response.value.trim()) {
      return {
        valid: false,
        message: `Invalid response submitted for free text question ${JSON.stringify(response)}`,
      }
    }

    // if restrictions are defined, check that the response satisfies them
    const trimmedResponse = response.value.trim()
    if (
      restrictions &&
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
    // response should be an array of numbers
    if (
      !Array.isArray(response.selection) ||
      response.selection.length === 0 ||
      !response.selection.every(
        (entry) =>
          typeof entry === 'number' && Number.isInteger(entry) && entry >= -1
      ) ||
      response.selection.every((entry) => entry === -1) // at least one selection must be made
    ) {
      return {
        valid: false,
        message: `Invalid response submitted for selection question ${JSON.stringify(response)}`,
      }
    }

    return { valid: true }
  }

  if (type === 'CASE_STUDY') {
    // response should be of the format { [caseId: string]: { [itemId: number]: { [criterionId: string]: number } } }
    if (
      !response.assessment ||
      Object.keys(response.assessment).length === 0 ||
      !Object.values(response.assessment).every(
        (caseValue) =>
          typeof caseValue === 'object' &&
          caseValue !== null &&
          Object.keys(caseValue).length > 0 &&
          Object.values(caseValue).every(
            (itemValue) =>
              typeof itemValue === 'object' &&
              itemValue !== null &&
              Object.keys(itemValue).length > 0 &&
              Object.values(itemValue).every(
                (criterionResponse) =>
                  typeof criterionResponse === 'number' &&
                  Number.isFinite(criterionResponse)
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
    // response should be boolean with value true
    return response.viewed
      ? { valid: true }
      : {
          valid: false,
          message: `Invalid response submitted for content question ${JSON.stringify(response)}`,
        }
  }

  return {
    valid: false,
    message: `Provided invalid question type in answer submission: ${type}`,
  }
}

export function normalizeStudentResponse(
  type: PeerInstructionQuestionType,
  response: LiveQuizResponseInput
): LiveQuizResponseInput {
  switch (type) {
    case 'SC':
    case 'MC':
    case 'KPRIM':
      return {
        choices: response.choices?.map(({ ix, selected }) => ({
          ix,
          selected,
        })),
      }
    case 'NUMERICAL':
      return { value: response.value }
    case 'FREE_TEXT':
      return { value: response.value?.trim() }
    case 'SELECTION':
      return { selection: response.selection }
    case 'CASE_STUDY':
      return { assessment: response.assessment }
  }
}
