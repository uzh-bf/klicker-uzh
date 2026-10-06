import { describe, expect, test } from 'vitest'
import {
  type AdaptiveAttemptDetailData,
  type AdaptiveAttemptSummaryData,
  buildAttemptAnswersCsv,
  buildAttemptSummaryCsv,
  csvCell,
} from '../src/components/evaluation/adaptive/attemptDiagnostics/adaptiveAttemptCsv'

const node = (overrides: Record<string, unknown>) => ({
  __typename: 'AdaptiveAttemptNodeResult' as const,
  nodeId: null,
  parentId: null,
  name: 'Overall',
  kind: 'OVERALL',
  depth: 0,
  theta: 0.1234,
  standardError: 0.5,
  levelLabel: 'L3',
  lowerLevelLabel: 'L2',
  upperLevelLabel: 'L4',
  responseCount: 6,
  determined: false,
  coverageStatus: null,
  weightShare: null,
  ...overrides,
})

const summary = {
  __typename: 'AdaptiveAttemptDiagnosticSummary',
  attemptCode: 'a1b2c3d4',
  participantCode: 'p9e8d7c6',
  attemptNumber: 1,
  startedAt: '2026-10-06T10:00:00.000Z',
  completedAt: '2026-10-06T10:10:00.000Z',
  elapsedSeconds: 600,
  stopReason: 'TOTAL_QUESTION_CAP',
  answerCount: 6,
  overall: node({}),
  competences: [
    node({
      nodeId: 1,
      name: 'Synthetic, "quoted" competence',
      kind: 'COMPETENCE',
      weightShare: 0.5,
    }),
  ],
  rating: 'CHECK',
  ratingReasons: [
    {
      __typename: 'AdaptiveAttemptRatingReason',
      code: 'PERSON_FIT',
      severity: 'CHECK',
      nodeName: 'Synthetic, "quoted" competence',
      value: -1.8,
    },
  ],
} as unknown as AdaptiveAttemptSummaryData

describe('adaptive attempt CSV', () => {
  test('quotes separators, quotes and newlines', () => {
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"')
    expect(csvCell(null)).toBe('')
  })

  test('writes one summary row per attempt with competence columns', () => {
    const csv = buildAttemptSummaryCsv([summary])
    expect(csv.startsWith('﻿')).toBe(true)
    const [header, row] = csv.slice(1).trim().split('\r\n')
    expect(header).toContain('"Synthetic, ""quoted"" competence level"')
    expect(row).toContain('a1b2c3d4,p9e8d7c6,1,')
    expect(row).toContain('PERSON_FIT:')
    expect(row).toContain(',0.123,')
    expect(row).toContain(',0.5')
  })

  test('writes answer rows with replay columns when present', () => {
    const detail = {
      summary,
      answers: [
        {
          order: 1,
          competenceName: 'C',
          subcompetenceName: 'S',
          nodeNamePath: ['C', 'S'],
          elementTitle: 'item-1',
          itemLevelLabel: 'L3',
          difficulty: -0.5,
          discrimination: 1.2,
          guessing: 0,
          correct: true,
          score: 1,
          overallThetaAfter: null,
          levelDistance: 0,
        },
      ],
      replay: {
        exact: true,
        answers: [
          {
            order: 1,
            phase: 'COVERAGE',
            competenceThetaBefore: null,
            competenceLevelBefore: null,
            competenceThetaAfter: 0.2,
            competenceStandardErrorAfter: 0.9,
            competenceLevelAfter: 'L3',
            competenceLowerLevelAfter: 'L1',
            competenceUpperLevelAfter: 'L5',
            levelDistanceBefore: null,
            replayMatches: true,
          },
        ],
      },
    } as unknown as AdaptiveAttemptDetailData
    const [, row] = buildAttemptAnswersCsv(detail).slice(1).trim().split('\r\n')
    expect(row).toBe(
      'a1b2c3d4,1,C,S,C > S,item-1,L3,-0.5,1.2,0,true,1,,0,COVERAGE,,,,L3,0.2,0.9,L1,L5,true'
    )
  })
})
