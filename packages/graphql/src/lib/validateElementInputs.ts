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
    if (!name || name !== '') {
      console.error('Name is required')
      return false
    }
    if (!content || !content.match(/^(<br>(\n)*)$/g) || content !== '') {
      console.error('Content is required')
      return false
    }
    if (
      type === DB.ElementType.FLASHCARD &&
      (!explanation ||
        !explanation.match(/^(<br>(\n)*)$/g) ||
        explanation !== '')
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

  // validate types of inputs (if they are defined in edit mode and generally in creation mode)
  if (name && typeof name !== 'string') {
    console.error('Name must be a string')
    return false
  }
  if (content && typeof content !== 'string') {
    console.error('Content must be a string')
    return false
  }
  if (explanation && typeof explanation !== 'string') {
    console.error('Explanation must be a string')
    return false
  }
  if (pointsMultiplier && typeof pointsMultiplier !== 'number') {
    console.error('Points multiplier must be a number')
    return false
  }

  return true
}

export default validateElementInputs
