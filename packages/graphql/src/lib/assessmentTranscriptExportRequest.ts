import { ASSESSMENT_EXPORT_DISCLOSURE_VERSION } from '@klicker-uzh/types'
import { z } from 'zod'

// Request body of the asynchronous chat transcript export. Kept apart from
// the CSV export schema so a transcript request can never reach that path.
export const assessmentTranscriptExportRequestSchema = z
  .object({
    requestId: z.string().uuid(),
    courseId: z.string().uuid(),
    chatbotId: z.string().uuid(),
    locale: z.enum(['de', 'en']),
    disclosureVersion: z.literal(ASSESSMENT_EXPORT_DISCLOSURE_VERSION),
    acknowledgement: z.literal(true),
  })
  .strict()

export type AssessmentTranscriptExportRequest = z.infer<
  typeof assessmentTranscriptExportRequestSchema
>
