import { describe, expect, it } from 'vitest'
import {
  CORRELATED_LIVE_QUIZ_EXPORT_WARNING,
  CorrelatedLiveQuizExportSizeError,
  createCorrelatedLiveQuizResponseCsv,
  DEFAULT_CORRELATED_LIVE_QUIZ_EXPORT_MAX_BYTES,
} from '../src/correlatedLiveQuizResponses.js'

const questions = [
  {
    blockOrder: 0,
    questionOrder: 0,
    instanceId: 10,
    executions: [0, 1],
  },
  {
    blockOrder: 0,
    questionOrder: 1,
    instanceId: 11,
    executions: [0, 1],
  },
]

const responses = [
  {
    respondentLabel: 2,
    instanceId: 10,
    blockExecution: 0,
    response: { value: '=formula-leading value\nsecond line' },
    correctness: 'PARTIAL',
    basePoints: 10,
    correctnessPoints: 3.5,
    bonusPoints: 1.5,
  },
  {
    respondentLabel: 1,
    instanceId: 11,
    blockExecution: 1,
    response: {
      choices: [
        { selected: false, ix: 1 },
        { ix: 0, selected: true },
      ],
    },
    correctness: 'CORRECT',
    basePoints: 10,
    correctnessPoints: 5,
    bonusPoints: 2,
  },
]

describe('createCorrelatedLiveQuizResponseCsv', () => {
  it('creates one stable pseudonymous row per assigned respondent label', () => {
    const first = createCorrelatedLiveQuizResponseCsv({
      quizName: 'Research Quiz',
      questions,
      responses,
    })
    const second = createCorrelatedLiveQuizResponseCsv({
      quizName: 'Research Quiz',
      questions,
      responses: [...responses].reverse(),
    })

    expect(first.csv).toBe(second.csv)
    expect(first.filename).toBe('live-quiz-research-quiz-responses.csv')
    expect(first.warning).toBe(CORRELATED_LIVE_QUIZ_EXPORT_WARNING)
    expect(first.csv.match(/^respondent_\d{3},/gm)).toHaveLength(2)
  })

  it('orders clean response, correctness, and points headers by quiz structure', () => {
    const result = createCorrelatedLiveQuizResponseCsv({
      quizName: 'Quiz',
      questions,
      responses,
    })

    expect(result.csv.split('\r\n')[0]).toBe(
      '\uFEFFrespondent,' +
        [
          'block_01_question_01_execution_01_response',
          'block_01_question_01_execution_01_correct',
          'block_01_question_01_execution_01_points',
          'block_01_question_01_execution_02_response',
          'block_01_question_01_execution_02_correct',
          'block_01_question_01_execution_02_points',
          'block_01_question_02_execution_01_response',
          'block_01_question_02_execution_01_correct',
          'block_01_question_02_execution_01_points',
          'block_01_question_02_execution_02_response',
          'block_01_question_02_execution_02_correct',
          'block_01_question_02_execution_02_points',
        ].join(',')
    )
  })

  it('protects formula-leading values and escapes RFC 4180 CSV', () => {
    const result = createCorrelatedLiveQuizResponseCsv({
      quizName: 'Quiz',
      questions,
      responses,
    })

    expect(result.csv).toContain(
      '"\'=formula-leading value\nsecond line",PARTIAL,15'
    )
    expect(result.csv).toContain('\r\n')
  })

  it('uses canonical compact JSON for structured responses', () => {
    const result = createCorrelatedLiveQuizResponseCsv({
      quizName: 'Quiz',
      questions,
      responses,
    })

    expect(result.csv).toContain(
      '"[{""ix"":1,""selected"":false},{""ix"":0,""selected"":true}]"'
    )
  })

  it('does not serialize unexpected choice fields', () => {
    const result = createCorrelatedLiveQuizResponseCsv({
      quizName: 'Quiz',
      questions,
      responses: [
        {
          ...responses[1]!,
          response: {
            choices: [{ ix: 0, selected: true, note: 'private-marker' }],
          },
        },
      ],
    })

    expect(result.csv).toContain('"[{""ix"":0,""selected"":true}]"')
    expect(result.csv).not.toContain('private-marker')
  })

  it('does not let sibling response fields override structured choices', () => {
    const result = createCorrelatedLiveQuizResponseCsv({
      quizName: 'Quiz',
      questions,
      responses: [
        {
          ...responses[1]!,
          response: {
            choices: [{ ix: 0, selected: true }],
            value: 'private-marker',
          },
        },
      ],
    })

    expect(result.csv).toContain('"[{""ix"":0,""selected"":true}]"')
    expect(result.csv).not.toContain('private-marker')
  })

  it('does not expose source identifiers, hashes, types, or timestamps', () => {
    const result = createCorrelatedLiveQuizResponseCsv({
      quizName: 'Quiz',
      questions,
      responses,
    })

    expect(result.csv).not.toContain('account-id')
    expect(result.csv).not.toContain('anonymous-id')
    expect(result.csv).not.toContain('participant:')
    expect(result.csv).not.toContain('respondent:anonymous')
    expect(result.csv).not.toContain('submittedAt')
    expect(result.csv).not.toContain('identityKey')
  })

  it('leaves unanswered cells empty', () => {
    const result = createCorrelatedLiveQuizResponseCsv({
      quizName: 'Quiz',
      questions,
      responses: [responses[0]!],
    })
    const dataRow = result.csv.split('\r\n')[1]!

    expect(dataRow.endsWith(',,,,,,,,,')).toBe(true)
  })

  it('fails rather than truncating an oversized export', () => {
    expect(() =>
      createCorrelatedLiveQuizResponseCsv({
        quizName: 'Quiz',
        questions: [questions[0]!],
        responses: [
          {
            ...responses[0]!,
            response: {
              value: 'x'.repeat(DEFAULT_CORRELATED_LIVE_QUIZ_EXPORT_MAX_BYTES),
            },
          },
        ],
      })
    ).toThrow(CorrelatedLiveQuizExportSizeError)
  })
})
