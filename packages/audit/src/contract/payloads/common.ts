import { z } from 'zod'

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

export const uuidSchema = z.string().uuid()
export const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/)
export const stableCodeSchema = z.string().regex(/^[A-Z][A-Z0-9_]{1,127}$/)
export const utcIsoMillisecondsSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ])
)

const forbiddenEvidenceKeys = new Set([
  'accesstoken',
  'apikey',
  'authorizationheader',
  'connectionstring',
  'cookie',
  'cookies',
  'email',
  'header',
  'headers',
  'idtoken',
  'matriculationnumber',
  'password',
  'pincode',
  'refreshtoken',
  'request',
  'secret',
  'stacktrace',
  'studentid',
  'token',
  'username',
])

const forbiddenEvidenceKeyParts = new Set([
  'cookie',
  'email',
  'header',
  'matriculation',
  'password',
  'secret',
  'token',
])

const forbiddenEvidenceValuePatterns = [
  /(?:^|\s)Bearer\s+[A-Za-z0-9._~+/-]+/i,
  /(?:^|[?&])(sig|se|sp|sv|srt|ss)=[^\s&#]+/i,
  /(?:AccountKey|SharedAccessKey|SharedAccessSignature)\s*=/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
]

function normalizeKey(key: string): string {
  return key.replaceAll(/[^a-zA-Z0-9]/g, '').toLowerCase()
}

export function assertNoForbiddenEvidenceFields(
  value: JsonValue,
  path = 'payload'
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      assertNoForbiddenEvidenceFields(item, `${path}[${index}]`)
    })
    return
  }

  if (value === null || typeof value !== 'object') {
    if (
      typeof value === 'string' &&
      forbiddenEvidenceValuePatterns.some((pattern) => pattern.test(value))
    ) {
      throw new Error(`Forbidden audit evidence value at ${path}`)
    }
    return
  }

  for (const [key, nested] of Object.entries(value)) {
    const parts = key
      .replaceAll(/([a-z0-9])([A-Z])/g, '$1_$2')
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .map((part) => part.toLowerCase())
    if (
      forbiddenEvidenceKeys.has(normalizeKey(key)) ||
      parts.some((part) => forbiddenEvidenceKeyParts.has(part))
    ) {
      throw new Error(`Forbidden audit evidence field at ${path}.${key}`)
    }
    assertNoForbiddenEvidenceFields(nested, `${path}.${key}`)
  }
}

const selectedOptionIdsSchema = z
  .array(z.number().int().nonnegative())
  .transform((ids) => [...new Set(ids)].sort((left, right) => left - right))

const choiceAnswerSchema = z
  .object({
    kind: z.enum(['SC', 'MC', 'KPRIM']),
    selectedOptionIds: selectedOptionIdsSchema,
  })
  .strict()

const freeTextAnswerSchema = z
  .object({
    kind: z.literal('FREE_TEXT'),
    value: z.string(),
  })
  .strict()

const numericalAnswerSchema = z
  .object({
    kind: z.literal('NUMERICAL'),
    value: z.number().finite(),
    unit: z.string().optional(),
    restriction: z
      .object({
        minimum: z.number().finite().nullable(),
        maximum: z.number().finite().nullable(),
        precision: z.number().int().nonnegative().nullable(),
      })
      .strict(),
  })
  .strict()

const selectionAnswerSchema = z
  .object({
    kind: z.literal('SELECTION'),
    selectedItemIds: z
      .array(z.number().int().positive())
      .transform((ids) =>
        [...new Set(ids)].sort((left, right) => left - right)
      ),
  })
  .strict()

const caseStudyAnswerSchema = z
  .object({
    kind: z.literal('CASE_STUDY'),
    cases: z
      .array(
        z
          .object({
            caseId: z.string().min(1).max(128),
            items: z
              .array(
                z
                  .object({
                    itemId: z.number().int().positive(),
                    criteria: z
                      .array(
                        z
                          .object({
                            criterionId: z.string().min(1).max(128),
                            response: z.number().finite(),
                          })
                          .strict()
                      )
                      .transform((criteria) =>
                        [...criteria].sort((left, right) =>
                          left.criterionId.localeCompare(right.criterionId)
                        )
                      ),
                  })
                  .strict()
              )
              .transform((items) =>
                [...items].sort((left, right) => left.itemId - right.itemId)
              ),
          })
          .strict()
      )
      .transform((cases) =>
        [...cases].sort((left, right) =>
          left.caseId.localeCompare(right.caseId)
        )
      ),
  })
  .strict()

const contentAnswerSchema = z
  .object({
    kind: z.literal('CONTENT'),
    viewed: z.boolean(),
  })
  .strict()

const flashcardAnswerSchema = z
  .object({
    kind: z.literal('FLASHCARD'),
    correctness: z.enum(['INCORRECT', 'PARTIAL', 'CORRECT']),
  })
  .strict()

export const normalizedAnswerSchema = z.discriminatedUnion('kind', [
  choiceAnswerSchema,
  freeTextAnswerSchema,
  numericalAnswerSchema,
  selectionAnswerSchema,
  caseStudyAnswerSchema,
  contentAnswerSchema,
  flashcardAnswerSchema,
])

export type NormalizedAnswer = z.infer<typeof normalizedAnswerSchema>
