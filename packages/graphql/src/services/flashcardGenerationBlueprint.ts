import type { FlashcardGenerationConfiguration } from '@klicker-uzh/types'

const MODULE_ID = 'M1'

export function createFlashcardGenerationBlueprint(
  configuration: FlashcardGenerationConfiguration
): Buffer {
  const payload = {
    assignment_seed: 0,
    slot_objective_overrides: [],
    modules: [
      {
        module_id: MODULE_ID,
        module_name: 'All material',
        flashcard_count: configuration.flashcardCount,
      },
    ],
    objectives: configuration.objectives.map((objective) => ({
      module_id: MODULE_ID,
      objective_id: objective.id,
      objective_text: objective.text,
    })),
  }

  return Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}
