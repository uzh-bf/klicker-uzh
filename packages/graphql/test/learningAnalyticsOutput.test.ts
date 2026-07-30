import { describe, expect, it } from 'vitest'
import {
  buildLearningAnalyticsCsv,
  deidentifyLearningAnalyticsRows,
  summarizeLearningAnalyticsRows,
} from '../src/lib/learningAnalyticsOutput.js'

function buildRows(count: number, partialCount = 0) {
  return Array.from({ length: count }, (_, index) => ({
    participantId: `internal-participant-${index + 1}`,
    activityPerformances: [
      {
        id: index * 2 + 1,
        activityId: 'activity-one',
        totalScore: 10 + index,
        completion: 1,
      },
      ...(index < partialCount
        ? []
        : [
            {
              id: index * 2 + 2,
              activityId: 'activity-two',
              totalScore: 20 + index,
              completion: 0.61,
            },
          ]),
    ],
  }))
}

describe('learning analytics output policy', () => {
  it('suppresses participant rows below the effective sample threshold', () => {
    const report = deidentifyLearningAnalyticsRows({
      rows: buildRows(4),
      activityIds: ['activity-one', 'activity-two'],
    })

    expect(report).toEqual({ effectiveN: 4, rows: [] })
  })

  it('assigns report-local labels in a fresh order without identifiers', () => {
    const first = deidentifyLearningAnalyticsRows({
      rows: buildRows(5),
      activityIds: ['activity-one', 'activity-two'],
      nextRandomInt: () => 0,
    })
    const second = deidentifyLearningAnalyticsRows({
      rows: buildRows(5),
      activityIds: ['activity-one', 'activity-two'],
      nextRandomInt: (max) => max - 1,
    })

    expect(first.rows.map((row) => row.studentLabel)).toEqual([
      'Student 1',
      'Student 2',
      'Student 3',
      'Student 4',
      'Student 5',
    ])
    expect(first.rows[0]!.activityPerformances[0]!.totalScore).not.toBe(
      second.rows[0]!.activityPerformances[0]!.totalScore
    )
    expect(JSON.stringify(first.rows)).not.toContain('internal-participant')
  })

  it('applies complete coverage before the sample-size check', () => {
    const report = deidentifyLearningAnalyticsRows({
      rows: buildRows(6, 2),
      activityIds: ['activity-one', 'activity-two'],
      includePartial: false,
    })

    expect(report).toEqual({ effectiveN: 4, rows: [] })
  })

  it('exports only coarse summaries and coverage metadata', () => {
    const report = deidentifyLearningAnalyticsRows({
      rows: buildRows(5, 1),
      activityIds: ['activity-one', 'activity-two'],
      nextRandomInt: (max) => max - 1,
    })
    const summaries = summarizeLearningAnalyticsRows(report.rows)
    const csv = buildLearningAnalyticsCsv({
      rows: summaries,
      effectiveN: report.effectiveN,
      includesPartial: true,
    })

    expect(summaries[0]).toEqual({
      studentLabel: 'Student 1',
      coverage: 'PARTIAL',
      completedActivities: 1,
      meanCompletion: 1,
    })
    expect(csv).toContain('coverage,complete_and_partial')
    expect(csv).toContain('effectiveN,5')
    expect(csv).toContain(
      'studentLabel,coverage,completedActivities,meanCompletion'
    )
    expect(csv).not.toMatch(
      /participantId|username|email|activity-one|activity-two|totalScore|free.?text/i
    )
  })
})
