import { normalizeAdaptiveLevelColor } from '@klicker-uzh/adaptive-contract'
import type { PrismaTransactionClient } from '@klicker-uzh/util'
import { GraphQLError } from 'graphql'

// Level colors are cosmetic presentation settings. They are editable at any
// time (also when a practice quiz locks the tree structure), never enter a
// publication snapshot, scale version, or fingerprint, and are resolved live
// from the tree levels when results are shown.

const MAX_LEVEL_COLOR_INPUTS = 20

export type CompetenceTreeLevelColorInput = {
  levelId: number
  color?: string | null
}

export function normalizeCompetenceTreeLevelColor(
  value: string | null | undefined
): string | null {
  const result = normalizeAdaptiveLevelColor(value)
  if (!result.valid) {
    throw new GraphQLError(
      'Level colors must be hex colors in the form #RRGGBB.',
      { extensions: { code: 'COMPETENCE_TREE_LEVEL_COLOR_INVALID' } }
    )
  }
  return result.color
}

/**
 * Sets (or clears, with null) the colors of existing levels of one tree.
 * The caller must hold the owner lock of the tree. Levels not listed keep
 * their color.
 */
export async function persistCompetenceTreeLevelColors(
  tx: PrismaTransactionClient,
  treeId: string,
  entries: readonly CompetenceTreeLevelColorInput[]
): Promise<void> {
  if (entries.length === 0) return
  if (entries.length > MAX_LEVEL_COLOR_INPUTS) {
    throw new GraphQLError(
      `At most ${MAX_LEVEL_COLOR_INPUTS} level colors can be saved at once.`,
      { extensions: { code: 'COMPETENCE_TREE_INPUT_TOO_LARGE' } }
    )
  }
  const normalized = entries.map((entry) => ({
    levelId: entry.levelId,
    color: normalizeCompetenceTreeLevelColor(entry.color),
  }))
  const levelIds = new Set(normalized.map(({ levelId }) => levelId))
  const existing = await tx.competenceTreeLevel.count({
    where: { treeId, id: { in: [...levelIds] } },
  })
  if (levelIds.size !== normalized.length || existing !== levelIds.size) {
    throw new GraphQLError(
      'Level colors must reference distinct levels of this competence tree.',
      { extensions: { code: 'COMPETENCE_TREE_LEVEL_COLOR_INVALID' } }
    )
  }
  for (const { levelId, color } of normalized) {
    await tx.competenceTreeLevel.update({
      where: { treeId_id: { treeId, id: levelId } },
      data: { color },
    })
  }
}

/** Live color per tree level id, for participant result bands. */
export function competenceTreeLevelColorsById(
  levels: ReadonlyArray<{ id: number; color: string | null }>
): Map<number, string> {
  return new Map(
    levels.flatMap(({ id, color }) => (color ? [[id, color] as const] : []))
  )
}
