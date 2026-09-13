import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'
import {
  buildResearchExportArtifact,
  type ResearchExportAsynchronousResponse,
  type ResearchExportLearningAnalyticsContribution,
  type ResearchExportLiveQuizResponse,
} from '../src/lib/researchExportArtifact.js'
import {
  MAX_RESEARCH_EXPORT_BYTES,
  MAX_RESEARCH_EXPORT_RECORDS,
  type ResearchExportClass,
} from '../src/lib/researchExportRequest.js'

const createdAt = new Date('2026-09-07T12:00:00.000Z')
const submittedAt = new Date('2026-09-07T12:01:00.000Z')

const liveQuizResponse: ResearchExportLiveQuizResponse = {
  participantId: 'participant-internal-1',
  activityId: 'activity-internal-42',
  elementInstanceId: 'instance-internal-4201',
  response: { answer: 'approved response' },
  correctness: 'CORRECT',
  points: 5,
  submittedAt,
}

const asynchronousResponse: ResearchExportAsynchronousResponse = {
  participantId: 'participant-internal-1',
  activityId: 'activity-internal-42',
  elementInstanceId: 'instance-internal-4201',
  response: { answer: 'another approved response' },
  score: 0.8,
  pointsAwarded: null,
  timeSpent: 12,
  submittedAt,
}

const learningAnalyticsContribution: ResearchExportLearningAnalyticsContribution =
  {
    participantId: 'participant-internal-1',
    family: 'PARTICIPANT_ANALYTICS',
    scopeKey: 'PARTICIPANT_ANALYTICS|course-1|COURSE',
    scope: { courseId: 'course-1', type: 'COURSE' },
    contributions: { trialsCount: 4, responseCount: 3 },
    generation: 3,
    disclosureVersion: '2026-09-08',
    choiceAt: createdAt,
    algorithmVersion: '1',
    computedAt: createdAt,
    publishedAt: submittedAt,
  }

function build(
  selectedClasses: ResearchExportClass[] = [
    'LIVE_QUIZ_RESPONSES',
    'ASYNCHRONOUS_RESPONSES',
  ]
) {
  return buildResearchExportArtifact({
    exportId: 'export-1',
    courseId: 'course-1',
    createdAt,
    selectedClasses,
    liveQuizResponses: [liveQuizResponse],
    asynchronousResponses: [asynchronousResponse],
  })
}

function expectExportError(action: () => unknown, code: string) {
  let error: unknown
  try {
    action()
  } catch (caught) {
    error = caught
  }

  expect(error).toMatchObject({ extensions: { code } })
}

