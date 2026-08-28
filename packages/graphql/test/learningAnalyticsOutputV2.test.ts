import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { ActivityType } from '@klicker-uzh/types'
import { describe, expect, it } from 'vitest'
import {
  buildCourseActivityAnalyticsV2,
  buildCoursePerformanceAnalyticsV2,
  buildLearningAnalyticsExportV2,
  buildLearningAnalyticsStudentReportV2,
  roundPercentToTen,
} from '../src/lib/learningAnalyticsOutputV2.js'

function participantKeys(count: number) {
  return Array.from({ length: count }, (_, index) => `participant-${index + 1}`)
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

describe('learning analytics V2 disclosure output', () => {
  it('suppresses roots at four participants and releases them at five', () => {
    expect(
      buildCourseActivityAnalyticsV2({
        eligibleParticipantKeys: participantKeys(4),
        weeklyActivity: [],
      })
    ).toEqual({ isSuppressed: true, effectiveN: null, weeklyActivity: [] })

    const released = buildCourseActivityAnalyticsV2({
      eligibleParticipantKeys: participantKeys(5),
      weeklyActivity: participantKeys(5).map((participantKey) => ({
        participantKey,
        period: new Date('2026-01-05T00:00:00.000Z'),
      })),
    })
    expect(released).toEqual({
      isSuppressed: false,
      effectiveN: 5,
      weeklyActivity: [{ periodIndex: 1, effectiveN: 5 }],
    })

    expect(
      buildCoursePerformanceAnalyticsV2({
        eligibleParticipantKeys: participantKeys(4),
        activities: [],
      })
    ).toEqual({
      isSuppressed: true,
      effectiveN: null,
      activitySummaries: [],
      studentReport: {
        isSuppressed: true,
        effectiveN: null,
        students: [],
      },
    })
  })

  it('filters eligibility before applying the cell-size threshold', () => {
    const eligibleParticipantKeys = participantKeys(5)
    const activity = buildCourseActivityAnalyticsV2({
      eligibleParticipantKeys,
      weeklyActivity: [
        ...eligibleParticipantKeys.slice(0, 4).map((participantKey) => ({
          participantKey,
          period: new Date('2026-01-05T00:00:00.000Z'),
        })),
        {
          participantKey: 'ineligible-participant',
          period: new Date('2026-01-05T00:00:00.000Z'),
        },
      ],
    })
    expect(activity.weeklyActivity).toEqual([])

    const performance = buildCoursePerformanceAnalyticsV2({
      eligibleParticipantKeys,
      activities: [
        {
          activityType: ActivityType.PRACTICE_QUIZ,
          participantCompletions: [
            ...eligibleParticipantKeys
              .slice(0, 4)
              .map((participantKey) => ({ participantKey, completion: 1 })),
            { participantKey: 'ineligible-participant', completion: 1 },
          ],
        },
      ],
      nextRandomInt: () => 0,
    })
    expect(performance.activitySummaries).toEqual([])
    expect(performance).toMatchObject({
      isSuppressed: true,
      effectiveN: null,
      studentReport: { isSuppressed: true, effectiveN: null, students: [] },
    })
  })

  it.each([
    { rootSize: 6, cellSize: 5, expectedCells: [] },
    { rootSize: 8, cellSize: 5, expectedCells: [] },
    {
      rootSize: 10,
      cellSize: 5,
      expectedCells: [{ periodIndex: 1, effectiveN: 5 }],
    },
    {
      rootSize: 6,
      cellSize: 6,
      expectedCells: [{ periodIndex: 1, effectiveN: 6 }],
    },
  ])(
    'protects the complement for a weekly $cellSize-of-$rootSize cell',
    ({ rootSize, cellSize, expectedCells }) => {
      const eligibleParticipantKeys = participantKeys(rootSize)
      const analytics = buildCourseActivityAnalyticsV2({
        eligibleParticipantKeys,
        weeklyActivity: eligibleParticipantKeys
          .slice(0, cellSize)
          .map((participantKey) => ({
            participantKey,
            period: new Date('2026-01-05T00:00:00.000Z'),
          })),
      })

      expect(analytics.weeklyActivity).toEqual(expectedCells)
    }
  )

  it('numbers only disclosed periods and activities', () => {
    const eligibleParticipantKeys = participantKeys(10)
    const firstPeriod = new Date('2026-01-05T00:00:00.000Z')
    const secondPeriod = new Date('2026-01-12T00:00:00.000Z')
    const activity = buildCourseActivityAnalyticsV2({
      eligibleParticipantKeys,
      weeklyActivity: [
        ...eligibleParticipantKeys.slice(0, 4).map((participantKey) => ({
          participantKey,
          period: firstPeriod,
        })),
        ...eligibleParticipantKeys.slice(0, 5).map((participantKey) => ({
          participantKey,
          period: secondPeriod,
        })),
      ],
    })
    expect(activity.weeklyActivity).toEqual([{ periodIndex: 1, effectiveN: 5 }])

    const performance = buildCoursePerformanceAnalyticsV2({
      eligibleParticipantKeys,
      activities: [
        {
          activityType: ActivityType.PRACTICE_QUIZ,
          participantCompletions: eligibleParticipantKeys
            .slice(0, 4)
            .map((participantKey) => ({ participantKey, completion: 1 })),
        },
        {
          activityType: ActivityType.MICRO_LEARNING,
          participantCompletions: [
            ...eligibleParticipantKeys.slice(0, 5).map((participantKey) => ({
              participantKey,
              completion: 1,
            })),
            ...eligibleParticipantKeys.slice(5).map((participantKey) => ({
              participantKey,
              completion: 0.5,
            })),
          ],
        },
      ],
      nextRandomInt: (max) => max - 1,
    })
    expect(performance.activitySummaries[0]?.activityIndex).toBe(1)
    expect(performance.activitySummaries).toHaveLength(1)
  })

  it.each([
    { cohortSize: 6, expectedEffectiveNs: [] },
    { cohortSize: 8, expectedEffectiveNs: [] },
    { cohortSize: 10, expectedEffectiveNs: [5, 5] },
  ])(
    'protects activity complements within a safe cohort of $cohortSize',
    ({ cohortSize, expectedEffectiveNs }) => {
      const eligibleParticipantKeys = participantKeys(cohortSize)
      const performance = buildCoursePerformanceAnalyticsV2({
        eligibleParticipantKeys,
        activities: [
          {
            activityType: ActivityType.PRACTICE_QUIZ,
            participantCompletions: eligibleParticipantKeys
              .slice(0, 5)
              .map((participantKey) => ({ participantKey, completion: 1 })),
          },
          {
            activityType: ActivityType.MICRO_LEARNING,
            participantCompletions: eligibleParticipantKeys
              .slice(5)
              .map((participantKey) => ({ participantKey, completion: 1 })),
          },
        ],
        nextRandomInt: (max) => max - 1,
      })

      expect(performance.effectiveN).toBe(cohortSize)
      expect(performance.studentReport.effectiveN).toBe(cohortSize)
      expect(
        performance.activitySummaries.map(({ effectiveN }) => effectiveN)
      ).toEqual(expectedEffectiveNs)
    }
  )

  it('releases an all-cohort activity cell', () => {
    const eligibleParticipantKeys = participantKeys(6)
    const performance = buildCoursePerformanceAnalyticsV2({
      eligibleParticipantKeys,
      activities: [
        {
          activityType: ActivityType.PRACTICE_QUIZ,
          participantCompletions: eligibleParticipantKeys.map(
            (participantKey) => ({ participantKey, completion: 1 })
          ),
        },
      ],
      nextRandomInt: (max) => max - 1,
    })

    expect(performance.activitySummaries).toMatchObject([
      { activityIndex: 1, effectiveN: 6, completionPercent: 100 },
    ])
  })

  it('counts only eligible participants with activity-performance rows', () => {
    const eligibleParticipantKeys = participantKeys(6)
    const buildPerformance = (rowCount: number) =>
      buildCoursePerformanceAnalyticsV2({
        eligibleParticipantKeys,
        activities: [
          {
            activityType: ActivityType.PRACTICE_QUIZ,
            participantCompletions: eligibleParticipantKeys
              .slice(0, rowCount)
              .map((participantKey) => ({ participantKey, completion: 1 })),
          },
        ],
        nextRandomInt: (max) => max - 1,
      })

    expect(buildPerformance(4)).toMatchObject({
      isSuppressed: true,
      effectiveN: null,
      studentReport: { isSuppressed: true, effectiveN: null, students: [] },
    })
    expect(buildPerformance(5)).toMatchObject({
      isSuppressed: false,
      effectiveN: 5,
      studentReport: { isSuppressed: false, effectiveN: 5 },
    })

    const report = buildLearningAnalyticsStudentReportV2(
      [
        ...participantKeys(5).map((participantKey) => ({
          participantKey,
          completions: [1],
        })),
        { participantKey: 'participant-without-rows', completions: [] },
      ],
      (max) => max - 1
    )
    expect(report.effectiveN).toBe(5)
    expect(report.students).toHaveLength(5)
  })

  it('releases only student tuple groups with at least five members', () => {
    const report = buildLearningAnalyticsStudentReportV2(
      [
        ...participantKeys(5).map((participantKey) => ({
          participantKey,
          completions: [1],
        })),
        ...participantKeys(4).map((_, index) => ({
          participantKey: `secondary-${index + 1}`,
          completions: [0.4],
        })),
        { participantKey: 'unique-outlier', completions: [0] },
      ],
      (max) => max - 1
    )

    expect(report).toEqual({
      isSuppressed: false,
      effectiveN: 5,
      students: participantKeys(5).map((_, index) => ({
        studentLabel: `Student ${index + 1}`,
        completedActivities: 1,
        meanCompletionPercent: 100,
      })),
    })
    expect(JSON.stringify(report)).not.toMatch(
      /participant|secondary|unique-outlier/
    )
  })

  it.each([
    { candidateSize: 6, isSuppressed: true },
    { candidateSize: 8, isSuppressed: true },
    { candidateSize: 10, isSuppressed: false },
  ])(
    'protects the student-report complement for a released five-member tuple group with $candidateSize candidates',
    ({ candidateSize, isSuppressed }) => {
      const report = buildLearningAnalyticsStudentReportV2(
        [
          ...participantKeys(5).map((participantKey) => ({
            participantKey,
            completions: [1],
          })),
          ...Array.from({ length: candidateSize - 5 }, (_, index) => ({
            participantKey: `candidate-${index + 1}`,
            completions: [
              candidateSize === 10 && index === candidateSize - 6 ? 0.1 : 0,
            ],
          })),
        ],
        (max) => max - 1
      )

      expect(report.isSuppressed).toBe(isSuppressed)
      expect(report.effectiveN).toBe(isSuppressed ? null : 5)
    }
  )

  it('derives performance summaries only from the released student cohort', () => {
    const eligibleParticipantKeys = participantKeys(10)
    const performance = buildCoursePerformanceAnalyticsV2({
      eligibleParticipantKeys,
      activities: [
        {
          activityType: ActivityType.PRACTICE_QUIZ,
          participantCompletions: eligibleParticipantKeys.map(
            (participantKey, index) => ({
              participantKey,
              completion: index < 5 ? 1 : index < 9 ? 0.5 : 0,
            })
          ),
        },
      ],
      nextRandomInt: (max) => max - 1,
    })

    expect(performance).toMatchObject({
      isSuppressed: false,
      effectiveN: 5,
      activitySummaries: [
        { activityIndex: 1, effectiveN: 5, completionPercent: 100 },
      ],
      studentReport: { isSuppressed: false, effectiveN: 5 },
    })
    expect(JSON.stringify(performance)).not.toContain('participant-')
  })

  it('suppresses a student report when no released tuple group remains', () => {
    const report = buildLearningAnalyticsStudentReportV2([
      ...participantKeys(4).map((participantKey) => ({
        participantKey,
        completions: [1],
      })),
      ...participantKeys(4).map((_, index) => ({
        participantKey: `secondary-${index + 1}`,
        completions: [0.5],
      })),
      ...participantKeys(2).map((_, index) => ({
        participantKey: `tertiary-${index + 1}`,
        completions: [0],
      })),
    ])

    expect(report).toEqual({
      isSuppressed: true,
      effectiveN: null,
      students: [],
    })
  })

  it('assigns freshly shuffled report-local labels with an injectable RNG', () => {
    const rows = participantKeys(10).map((participantKey, index) => ({
      participantKey,
      completions: [index < 5 ? 0.2 : 0.8],
    }))
    const first = buildLearningAnalyticsStudentReportV2(rows, () => 0)
    const second = buildLearningAnalyticsStudentReportV2(rows, (max) => max - 1)

    expect(first.students.map((student) => student.studentLabel)).toEqual([
      'Student 1',
      'Student 2',
      'Student 3',
      'Student 4',
      'Student 5',
      'Student 6',
      'Student 7',
      'Student 8',
      'Student 9',
      'Student 10',
    ])
    expect(
      first.students.map((student) => student.meanCompletionPercent)
    ).not.toEqual(
      second.students.map((student) => student.meanCompletionPercent)
    )
    expect(JSON.stringify(first)).not.toContain('participant-')
  })

  it('rounds percentages to ten-point steps and clamps source values', () => {
    expect([
      roundPercentToTen(-1),
      roundPercentToTen(44),
      roundPercentToTen(45),
      roundPercentToTen(101),
    ]).toEqual([0, 40, 50, 100])

    const performance = buildCoursePerformanceAnalyticsV2({
      eligibleParticipantKeys: participantKeys(5),
      activities: [-1, 0.44, 0.45, 1, 2].map((completion) => ({
        activityType: ActivityType.MICRO_LEARNING,
        participantCompletions: participantKeys(5).map((participantKey) => ({
          participantKey,
          completion,
        })),
      })),
      nextRandomInt: (max) => max - 1,
    })

    expect(
      performance.activitySummaries.map(
        ({ activityIndex, completionPercent }) => ({
          activityIndex,
          completionPercent,
        })
      )
    ).toEqual([
      { activityIndex: 1, completionPercent: 0 },
      { activityIndex: 2, completionPercent: 40 },
      { activityIndex: 3, completionPercent: 50 },
      { activityIndex: 4, completionPercent: 100 },
      { activityIndex: 5, completionPercent: 100 },
    ])
    expect(performance.studentReport.students.at(-1)).toMatchObject({
      completedActivities: 2,
      meanCompletionPercent: 60,
    })
  })

  it('exports only the fixed deidentified student-report whitelist', () => {
    const report = buildLearningAnalyticsStudentReportV2(
      participantKeys(5).map((participantKey) => ({
        participantKey,
        completions: [1, 0.4],
      })),
      (max) => max - 1
    )
    const json = buildLearningAnalyticsExportV2(report, 'JSON')!
    const csv = buildLearningAnalyticsExportV2(report, 'CSV')!

    expect(json).toMatchObject({
      format: 'JSON',
      filename: 'learning-analytics-student-report.json',
      mimeType: 'application/json',
      effectiveN: 5,
    })
    expect(Object.keys(JSON.parse(json.content))).toEqual([
      'schemaVersion',
      'effectiveN',
      'students',
    ])
    expect(Object.keys(JSON.parse(json.content).students[0])).toEqual([
      'studentLabel',
      'completedActivities',
      'meanCompletionPercent',
    ])
    expect(csv).toMatchObject({
      format: 'CSV',
      filename: 'learning-analytics-student-report.csv',
      mimeType: 'text/csv',
      effectiveN: 5,
    })
    expect(csv.content.split('\n').slice(0, 3)).toEqual([
      'schemaVersion,v2',
      'effectiveN,5',
      'studentLabel,completedActivities,meanCompletionPercent',
    ])

    expect(
      buildLearningAnalyticsExportV2(
        { isSuppressed: true, effectiveN: null, students: [] },
        'JSON'
      )
    ).toBeNull()

    for (const content of [json.content, csv.content]) {
      expect(content).not.toMatch(
        /participantId|participantKey|username|email|activityId|totalScore|coverage|partial|timestamp/i
      )
    }
  })

  it('pins the byte-identical V1 operations and schema definitions', () => {
    const operations = new Map([
      [
        'QGetActivityAnalytics.graphql',
        'ece820cbcfd5c264f7fad6e54ba633e860d58ff51ea753d641afb81f988cfe0c',
      ],
      [
        'QGetCourseActivityAnalytics.graphql',
        '0586051cff2d772760e9cfb23ad906784f83d1a5db8e4777487d09ddb3242abf',
      ],
      [
        'QGetCoursePerformanceAnalytics.graphql',
        '900226493868157f6c210d66fc1ad63ed9e1305a4f5e9910ae913cf60b6e72c1',
      ],
      [
        'QGetCourseWeeklyActivity.graphql',
        '00d021e232e3b85ab4a785c561c5477e1df7d74f07df45cab089706478654df4',
      ],
    ])
    for (const [filename, expectedHash] of operations) {
      const source = readFileSync(
        new URL(`../src/graphql/ops/${filename}`, import.meta.url),
        'utf8'
      )
      expect(sha256(source)).toBe(expectedHash)
    }

    const schema = readFileSync(
      new URL('../src/public/schema.graphql', import.meta.url),
      'utf8'
    )
    const v1Definitions = new Map([
      [
        'CourseActivityAnalytics',
        'ec4dbf4dde5275df06ce0682b02d2433235cf6aacb799c29f93b4b0600d45016',
      ],
      [
        'CoursePerformanceAnalytics',
        '5933007fef764284818f6343fc662bd67c33df10b45fcd346f708efa8241f2d4',
      ],
      [
        'WeeklyCourseActivities',
        '6a2c8c817c2284524776b6ba3745b4c3e2e91b0b7434cd3533ac56ba65b0fbde',
      ],
    ])
    for (const [typeName, expectedHash] of v1Definitions) {
      const start = schema.indexOf(`type ${typeName} {`)
      const end = schema.indexOf('\n}', start) + 2
      expect(start).toBeGreaterThanOrEqual(0)
      expect(sha256(schema.slice(start, end))).toBe(expectedHash)
    }
  })
})
