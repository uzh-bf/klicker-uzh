import { z } from 'zod'

import {
  ANALYTICS_ENGINE_CONTRACT_VERSION,
  COURSE_WORKFLOW_MODES,
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

const contractVersionSchema = z.literal(ANALYTICS_ENGINE_CONTRACT_VERSION)
const uuidSchema = z.string().uuid()
const modeSchema = z.enum(COURSE_WORKFLOW_MODES)

export const courseWorkflowInputSchema = z
  .object({
    contractVersion: contractVersionSchema,
    runId: uuidSchema,
    courseId: uuidSchema,
    mode: modeSchema,
    windowSince: calendarDateSchema.optional(),
  })
  .strict()

export const courseWorkflowSuccessSchema = courseWorkflowInputSchema
  .extend({
    completedAt: rfc3339DateTimeSchema,
  })
  .strict()

export const platformWorkflowInputSchema = z
  .object({
    contractVersion: contractVersionSchema,
    runId: uuidSchema,
  })
  .strict()

export const platformWorkflowSuccessSchema = platformWorkflowInputSchema
  .extend({
    completedAt: rfc3339DateTimeSchema,
  })
  .strict()

export type CourseWorkflowInput = z.infer<typeof courseWorkflowInputSchema>
export type CourseWorkflowSuccess = z.infer<typeof courseWorkflowSuccessSchema>
export type PlatformWorkflowInput = z.infer<typeof platformWorkflowInputSchema>
export type PlatformWorkflowSuccess = z.infer<
  typeof platformWorkflowSuccessSchema
>