describe('research export artifact builder', () => {
  it('links selected classes with export-local keys and excludes internal identifiers', () => {
    const artifact = build()
    const document = JSON.parse(artifact.body) as {
      manifest: Record<string, unknown>
      LIVE_QUIZ_RESPONSES: Array<Record<string, unknown>>
      ASYNCHRONOUS_RESPONSES: Array<Record<string, unknown>>
    }

    expect(document.manifest).toEqual({
      version: 'v1',
      exportId: 'export-1',
      courseId: 'course-1',
      createdAt: createdAt.toISOString(),
      selectedClasses: ['LIVE_QUIZ_RESPONSES', 'ASYNCHRONOUS_RESPONSES'],
    })
    expect(document.LIVE_QUIZ_RESPONSES[0]?.participantKey).toBe(
      document.ASYNCHRONOUS_RESPONSES[0]?.participantKey
    )
    expect(document.LIVE_QUIZ_RESPONSES[0]?.activityKey).toBe(
      document.ASYNCHRONOUS_RESPONSES[0]?.activityKey
    )
    expect(document.LIVE_QUIZ_RESPONSES[0]?.elementInstanceKey).toBe(
      document.ASYNCHRONOUS_RESPONSES[0]?.elementInstanceKey
    )
    expect(document.LIVE_QUIZ_RESPONSES[0]).not.toHaveProperty('participantId')
    expect(document.LIVE_QUIZ_RESPONSES[0]).not.toHaveProperty('activityId')
    expect(document.LIVE_QUIZ_RESPONSES[0]).not.toHaveProperty(
      'elementInstanceId'
    )
    expect(artifact.body).not.toContain('participant-internal-1')
    expect(artifact.body).not.toContain('activity-internal-42')
    expect(artifact.body).not.toContain('instance-internal-4201')
    expect(artifact.recordCount).toBe(2)
    expect(artifact.byteCount).toBe(Buffer.byteLength(artifact.body, 'utf8'))
    expect(artifact.sha256).toBe(
      createHash('sha256').update(artifact.body, 'utf8').digest('hex')
    )
  })

  it('uses different export-local keys for different builds', () => {
    const first = JSON.parse(build().body) as {
      LIVE_QUIZ_RESPONSES: Array<{
        participantKey: string
        activityKey: string
      }>
    }
    const second = JSON.parse(
      buildResearchExportArtifact({
        exportId: 'export-2',
        courseId: 'course-1',
        createdAt,
        selectedClasses: ['LIVE_QUIZ_RESPONSES'],
        liveQuizResponses: [liveQuizResponse],
        asynchronousResponses: [],
      }).body
    ) as {
      LIVE_QUIZ_RESPONSES: Array<{
        participantKey: string
        activityKey: string
      }>
    }

    expect(second.LIVE_QUIZ_RESPONSES[0]?.participantKey).not.toBe(
      first.LIVE_QUIZ_RESPONSES[0]?.participantKey
    )
    expect(second.LIVE_QUIZ_RESPONSES[0]?.activityKey).not.toBe(
      first.LIVE_QUIZ_RESPONSES[0]?.activityKey
    )
  })

  it('emits only selected supported class arrays', () => {
    const document = JSON.parse(
      buildResearchExportArtifact({
        exportId: 'export-1',
        courseId: 'course-1',
        createdAt,
        selectedClasses: ['LIVE_QUIZ_RESPONSES'],
        liveQuizResponses: [liveQuizResponse],
        asynchronousResponses: [],
      }).body
    ) as Record<string, unknown>

    expect(document.LIVE_QUIZ_RESPONSES).toHaveLength(1)
    expect(document).not.toHaveProperty('ASYNCHRONOUS_RESPONSES')
  })

  it('rejects selected classes that are not implemented by the builder', () => {
    expectExportError(
      () =>
        buildResearchExportArtifact({
          exportId: 'export-1',
          courseId: 'course-1',
          createdAt,
          selectedClasses: ['CHAT_TRANSCRIPTS'] as ResearchExportClass[],
          liveQuizResponses: [],
          asynchronousResponses: [],
        }),
      'DATA_EXPORT_CLASS_UNAVAILABLE'
    )
  })

  it('releases learning analytics contributions with provenance and denominator', () => {
    const artifact = buildResearchExportArtifact({
      exportId: 'export-1',
      courseId: 'course-1',
      createdAt,
      selectedClasses: ['LEARNING_ANALYTICS'],
      liveQuizResponses: [],
      asynchronousResponses: [],
      learningAnalytics: [learningAnalyticsContribution],
      courseParticipantCount: 12,
    })
    const document = JSON.parse(artifact.body) as {
      LEARNING_ANALYTICS: {
        denominator: number
        contributions: Array<{
          participantKey: string
          family: string
          provenance: Record<string, unknown>
        }>
      }
    }

    expect(document.LEARNING_ANALYTICS.denominator).toBe(12)
    expect(document.LEARNING_ANALYTICS.contributions).toHaveLength(1)
    expect(document.LEARNING_ANALYTICS.contributions[0]?.family).toBe(
      'PARTICIPANT_ANALYTICS'
    )
    expect(document.LEARNING_ANALYTICS.contributions[0]?.provenance).toEqual({
      generation: 3,
      disclosureVersion: '2026-09-08',
      choiceAt: createdAt.toISOString(),
      algorithmVersion: '1',
      computedAt: createdAt.toISOString(),
      publishedAt: submittedAt.toISOString(),
    })
    expect(artifact.recordCount).toBe(1)
    expect(artifact.body).not.toContain('participant-internal-1')
  })

  it('rejects artifacts over the record limit', () => {
    const responses = Array.from(
      { length: MAX_RESEARCH_EXPORT_RECORDS + 1 },
      (_, index) => ({
        ...liveQuizResponse,
        participantId: `participant-${index}`,
      })
    )

    expectExportError(
      () =>
        buildResearchExportArtifact({
          exportId: 'export-1',
          courseId: 'course-1',
          createdAt,
          selectedClasses: ['LIVE_QUIZ_RESPONSES'],
          liveQuizResponses: responses,
          asynchronousResponses: [],
        }),
      'DATA_EXPORT_TOO_LARGE'
    )
  })

  it('rejects artifacts over the UTF-8 byte limit', () => {
    const oversizedResponse: ResearchExportLiveQuizResponse = {
      ...liveQuizResponse,
      response: 'x'.repeat(MAX_RESEARCH_EXPORT_BYTES),
    }

    expectExportError(
      () =>
        buildResearchExportArtifact({
          exportId: 'export-1',
          courseId: 'course-1',
          createdAt,
          selectedClasses: ['LIVE_QUIZ_RESPONSES'],
          liveQuizResponses: [oversizedResponse],
          asynchronousResponses: [],
        }),
      'DATA_EXPORT_TOO_LARGE'
    )
  })

  it('rejects rows for classes that were not selected', () => {
    expectExportError(
      () =>
        buildResearchExportArtifact({
          exportId: 'export-1',
          courseId: 'course-1',
          createdAt,
          selectedClasses: ['LIVE_QUIZ_RESPONSES'],
          liveQuizResponses: [liveQuizResponse],
          asynchronousResponses: [asynchronousResponse],
        }),
      'DATA_EXPORT_CLASS_UNAVAILABLE'
    )
  })
})
