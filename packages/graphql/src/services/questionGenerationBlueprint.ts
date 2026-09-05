import { basename } from 'node:path'
import type {
  KBGraphSourceSnapshot,
  QuestionGenerationConfiguration,
} from '@klicker-uzh/types'

const MODULE_ID = 'M1'

function sourceBasename(sourceFile: string): string {
  return basename(sourceFile.replaceAll('\\', '/'))
}

export async function createQuestionGenerationBlueprint(
  configuration: QuestionGenerationConfiguration,
  sourceSnapshot: KBGraphSourceSnapshot
): Promise<Buffer> {
  const sourcesById = new Map(
    sourceSnapshot.map((source) => [source.resourceId, source])
  )
  const selectedIds = new Set<string>()

  for (const scope of configuration.sourceScopes) {
    if (!sourcesById.has(scope.resourceId)) {
      throw new Error(
        'Normalized question-generation source is absent from the graph snapshot'
      )
    }
    if (selectedIds.has(scope.resourceId)) {
      throw new Error('Normalized question-generation source is duplicated')
    }
    selectedIds.add(scope.resourceId)
  }

  const unrestricted =
    configuration.sourceScopes.length === sourceSnapshot.length &&
    configuration.sourceScopes.every(
      (scope) => scope.pageFrom === null && scope.pageTo === null
    ) &&
    sourceSnapshot.every((source) => selectedIds.has(source.resourceId))

  const sources = unrestricted
    ? []
    : configuration.sourceScopes.map((scope) => {
        const source = sourcesById.get(scope.resourceId)!
        const unbounded = scope.pageFrom === null && scope.pageTo === null

        return {
          module_id: MODULE_ID,
          source_file: sourceBasename(source.sourceFile),
          page_from: unbounded
            ? source.pageCount === null
              ? null
              : 1
            : scope.pageFrom,
          page_to: unbounded ? source.pageCount : scope.pageTo,
        }
      })

  const payload = {
    assessment_profile: 'klicker_live',
    item_format:
      configuration.itemType === 'KPRIM'
        ? 'kprim'
        : configuration.itemType === 'MC'
          ? 'mc'
          : 'sc',
    objective_form: 1,
    modules: [
      {
        module_id: MODULE_ID,
        module_name: 'All material',
        scope_type: 'module',
        questions_d1: configuration.difficultyCounts.d1,
        questions_d2: configuration.difficultyCounts.d2,
        questions_d3: configuration.difficultyCounts.d3,
        questions_d4: configuration.difficultyCounts.d4,
        questions_d5: configuration.difficultyCounts.d5,
      },
    ],
    objectives: configuration.objectives.map((objective) => ({
      module_id: MODULE_ID,
      objective_id: objective.id,
      objective_text: objective.text,
      ...(objective.bloomLevel === null
        ? {}
        : { bloom_level: objective.bloomLevel }),
    })),
    sources,
    pool_allocation: [],
  }

  return Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}
