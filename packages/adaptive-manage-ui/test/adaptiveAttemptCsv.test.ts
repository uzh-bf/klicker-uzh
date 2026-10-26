import { describe, expect, test } from 'vitest'
import {
  type AdaptiveAttemptSummaryData,
  buildAttemptAnswersCsv,
  csvCell,
} from '../src/components/evaluation/adaptive/attemptDiagnostics/adaptiveAttemptCsv'

const node = (overrides: Record<string, unknown>) => ({
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
  responseCount: 2,
  determined: false,
  coverageStatus: null,
  weightShare: null,
  ...overrides,
})

const answer = (order: number, overrides: Record<string, unknown>) => ({
  order,
  competenceName: 'Synthetic, "quoted" competence',
  subcompetenceName: 'Leaf',
  nodeNamePath: ['Synthetic, "quoted" competence', 'Leaf'],
  elementTitle: `item-${order}`,
  itemLevelLabel: 'L3',
  difficulty: -0.5,
  discrimination: 1.2,
  guessing: 0,
  correct: true,
  score: 1,
  overallThetaAfter: null,
  levelDistance: 0,
  phase: 'COVERAGE',
  competenceThetaBefore: null,
  competenceStandardErrorBefore: null,
  competenceLevelBefore: null,
  competenceThetaAfter: 0.25,
  competenceStandardErrorAfter: 0.9,
  competenceLevelAfter: 'L3',
  competenceLowerLevelAfter: 'L1',
  competenceUpperLevelAfter: 'L5',
  levelDistanceBefore: null,
  ...overrides,
})

const attempt = {
  attemptCode: 'a1b2c3d4',
  participantCode: 'p9e8d7c6',
  attemptNumber: 1,
  startedAt: '2026-10-06T10:00:00.000Z',
  completedAt: '2026-10-06T10:10:00.000Z',
  elapsedSeconds: 600,
  stopReason: 'TOTAL_QUESTION_CAP',
  answerCount: 2,
  overall: node({}),
  competences: [
    node({
      nodeId: 1,
      name: 'Synthetic, "quoted" competence',
      kind: 'COMPETENCE',
      levelLabel: 'L4',
      determined: true,
    }),
  ],
  rating: 'CHECK',
  ratingReasons: [],
  estimatesComplete: true,
  review: {
    verdict: 'TOO_HIGH',
    expectedOverallLevelLabel: 'L2',
    expectedCompetenceLevels: [{ nodeId: 1, levelLabel: 'L3' }],
    comment: 'Expected lower; line\nbreak',
    updatedAt: '2026-10-06T11:00:00.000Z',
  },
  answers: [
    answer(1, {}),
    answer(2, {
      correct: false,
      score: 0,
      phase: 'PRECISION',
      competenceThetaBefore: 0.25,
      competenceStandardErrorBefore: 0.9,
      competenceLevelBefore: 'L3',
      levelDistanceBefore: 0,
      competenceThetaAfter: 0.1,
      competenceStandardErrorAfter: 0.7,
      competenceLowerLevelAfter: 'L3',
      competenceUpperLevelAfter: 'L3',
    }),
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

  test('writes one row per answer with estimates, final results and review', () => {
    const csv = buildAttemptAnswersCsv([attempt])
    expect(csv.startsWith('﻿')).toBe(true)
    const lines = csv.slice(1).trimEnd().split('\r\n')
    expect(lines[0]?.split(',').slice(0, 5)).toEqual([
      'participant_code',
      'attempt_code',
      'attempt_number',
      'completed_at',
      'order',
    ])
    expect(
      lines[1]?.startsWith(
        'p9e8d7c6,a1b2c3d4,1,2026-10-06T10:10:00.000Z,1,"Synthetic, ""quoted"" competence",Leaf,item-1,L3,-0.5,true,1,COVERAGE,,,,,0.25,0.9,L3,L1 - L5,L4,L2 - L4,true,L3,L2 - L4,false,CHECK,TOO_HIGH,L2,L3,"Expected lower; line'
      )
    ).toBe(true)
    expect(csv).toContain(
      ',PRECISION,0.25,0.9,L3,0,0.1,0.7,L3,L3,L4,L2 - L4,true,'
    )
  })
})
