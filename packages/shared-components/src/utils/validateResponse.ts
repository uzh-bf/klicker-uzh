import {
  FreeTextQuestionOptions,
  NumericalQuestionOptions,
} from '@klicker-uzh/graphql/dist/ops'

export function validateScResponse(response?: Record<number, boolean>) {
  return (
    typeof response !== 'undefined' &&
    response !== null &&
    Object.values(response).filter((value) => value === true).length === 1
  )
}

export function validateMcResponse(response?: Record<number, boolean>) {
  return (
    typeof response !== 'undefined' &&
    response !== null &&
    Object.values(response).some((value) => value === true)
  )
}

export function validateKprimResponse(response?: Record<number, boolean>) {
  return (
    typeof response !== 'undefined' &&
    response !== null &&
    Object.values(response).length === 4 &&
    Object.values(response).every((value) => typeof value === 'boolean')
  )
}

export function validateScResponseOld(response?: number[]) {
  return (
    typeof response !== 'undefined' && response !== null && response.length > 0
  )
}

export function validateMcResponseOld(response?: number[]) {
  return (
    typeof response !== 'undefined' && response !== null && response.length > 0
  )
}

export function validateKprimResponseOld(response?: Record<number, boolean>) {
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
  options: NumericalQuestionOptions
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
  options: FreeTextQuestionOptions
}) {
  if (!response || response.length == 0) {
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
