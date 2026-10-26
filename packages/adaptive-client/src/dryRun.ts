import { z } from 'zod'
import type { DryRunRequest } from './contract.js'
import { parseDecisionResponse } from './response.js'

const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)

const dryRunStudentSchema = z
  .object({
    index: z.number().int().positive(),
    trueLevels: z
      .array(z.object({ nodeId: id, levelId: id }).strict())
      .max(500),
    answers: z
      .array(
        z
          .object({
            poolItemId: id,
            levelId: id,
            correct: z.boolean(),
            flipped: z.boolean(),
          })
          .strict()
      )
      .max(1000),
    stopReason: z.string(),
    questionCount: z.number().int().nonnegative(),
    // Validated as the final IRT_V1 decision of the student's ledger.
    estimates: z.unknown(),
  })
  .strict()

export const dryRunResponseSchema = z
  .object({
    contractVersion: z.literal(1),
    measurementVersion: z.literal('IRT_V1'),
    students: z.array(dryRunStudentSchema).max(200),
  })
  .strict()

export function parseDryRunResponse(input: unknown, request: DryRunRequest) {
  const result = dryRunResponseSchema.parse(input)
  const fail = () => {
    throw new Error('Invalid adaptive engine dry-run response')
  }
  if (result.students.length !== request.dryRun.students) fail()
  const { dryRun, ...snapshot } = request
  const rootIds = new Set(
    request.nodes
      .filter(({ parentId }) => parentId === null)
      .map(({ id }) => id)
  )
  const levelIds = new Set(request.levels.map(({ id }) => id))
  const poolById = new Map(request.pool.map((item) => [item.id, item]))
  return {
    ...result,
    students: result.students.map((student, index) => {
      if (
        student.index !== index + 1 ||
        student.questionCount !== student.answers.length ||
        student.trueLevels.some(
          ({ nodeId, levelId }) =>
            !rootIds.has(nodeId) || !levelIds.has(levelId)
        ) ||
        student.answers.some(
          ({ poolItemId, levelId }) =>
            poolById.get(poolItemId)?.levelId !== levelId
        )
      )
        fail()
      const decision = parseDecisionResponse(
        {
          contractVersion: 1,
          measurementVersion: 'IRT_V1',
          nextPoolItemId: null,
          stopReason: student.stopReason,
          estimates: student.estimates,
        },
        {
          ...snapshot,
          routingSeed: dryRun.seed,
          responses: student.answers.map(({ poolItemId, correct }, order) => ({
            order: order + 1,
            poolItemId,
            correct,
          })),
        }
      )
      if (decision.measurementVersion !== 'IRT_V1') fail()
      return {
        ...student,
        stopReason: decision.stopReason!,
        estimates: decision.estimates as Extract<
          typeof decision,
          { measurementVersion: 'IRT_V1' }
        >['estimates'],
      }
    }),
  }
}
export type DryRunResponse = ReturnType<typeof parseDryRunResponse>
