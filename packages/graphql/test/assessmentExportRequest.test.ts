import { describe, expect, it } from 'vitest'
import { assessmentExportRequestSchema } from '../src/lib/assessmentExportRequest.js'
import { assessmentTranscriptExportRequestSchema } from '../src/lib/assessmentTranscriptExportRequest.js'

const courseRequest = {
  requestId: '10000000-0000-4000-8000-000000000001',
  courseId: '10000000-0000-4000-8000-000000000002',
  scope: 'COURSE',
  locale: 'de',
  disclosureVersion: 'v1',
  acknowledgement: true,
}
const liveQuizId = '10000000-0000-4000-8000-000000000003'

describe('assessment export request', () => {
  it('accepts explicit course and live-quiz scopes with current attestation', () => {
    expect(assessmentExportRequestSchema.parse(courseRequest)).toEqual(
      courseRequest
    )
    const quizRequest = {
      ...courseRequest,
      scope: 'LIVE_QUIZ',
      liveQuizId,
      locale: 'en',
    }
    expect(assessmentExportRequestSchema.parse(quizRequest)).toEqual(
      quizRequest
    )
  })

  it('rejects absent or stale acknowledgement and ambiguous scopes', () => {
    for (const input of [
      { ...courseRequest, acknowledgement: false },
      { ...courseRequest, acknowledgement: undefined },
      { ...courseRequest, disclosureVersion: 'outdated' },
      { ...courseRequest, scope: 'LIVE_QUIZ' },
      { ...courseRequest, liveQuizId },
      { ...courseRequest, participantId: 'unrequested-filter' },
      { ...courseRequest, courseId: 'invalid' },
      { ...courseRequest, locale: 'unsupported' },
    ]) {
      expect(assessmentExportRequestSchema.safeParse(input).success).toBe(false)
    }
  })

  it('never lets a chatbot transcript request reach the CSV exports', () => {
    const chatbotId = '10000000-0000-4000-8000-000000000004'
    for (const input of [
      { ...courseRequest, scope: 'CHATBOT', chatbotId },
      { ...courseRequest, chatbotId },
    ]) {
      expect(assessmentExportRequestSchema.safeParse(input).success).toBe(false)
    }

    const { scope: _scope, ...transcriptRequest } = {
      ...courseRequest,
      chatbotId,
    }
    expect(
      assessmentTranscriptExportRequestSchema.safeParse(transcriptRequest)
        .success
    ).toBe(true)
    // and a CSV body is no transcript request
    expect(
      assessmentTranscriptExportRequestSchema.safeParse(courseRequest).success
    ).toBe(false)
  })
})
