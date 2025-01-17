import * as DB from '@klicker-uzh/prisma'
import { QuestionOptionsArgs } from './validateAndProcessElementOptions.js'

export interface ManipulateQuestionArgs {
  id?: number | null
  status?: DB.ElementStatus | null
  type: DB.ElementType
  name?: string | null
  content?: string | null
  explanation?: string | null
  options?: QuestionOptionsArgs | null
  pointsMultiplier?: number | null
  tags?: string[] | null
}

function validateElementInputs({
  id,
  status,
  type,
  name,
  content,
  explanation,
  pointsMultiplier,
}: Omit<ManipulateQuestionArgs, 'tags' | 'options'>) {
  // validate if required fields are present when creating a new element
  if (typeof id === 'undefined' || id === null) {
    if (!status) {
      console.error('Status is required')
      return false
    }
    if (!type) {
      console.error('Type is required')
      return false
    }
    if (!name || name === '') {
      console.error('Name is required')
      return false
    }
    if (!content || content.match(/^(<br>(\n)*)$/g) || content === '') {
      console.error('Content is required')
      return false
    }
    if (
      type === DB.ElementType.FLASHCARD &&
      (!explanation ||
        explanation.match(/^(<br>(\n)*)$/g) ||
        explanation === '')
    ) {
      console.error('Explanation is required for flashcards')
      return false
    }
    if (
      !pointsMultiplier &&
      type !== DB.ElementType.CONTENT &&
      type !== DB.ElementType.FLASHCARD
    ) {
      console.error(
        'Points multiplier is required (except for flashcard and content elements)'
      )
      return false
    }
  }

  // validate enum values
  if (status && !Object.values(DB.ElementStatus).includes(status)) {
    console.error('Invalid status')
    return false
  }
  if (!Object.values(DB.ElementType).includes(type)) {
    console.error('Invalid type')
    return false
  }

  // if name is provided, it has to be a non-empty string
  if (
    typeof name !== 'undefined' &&
    (typeof name !== 'string' || name === '')
  ) {
    console.error('Name must be a string')
    return false
  }

  // if content is provided, it has to be a string and non-empty
  if (
    typeof content !== 'undefined' &&
    (typeof content !== 'string' ||
      content.match(/^(<br>(\n)*)$/g) ||
      content === '')
  ) {
    console.error('Content must be a string')
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
    console.error('Explanation must be a string')
    return false
  }

  // if pointsMultiplier is provided, it has to be a number
  if (
    typeof pointsMultiplier !== 'undefined' &&
    typeof pointsMultiplier !== 'number'
  ) {
    console.error('Points multiplier must be a number')
    return false
  }

  return true
}

export default validateElementInputs
