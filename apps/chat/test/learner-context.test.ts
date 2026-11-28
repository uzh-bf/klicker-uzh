import { TUTOR_PERSONALIZATION_DISCLOSURE_VERSION } from '@klicker-uzh/util/participant-account-data-use'
import type { ModelMessage } from 'ai'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { acknowledgedParticipantDataUse } from './participant-data-use-support'

const db = vi.hoisted(() => ({
  participantFindUnique: vi.fn(),
  responseGroupBy: vi.fn(),
  responseFindMany: vi.fn(),
  instanceCount: vi.fn(),
}))

vi.mock('@klicker-uzh/prisma', () => ({
  prisma: {
    participant: { findUnique: db.participantFindUnique },
    questionResponse: {
      groupBy: db.responseGroupBy,
      findMany: db.responseFindMany,
    },
    elementInstance: { count: db.instanceCount },
  },
}))

import { buildChatTurnRequest } from '../src/lib/server/chatTurnRequest'
import {
  evaluateLearnerContextEligibility,
  formatPracticeResults,
  loadLearnerContextForTurn,
  type PracticeResultRow,
  type PracticeResults,
  type ResultTally,
} from '../src/lib/server/learnerContext'

const NOW = new Date('2026-11-26T12:00:00.000Z')
const PARTICIPANT_ID = 'participant-synthetic'
const COURSE_ID = 'course-synthetic'

const optedIn = {
  ...acknowledgedParticipantDataUse,
  tutorPersonalizationConsent: true,
  tutorPersonalizationDisclosureVersion:
    TUTOR_PERSONALIZATION_DISCLOSURE_VERSION,
}

const turn = {
  requestId: 'request-synthetic',
  mode: 'tutor',
  chatbotPersonalizationEnabled: true,
  participantId: PARTICIPANT_ID,
  courseId: COURSE_ID,
  now: NOW,
}

function daysAgo(days: number) {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000)
}

function tally(overrides: Partial<ResultTally> = {}): ResultTally {
  return {
    answered: 0,
    correct: 0,
    partial: 0,
    wrong: 0,
    lastAnsweredAt: null,
    ...overrides,
  }
}

function row(overrides: Partial<PracticeResultRow> = {}): PracticeResultRow {
  return {
    activityId: 'activity-synthetic',
    activityName: 'Synthetic quiz',
    activityKind: 'practice-quiz',
    lastCorrectness: 'CORRECT',
    lastAnsweredAt: daysAgo(1),
    ...overrides,
  }
}

function results(overrides: Partial<PracticeResults> = {}): PracticeResults {
  return {
    totals: tally(),
    flashcards: tally(),
    recentRows: [],
    availableQuestionCount: 0,
    ...overrides,
  }
}

function group(correctness: string, count: number, last: Date | null) {
  return {
    lastResponseCorrectness: correctness,
    _count: { _all: count },
    _max: { lastAnsweredAt: last },
  }
}

