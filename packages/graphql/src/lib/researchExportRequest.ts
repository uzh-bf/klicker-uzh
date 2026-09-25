import { z } from 'zod'

export const RESEARCH_EXPORT_DISCLOSURE_VERSION = 'v1'
export const MAX_RESEARCH_EXPORT_RECORDS = 50_000
export const MAX_RESEARCH_EXPORT_BYTES = 25 * 1024 * 1024

export const RESEARCH_EXPORT_CLASSES = [
  'LIVE_QUIZ_RESPONSES',
  'ASYNCHRONOUS_RESPONSES',
  'LEARNING_ANALYTICS',
  'CHAT_TRANSCRIPTS',
] as const

export type ResearchExportClass = (typeof RESEARCH_EXPORT_CLASSES)[number]

const datePattern = /^\d{4}-\d{2}-\d{2}$/

function parseDateOnly(value: string) {
  if (!datePattern.test(value)) return null

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(`${value}T00:00:00.000Z`)

  return !Number.isNaN(date.getTime()) &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
    ? date.getTime()
    : null
}

const nonEmptyText = (max: number) => z.string().trim().min(1).max(max)
const optionalReference = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  nonEmptyText(500).optional()
)

const selectedClassesSchema = z
  .array(z.enum(RESEARCH_EXPORT_CLASSES))
  .min(1)
  .max(RESEARCH_EXPORT_CLASSES.length)
  .superRefine((selectedClasses, ctx) => {
    if (new Set(selectedClasses).size !== selectedClasses.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Selected export classes must be unique',
      })
    }
  })

export const researchExportRequestSchema = z
  .object({
    requestId: z.string().uuid(),
    courseId: z.string().trim().uuid(),
    projectTitle: nonEmptyText(200),
    responsiblePerson: nonEmptyText(200),
    contactEmail: z.string().trim().email().max(254),
    purpose: nonEmptyText(5_000),
    deletionDate: z
      .string()
      .refine(
        (value) => parseDateOnly(value) !== null,
        'Invalid deletion date'
      ),
    reference: optionalReference,
    selectedClasses: selectedClassesSchema,
    acknowledgement: z.literal(true),
    disclosureVersion: z.literal(RESEARCH_EXPORT_DISCLOSURE_VERSION),
  })
  .strict()

export type ResearchExportRequest = z.infer<typeof researchExportRequestSchema>

export function validateResearchExportRequest(
  input: unknown,
  now = new Date()
) {
  const currentDate = Number.isNaN(now.getTime())
    ? null
    : now.toISOString().slice(0, 10)

  return researchExportRequestSchema
    .superRefine((request, ctx) => {
      if (currentDate === null || request.deletionDate < currentDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Deletion date must not precede the current date',
          path: ['deletionDate'],
        })
      }
    })
    .safeParse(input)
}
