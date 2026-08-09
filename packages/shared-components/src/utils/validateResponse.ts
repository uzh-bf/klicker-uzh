import type {
  FreeTextElementOptions,
  NumericalElementOptions,
} from '@klicker-uzh/graphql/dist/ops'
import type {
  CaseStudyStudentResponseType,
  ChoicesStudentResponseType,
  SelectionStudentResponseType,
} from '../StudentElement'

export function validateScResponse({
  response,
}: {
  response?: ChoicesStudentResponseType
}) {
  return (
    typeof response !== 'undefined' &&
    response !== null &&
    Object.values(response).filter((value) => value === true).length === 1
  )
}

export function validateMcResponse({
  response,
}: {
  response?: ChoicesStudentResponseType
}) {
  return (
    typeof response !== 'undefined' &&
    response !== null &&
    Object.values(response).some((value) => value === true)
  )
}

export function validateKprimResponse({
  response,
}: {
  response?: ChoicesStudentResponseType
}) {
  return (
    typeof response !== 'undefined' &&
    response !== null &&
    Object.values(response).length === 4 &&
    Object.values(response).every((value) => typeof value === 'boolean')
  )
}

export function validateNumericalResponse({
  response,
  options,
}: {
  response?: string
  options: NumericalElementOptions
}) {
  if (!response) return false

  if (
    (typeof options.restrictions?.min !== 'undefined' &&
      options.restrictions?.min !== null &&
      parseFloat(response) < options.restrictions?.min) ||
    parseFloat(response) < -1e30 // prevent underflow
  ) {
    return false
  }

  if (
    (typeof options.restrictions?.max !== 'undefined' &&
      options.restrictions?.max !== null &&
      parseFloat(response) > options.restrictions?.max) ||
    parseFloat(response) > 1e30 // prevent overflow
  ) {
    return false
  }

  if (response === '-' || response === '' || response === '.') {
    return false
  }

  return true
}

export function validateFreeTextResponse({
  response,
  options,
}: {
  response?: string
  options: FreeTextElementOptions
}) {
  if (!response || response.length === 0) {
    return false
  }

  if (
    typeof options.restrictions?.maxLength !== 'undefined' &&
    options.restrictions.maxLength !== null &&
    response.length > options.restrictions.maxLength
  ) {
    return false
  }

  return true
}

export function validateSelectionResponse({
  response,
}: {
  response?: SelectionStudentResponseType
}) {
  // ensure that at least one option is selected and that selected answer options are unique
  if (
    !response ||
    Object.values(response).every(
      (value) => value === -1 || typeof value === 'undefined' || value === null
    ) ||
    new Set(
      Object.values(response).filter(
        (r) => r !== -1 && typeof r !== 'undefined' && r !== null
      )
    ).size !==
      Object.values(response).filter(
        (r) => r !== -1 && typeof r !== 'undefined' && r !== null
      ).length
  ) {
    return false
  }

  return true
}

export function validateCaseStudyResponse({
  response,
}: {
  response?: CaseStudyStudentResponseType
}) {
  // ensure that values for all items and criteria are defined before submitting
  if (
    !response ||
    Object.values(response).some((item) =>
      Object.values(item).some((criteriaResponses) =>
        Object.values(criteriaResponses).some(
          (value) => typeof value === 'undefined'
        )
      )
    )
  ) {
    return false
  }

  return true
}