/** A student with checked answers and no flashcards. */
function stubResults() {
  db.responseGroupBy
    .mockResolvedValueOnce([
      group('CORRECT', 3, daysAgo(2)),
      group('WRONG', 1, daysAgo(5)),
    ])
    .mockResolvedValueOnce([])
  db.responseFindMany.mockResolvedValue([
    {
      lastAnsweredAt: daysAgo(2),
      lastResponseCorrectness: 'CORRECT',
      practiceQuiz: { id: 'activity-synthetic', displayName: 'Synthetic quiz' },
      microLearning: null,
    },
  ])
  db.instanceCount.mockResolvedValue(10)
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('learner context eligibility', () => {
  const base = {
    mode: 'tutor',
    chatbotPersonalizationEnabled: true,
    participant: optedIn,
  }

  test('is eligible only when every condition holds', () => {
    expect(evaluateLearnerContextEligibility(base)).toEqual({ eligible: true })
  })

  test.each([
    ['another mode', { mode: 'explainer' }, 'not-tutor-mode'],
    [
      'the lecturer switch off',
      { chatbotPersonalizationEnabled: false },
      'chatbot-disabled',
    ],
    ['an unknown participant', { participant: null }, 'notice-incomplete'],
    [
      'an incomplete account notice',
      { participant: { ...optedIn, dataUseAcknowledgedAt: null } },
      'notice-incomplete',
    ],
    [
      'an unanswered choice',
      { participant: acknowledgedParticipantDataUse },
      'no-consent',
    ],
    [
      'a recorded no',
      { participant: { ...optedIn, tutorPersonalizationConsent: false } },
      'no-consent',
    ],
    [
      'a yes under a notice version that does not cover results',
      {
        participant: {
          ...optedIn,
          tutorPersonalizationDisclosureVersion: 'unknown-version',
        },
      },
      'no-consent',
    ],
  ])('is not eligible with %s', (_label, change, reason) => {
    expect(evaluateLearnerContextEligibility({ ...base, ...change })).toEqual({
      eligible: false,
      reason,
    })
  })
})

describe('learner context for a chat turn', () => {
  test('sends the usage rules and the summary for an opted-in student', async () => {
    db.participantFindUnique.mockResolvedValue(optedIn)
    stubResults()

    const text = await loadLearnerContextForTurn(turn)

    expect(text).toContain('Treat it as evidence, never as a verdict')
    expect(text).toContain('4 practice questions answered')
    expect(text).toContain('3 correct, 0 partly correct, 1 wrong')
  })

  test('reads only the own participant, the chatbot course and no answers', async () => {
    db.participantFindUnique.mockResolvedValue(optedIn)
    stubResults()

    await loadLearnerContextForTurn(turn)

    for (const [query] of [
      ...db.responseGroupBy.mock.calls,
      ...db.responseFindMany.mock.calls,
    ]) {
      expect(query.where).toMatchObject({
        participantId: PARTICIPANT_ID,
        courseId: COURSE_ID,
      })
    }
    const selected = JSON.stringify(db.responseFindMany.mock.calls[0][0].select)
    expect(selected).not.toMatch(
      /[Rr]esponse"|content|explanation|options|element|tags/
    )
  })

  test('leaves out activities the lecturer deleted', async () => {
    db.participantFindUnique.mockResolvedValue(optedIn)
    stubResults()

    await loadLearnerContextForTurn(turn)

    // A deleted activity keeps its PUBLISHED status and its responses.
    for (const [query] of [
      ...db.responseGroupBy.mock.calls,
      ...db.responseFindMany.mock.calls,
    ]) {
      expect(query.where.OR).toEqual([
        { practiceQuiz: { isDeleted: false } },
        { microLearning: { isDeleted: false } },
      ])
    }
    for (const activity of db.instanceCount.mock.calls[0][0].where.elementStack
      .OR) {
      expect(Object.values(activity)[0]).toMatchObject({ isDeleted: false })
    }
  })

  test('counts only questions with a sample solution', async () => {
    db.participantFindUnique.mockResolvedValue(optedIn)
    stubResults()

    await loadLearnerContextForTurn(turn)

    // Without a sample solution every answer is saved as correct.
    const graded = { path: ['options', 'hasSampleSolution'], equals: true }
    const [totals, flashcards] = db.responseGroupBy.mock.calls.map(
      ([query]) => query
    )
    expect(totals.where.elementInstance.elementData).toEqual(graded)
    expect(flashcards.where.elementInstance.elementData).toBeUndefined()
    expect(
      db.responseFindMany.mock.calls[0][0].where.elementInstance.elementData
    ).toEqual(graded)
    expect(db.instanceCount.mock.calls[0][0].where.elementData).toEqual(graded)
  })

  test.each([
    ['in another mode', { mode: 'explainer' }],
    ['with the lecturer switch off', { chatbotPersonalizationEnabled: false }],
  ])('sends nothing and reads no choices %s', async (_label, change) => {
    await expect(
      loadLearnerContextForTurn({ ...turn, ...change })
    ).resolves.toBe('')
    expect(db.participantFindUnique).not.toHaveBeenCalled()
    expect(db.responseFindMany).not.toHaveBeenCalled()
  })

  test('sends nothing and reads no results without a recorded yes', async () => {
    db.participantFindUnique.mockResolvedValue(acknowledgedParticipantDataUse)

    await expect(loadLearnerContextForTurn(turn)).resolves.toBe('')
    expect(db.responseGroupBy).not.toHaveBeenCalled()
    expect(db.responseFindMany).not.toHaveBeenCalled()
  })

  test('sends nothing for an opted-in student without results', async () => {
    db.participantFindUnique.mockResolvedValue(optedIn)
    db.responseGroupBy.mockResolvedValue([])
    db.responseFindMany.mockResolvedValue([])
    db.instanceCount.mockResolvedValue(10)

    await expect(loadLearnerContextForTurn(turn)).resolves.toBe('')
  })

  test.each([
    [
      'the choice cannot be read',
      () => db.participantFindUnique.mockRejectedValue(new Error('database')),
    ],
    [
      'the results cannot be read',
      () => {
        db.participantFindUnique.mockResolvedValue(optedIn)
        db.responseGroupBy.mockRejectedValue(new Error('database'))
        db.responseFindMany.mockResolvedValue([])
        db.instanceCount.mockResolvedValue(0)
      },
    ],
  ])('sends nothing when %s', async (_label, arrange) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    arrange()

    await expect(loadLearnerContextForTurn(turn)).resolves.toBe('')
    expect(warn).toHaveBeenCalledOnce()
  })

  test('leaves the model request unchanged when nothing is sent', async () => {
    const history: ModelMessage[] = [{ role: 'user', content: 'Synthetic.' }]
    const sections = ['Synthetic chat context.']
    const learnerContext = await loadLearnerContextForTurn({
      ...turn,
      chatbotPersonalizationEnabled: false,
    })

    expect(
      buildChatTurnRequest({
        stableSections: ['Synthetic system prompt.'],
        turnContextSections: [...sections, learnerContext],
        history,
      })
    ).toEqual(
      buildChatTurnRequest({
        stableSections: ['Synthetic system prompt.'],
        turnContextSections: sections,
        history,
      })
    )
  })
})

