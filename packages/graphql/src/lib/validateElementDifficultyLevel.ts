import { ElementType } from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'

export function validateElementDifficultyLevel(
  difficultyLevel: number | null | undefined,
  elementType?: ElementType
): void {
  if (
    difficultyLevel !== null &&
    typeof difficultyLevel !== 'undefined' &&
    (!Number.isInteger(difficultyLevel) ||
      difficultyLevel < 1 ||
      difficultyLevel > 5)
  ) {
    throw new GraphQLError(
      'Element difficulty must be an integer from 1 to 5',
      {
        extensions: { code: 'ELEMENT_DIFFICULTY_INVALID' },
      }
    )
  }

  if (
    difficultyLevel !== null &&
    typeof difficultyLevel !== 'undefined' &&
    elementType !== undefined &&
    elementType !== ElementType.SC &&
    elementType !== ElementType.MC &&
    elementType !== ElementType.KPRIM
  ) {
    throw new GraphQLError(
      'Element difficulty is only supported for SC, MC, and KPRIM elements',
      {
        extensions: { code: 'ELEMENT_DIFFICULTY_INVALID' },
      }
    )
  }
}
