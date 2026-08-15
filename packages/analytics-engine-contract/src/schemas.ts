import { z } from 'zod'

import {
  ANALYTICS_ENGINE_CONTRACT_VERSION,
  COURSE_WORKFLOW_MODES,
  COURSE_WORKFLOW_NAME,
  PLATFORM_WORKFLOW_NAME,
} from './constants.js'

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const RFC3339_DATETIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/

function isValidCalendarDate(value: string): boolean {
  if (!CALENDAR_DATE_PATTERN.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return (
    !Number.isNaN(parsed.valueOf()) && parsed.toISOString().startsWith(value)
  )
}

export const calendarDateSchema = z
  .string()
  .refine(isValidCalendarDate, 'Expected a valid YYYY-MM-DD calendar date')

export const rfc3339DateTimeSchema = z
  .string()
  .regex(RFC3339_DATETIME_PATTERN)
  .datetime({ offset: true })

function contractField<T extends z.ZodTypeAny>(
  schema: T,
  ...description: readonly unknown[]
): T {
  return schema.describe(JSON.stringify(description))
}

function describeFields(
  fields: z.ZodRawShape
): readonly (readonly unknown[])[] {
  return Object.entries(fields).map(([name, schema]) => {
    const description = JSON.parse(schema.description ?? 'null') as unknown
    if (!Array.isArray(description)) {
      throw new Error(`Contract field ${name} has no canonical description`)
    }
    return [name, ...description] as const
  })
}

const versionFieldSchema = contractField(
  z.literal(ANALYTICS_ENGINE_CONTRACT_VERSION),
  'required',
  'literal',
  ANALYTICS_ENGINE_CONTRACT_VERSION
)
const runIdFieldSchema = contractField(z.string().uuid(), 'required', 'uuid')
const completedAtFieldSchema = contractField(
  rfc3339DateTimeSchema,
  'required',
  'datetime',
  'RFC3339-with-offset'
)
const courseInputFields = {
  contractVersion: versionFieldSchema,
  runId: runIdFieldSchema,
  courseId: contractField(z.string().uuid(), 'required', 'uuid'),
  mode: contractField(
    z.enum(COURSE_WORKFLOW_MODES),
    'required',
    'enum',
    COURSE_WORKFLOW_MODES
  ),
  windowSince: contractField(
    calendarDateSchema.optional(),
    'optional',
    'calendar-date',
    'YYYY-MM-DD'
  ),
} as const
const courseSuccessFields = {
  ...courseInputFields,
  completedAt: completedAtFieldSchema,
} as const
const platformInputFields = {
  contractVersion: versionFieldSchema,
  runId: runIdFieldSchema,
} as const
const platformSuccessFields = {
  ...platformInputFields,
  completedAt: completedAtFieldSchema,
} as const

function rejectExplicitUndefinedWindow(
  value: { windowSince?: string },
  context: z.RefinementCtx
): void {
  if (
    Object.prototype.hasOwnProperty.call(value, 'windowSince') &&
    value.windowSince === undefined
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['windowSince'],
      message: 'windowSince must be omitted or contain a calendar date',
    })
  }
}

export const courseWorkflowInputSchema = z
  .object(courseInputFields)
  .strict()
  .superRefine(rejectExplicitUndefinedWindow)

export const courseWorkflowSuccessSchema = z
  .object(courseSuccessFields)
  .strict()
  .superRefine(rejectExplicitUndefinedWindow)

export const platformWorkflowInputSchema = z
  .object(platformInputFields)
  .strict()

export const platformWorkflowSuccessSchema = z
  .object(platformSuccessFields)
  .strict()

export const canonicalContract = [
  ['generation', ANALYTICS_ENGINE_CONTRACT_VERSION],
  [
    'workflow',
    COURSE_WORKFLOW_NAME,
    'strict',
    [
      ['input', describeFields(courseInputFields)],
      ['success', describeFields(courseSuccessFields)],
    ],
  ],
  [
    'workflow',
    PLATFORM_WORKFLOW_NAME,
    'strict',
    [
      ['input', describeFields(platformInputFields)],
      ['success', describeFields(platformSuccessFields)],
    ],
  ],
] as const

export type CourseWorkflowInput = z.infer<typeof courseWorkflowInputSchema>
export type CourseWorkflowSuccess = z.infer<typeof courseWorkflowSuccessSchema>
export type PlatformWorkflowInput = z.infer<typeof platformWorkflowInputSchema>
export type PlatformWorkflowSuccess = z.infer<
  typeof platformWorkflowSuccessSchema
>