describe('practice results summary', () => {
  test('takes the overall counts from the totals, not from the recent rows', () => {
    const text = formatPracticeResults(
      results({
        totals: tally({
          answered: 900,
          correct: 600,
          partial: 100,
          wrong: 200,
          lastAnsweredAt: daysAgo(0),
        }),
        recentRows: [row()],
        availableQuestionCount: 1200,
      }),
      NOW
    )

    expect(text).toContain('900 practice questions answered')
    expect(text).toContain('currently offers 1200 practice questions')
    expect(text).toContain('600 correct, 100 partly correct, 200 wrong')
    expect(text).toContain('from the 1 most recently answered questions')
  })

  test('never states the answers as a share of the open questions', () => {
    // Answers to ended activities can outnumber what is open now.
    const text = formatPracticeResults(
      results({
        totals: tally({
          answered: 40,
          correct: 40,
          lastAnsweredAt: daysAgo(3),
        }),
        availableQuestionCount: 12,
      }),
      NOW
    )

    expect(text).not.toMatch(/40 of \d+/)
  })

  test('describes age in words and keeps flashcards apart as self-rated', () => {
    const text = formatPracticeResults(
      results({
        totals: tally({ answered: 1, correct: 1, lastAnsweredAt: daysAgo(21) }),
        flashcards: tally({
          answered: 5,
          correct: 2,
          partial: 1,
          wrong: 2,
          lastAnsweredAt: daysAgo(1),
        }),
        recentRows: [row({ lastAnsweredAt: daysAgo(21) })],
      }),
      NOW
    )

    expect(text).toContain('last practised 3 weeks ago')
    expect(text).toContain(
      'Flashcards, rated by the student themselves: 5 reviewed; latest ratings: 2 known, 1 partly known, 2 not known; last reviewed yesterday.'
    )
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  test('keeps activities with the same name apart', () => {
    const text = formatPracticeResults(
      results({
        totals: tally({
          answered: 3,
          correct: 2,
          wrong: 1,
          lastAnsweredAt: NOW,
        }),
        recentRows: [
          row({ activityId: 'activity-a', lastCorrectness: 'CORRECT' }),
          row({ activityId: 'activity-a', lastCorrectness: 'CORRECT' }),
          row({ activityId: 'activity-b', lastCorrectness: 'WRONG' }),
        ],
      }),
      NOW
    )
    const lines = text
      .split('\n')
      .filter((line) => line.includes('"Synthetic quiz" (practice quiz)'))

    expect(lines).toHaveLength(2)
    expect(text).not.toContain('activity-a')
  })

  test('bounds the number of activities and the length of names', () => {
    const recentRows = Array.from({ length: 30 }, (_, index) =>
      row({
        activityId: `activity-${index}`,
        activityName: `Synthetic quiz ${index}\nsecond line ${'x'.repeat(200)}`,
        lastAnsweredAt: daysAgo(index),
      })
    )
    const text = formatPracticeResults(
      results({
        totals: tally({ answered: 30, correct: 30, lastAnsweredAt: NOW }),
        recentRows,
      }),
      NOW
    )
    const lines = text.split('\n')

    expect(
      lines.filter((line) => line.includes('(practice quiz)'))
    ).toHaveLength(6)
    expect(Math.max(...lines.map((line) => line.length))).toBeLessThan(260)
    expect(text).toContain('Synthetic quiz 0 second line')
    expect(text.length).toBeLessThan(4000)
  })
})
