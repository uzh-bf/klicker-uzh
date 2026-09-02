import * as DB from '@klicker-uzh/prisma/client'
import { ElementManipulationInput } from '@klicker-uzh/types'

function validateElementInputs({
  id,
  status,
  type,
  name,
  content,
  explanation,
  basePoints,
  pointsMultiplier,
}: Omit<ElementManipulationInput, 'tags' | 'options'>) {
  // validate if required fields are present when creating a new element
  if (typeof id === 'undefined' || id === null) {
    if (!status) {
      return false
    }
    if (!type) {
      return false
    }
    if (!name || name === '') {
      return false
    }
    if (!content || content.match(/^(<br>(\n)*)$/g) || content === '') {
      return false
    }
    if (
      type === DB.ElementType.FLASHCARD &&
      (!explanation ||
        explanation.match(/^(<br>(\n)*)$/g) ||
        explanation === '')
    ) {
      return false
    }
    if (
      typeof basePoints !== 'boolean' &&
      type !== DB.ElementType.CONTENT &&
      type !== DB.ElementType.FLASHCARD
    ) {
      return false
    }
    if (
      !pointsMultiplier &&
      type !== DB.ElementType.CONTENT &&
      type !== DB.ElementType.FLASHCARD
    ) {
      return false
    }
  }

  // validate enum values
  if (status && !Object.values(DB.ElementStatus).includes(status)) {
    return false
  }
  if (!Object.values(DB.ElementType).includes(type)) {
    return false
  }

  // if name is provided, it has to be a non-empty string
  if (
    typeof name !== 'undefined' &&
    (typeof name !== 'string' || name === '')
  ) {
    return false
  }

  // if content is provided, it has to be a string and non-empty
  if (
    typeof content !== 'undefined' &&
    (typeof content !== 'string' ||
      content.match(/^(<br>(\n)*)$/g) ||
      content === '')
  ) {
    return false
  }

  // if explanation is provided, it has to be a string and non-empty
  if (
    typeof explanation !== 'undefined' &&
    type === DB.ElementType.FLASHCARD &&
    (typeof explanation !== 'string' ||
      explanation.match(/^(<br>(\n)*)$/g) ||
      explanation === '')
  ) {
    return false
  }

  // if pointsMultiplier is provided, it has to be a number
  if (
    typeof pointsMultiplier !== 'undefined' &&
    (typeof pointsMultiplier !== 'number' || pointsMultiplier <= 0)
  ) {
    return false
  }

  return true
}

export default validateElementInputs
