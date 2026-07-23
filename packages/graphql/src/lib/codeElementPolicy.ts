import * as DB from '@klicker-uzh/prisma/client'

export {
  getCodeActivityStackViolation,
  type CodeActivityStackViolation,
} from '@klicker-uzh/types'

export function isAsynchronousActivityElementValid(
  type: DB.ElementType,
  hasSampleSolution?: boolean | null
) {
  return (
    type === DB.ElementType.FLASHCARD ||
    type === DB.ElementType.CONTENT ||
    type === DB.ElementType.FREE_TEXT ||
    type === DB.ElementType.CODE ||
    hasSampleSolution === true
  )
}

export function isTemplateElementTypeSupported(type: DB.ElementType) {
  return type !== DB.ElementType.CODE
}
