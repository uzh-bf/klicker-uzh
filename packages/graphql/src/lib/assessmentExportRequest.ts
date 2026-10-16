import { ASSESSMENT_EXPORT_DISCLOSURE_VERSION } from '@klicker-uzh/types'
import { z } from 'zod'

export { ASSESSMENT_EXPORT_DISCLOSURE_VERSION }

const assessmentExportFields = {
  requestId: z.string().uuid(),
  courseId: z.string().uuid(),
  locale: z.enum(['de', 'en']),
  disclosureVersion: z.literal(ASSESSMENT_EXPORT_DISCLOSURE_VERSION),
  acknowledgement: z.literal(true),
}

export const assessmentExportRequestSchema = z.discriminatedUnion('scope', [
  z.object({ ...assessmentExportFields, scope: z.literal('COURSE') }).strict(),
  z
    .object({
      ...assessmentExportFields,
      scope: z.literal('LIVE_QUIZ'),
      liveQuizId: z.string().uuid(),
    })
    .strict(),
])

export type AssessmentExportRequest = z.infer<
  typeof assessmentExportRequestSchema
>
