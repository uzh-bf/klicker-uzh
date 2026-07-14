import * as DB from '@klicker-uzh/prisma/client'
import { ElementOptionsInput } from '@klicker-uzh/types'
import {
  canonicalizeElementAuthoringOptions,
  ElementDomainValidationError,
} from './elementDomain.js'

function validateAndProcessElementOptions(
  elementType: DB.ElementType,
  options?: ElementOptionsInput | null
) {
  try {
    return canonicalizeElementAuthoringOptions(elementType, options).options
  } catch (error) {
    if (error instanceof ElementDomainValidationError) return null
    throw error
  }
}

export default validateAndProcessElementOptions
