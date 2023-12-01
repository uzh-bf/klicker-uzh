export function validateScResponse(response?: number[]) {
  return (
    typeof response !== 'undefined' && response !== null && response.length > 0
  )
}

export function validateMcResponse(response?: number[]) {
  return (
    typeof response !== 'undefined' && response !== null && response.length > 0
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

export function validateNumericalResponse({
  response,
  min,
  max,
}: {
  response?: string
  min?: number
  max?: number
}) {
  if (!response) return false

  if (
    typeof min !== 'undefined' &&
    min !== null &&
    parseFloat(response) < min
  ) {
    return false
  }

  if (
    typeof max !== 'undefined' &&
    max !== null &&
    parseFloat(response) > max
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
  maxLength,
}: {
  response?: string
  maxLength?: number
}) {
  return (
    typeof response !== 'undefined' &&
    response !== null &&
    response !== '' &&
    response.length !== 0 &&
    (maxLength ? response.length <= maxLength : true)
  )
}
