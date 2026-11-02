import type { ContextWithUser } from '../lib/context.js'
import { questionGenerationServiceError } from './questionGenerationErrors.js'
import type {
  FlashcardGenerationRuntime,
  QuestionGenerationRuntime,
} from './questionGenerationRuntime.js'

export function isFlashcardGenerationRuntime(
  runtime: QuestionGenerationRuntime
): runtime is FlashcardGenerationRuntime {
  return (
    'startFlashcards' in runtime &&
    'publishIncompleteFlashcards' in runtime &&
    'findRunByFlashcardBuildId' in runtime
  )
}

export function requireFlashcardGenerationRuntime(
  ctx: ContextWithUser
): FlashcardGenerationRuntime {
  const runtime = ctx.elementGenerationRuntime
  if (!runtime || !isFlashcardGenerationRuntime(runtime)) {
    throw questionGenerationServiceError(
      'QUESTION_GENERATION_UNAVAILABLE',
      'Flashcard generation is not configured'
    )
  }
  return runtime
}
