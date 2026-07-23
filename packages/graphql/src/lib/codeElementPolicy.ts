import * as DB from '@klicker-uzh/prisma/client'

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
