import { z } from 'zod'

const finite = z.number().finite()
const localId = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)

export const MAX_BANK_ANALYSIS_ITEMS = 10_000
export const MAX_BANK_ANALYSIS_BANKS = 500
export const MAX_BANK_ANALYSIS_THETAS = 2_000
export const MAX_BANK_ANALYSIS_WORK = 2_000_000

const itemSchema = z
  .object({
    localId,
    a: finite.positive().max(10),
    b: finite,
    c: finite.min(0).lt(1),
  })
  .strict()

export const bankAnalysisRequestSchema = z
  .object({
    contractVersion: z.literal(1),
    items: z.array(itemSchema).min(1).max(MAX_BANK_ANALYSIS_ITEMS),
    banks: z
      .array(
        z
          .object({
            localId,
            itemLocalIds: z.array(localId).min(1).max(MAX_BANK_ANALYSIS_ITEMS),
          })
          .strict()
      )
      .min(1)
      .max(MAX_BANK_ANALYSIS_BANKS),
    thetaPoints: z.array(finite).min(1).max(MAX_BANK_ANALYSIS_THETAS),
  })
  .strict()
  .superRefine((request, ctx) => {
    const itemIds = new Set(request.items.map(({ localId }) => localId))
    if (itemIds.size !== request.items.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate item local IDs' })
    if (
      new Set(request.banks.map(({ localId }) => localId)).size !==
      request.banks.length
    )
      ctx.addIssue({ code: 'custom', message: 'Duplicate bank local IDs' })
    let references = 0
    for (const bank of request.banks) {
      const ids = new Set(bank.itemLocalIds)
      if (ids.size !== bank.itemLocalIds.length)
        ctx.addIssue({
          code: 'custom',
          message: 'Duplicate bank item local IDs',
        })
      for (const id of ids) {
        if (!itemIds.has(id))
          ctx.addIssue({
            code: 'custom',
            message: 'Unknown bank item local ID',
          })
      }
      references += ids.size
    }
    if (references * request.thetaPoints.length > MAX_BANK_ANALYSIS_WORK)
      ctx.addIssue({
        code: 'custom',
        message: 'Bank analysis work exceeds limit',
      })
  })

export type BankAnalysisRequest = z.infer<typeof bankAnalysisRequestSchema>

export const bankAnalysisResponseSchema = z
  .object({
    contractVersion: z.literal(1),
    items: z.array(
      z
        .object({ localId, informationAtDifficulty: finite.nonnegative() })
        .strict()
    ),
    banks: z.array(
      z
        .object({
          localId,
          information: z.array(finite.nonnegative()),
          maximumInformation: z.array(finite.nonnegative()),
        })
        .strict()
    ),
  })
  .strict()

export type BankAnalysisResponse = z.infer<typeof bankAnalysisResponseSchema>

export function parseBankAnalysisResponse(
  input: unknown,
  request: BankAnalysisRequest
) {
  const response = bankAnalysisResponseSchema.parse(input)
  if (
    response.items.length !== request.items.length ||
    response.banks.length !== request.banks.length
  )
    throw new Error('Adaptive bank analysis response membership mismatch')
  const requestedItems = new Set(request.items.map(({ localId }) => localId))
  const requestedBanks = new Set(request.banks.map(({ localId }) => localId))
  if (
    new Set(response.items.map(({ localId }) => localId)).size !==
      response.items.length ||
    new Set(response.banks.map(({ localId }) => localId)).size !==
      response.banks.length ||
    response.items.some(({ localId }) => !requestedItems.has(localId)) ||
    response.banks.some(
      ({ localId, information, maximumInformation }) =>
        !requestedBanks.has(localId) ||
        information.length !== request.thetaPoints.length ||
        maximumInformation.length !== request.thetaPoints.length
    )
  )
    throw new Error('Adaptive bank analysis response membership mismatch')
  return response
}
