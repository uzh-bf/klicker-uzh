import type {
  AssessmentReportSnapshotV1,
  AssessmentReportSnapshotV2,
} from '@klicker-uzh/types'
import { describe, expect, it } from 'vitest'
import {
  assessmentReportClaimsMatch,
  buildAssessmentReportComparison,
  canonicalizeJson,
  hashAssessmentReportSnapshot,
  parseAssessmentReportSnapshot,
  withoutAssessmentReportComparison,
} from '../src/services/assessmentReports.js'

function createSnapshot(): AssessmentReportSnapshotV1 {
  return {
    version: 1,
    subject: {
      email: 'student@example.org',
      source: 'COURSE_INVITATION',
    },
    course: {
      id: 'course-id',
      name: 'Assessment Course',
      displayName: 'Assessment Course 2026',
    },
    results: {
      basePoints: 4,
      availableBasePoints: 5,
      correctnessPoints: 3,
      availableCorrectnessPoints: 4,
      bonusPoints: 1,
      availableBonusPoints: 1,
      totalPoints: 8,
      availableTotalPoints: 10,
    },
    comparison: {
      cohortSize: 10,
      percentile: 60,
      histogram: [
        { binStart: 0, binEnd: 5, count: 4 },
        { binStart: 5, binEnd: 10, count: 6 },
      ],
    },
  }
}

function createSnapshotV2(): AssessmentReportSnapshotV2 {
  const snapshot = createSnapshot()
  return {
    ...snapshot,
    version: 2,
    subject: {
      email: snapshot.subject.email,
      givenName: 'Ada',
      surname: 'Lovelace',
      matriculationNumber: '00-123-456',
      source: 'SWITCH_EDUID',
    },
  }
}

describe('assessment report snapshots', () => {
  it('canonicalizes object keys independently of insertion order', () => {
    expect(canonicalizeJson({ b: 2, a: { d: 4, c: 3 } })).toBe(
      canonicalizeJson({ a: { c: 3, d: 4 }, b: 2 })
    )
  })

  it('hashes equal snapshots identically and claim changes differently', () => {
    const snapshot = createSnapshot()
    const hash = hashAssessmentReportSnapshot(snapshot)
    const variants: AssessmentReportSnapshotV1[] = [
      {
        ...snapshot,
        subject: { ...snapshot.subject, email: 'other@example.org' },
      },
      {
        ...snapshot,
        course: { ...snapshot.course, displayName: 'Renamed course' },
      },
      {
        ...snapshot,
        results: {
          ...snapshot.results,
          basePoints: 5,
          totalPoints: 9,
        },
      },
      {
        ...snapshot,
        comparison: {
          ...snapshot.comparison!,
          percentile: 70,
        },
      },
    ]

    expect(hashAssessmentReportSnapshot(structuredClone(snapshot))).toBe(hash)
    variants.forEach((variant) => {
      expect(hashAssessmentReportSnapshot(variant)).not.toBe(hash)
    })
  })

  it('ignores comparison drift when matching authoritative claims', () => {
    const snapshot = createSnapshot()
    const changedComparison = {
      ...snapshot,
      comparison: { ...snapshot.comparison!, percentile: 70 },
    }
    const changedScore = {
      ...snapshot,
      results: { ...snapshot.results, basePoints: 5, totalPoints: 9 },
    }

    expect(assessmentReportClaimsMatch(snapshot, changedComparison)).toBe(true)
    expect(assessmentReportClaimsMatch(snapshot, changedScore)).toBe(false)
    expect(withoutAssessmentReportComparison(snapshot).comparison).toBeNull()
  })

  it('rejects unknown versions and malformed stored snapshots', () => {
    const snapshot = createSnapshot()
    const snapshotV2 = createSnapshotV2()
    expect(
      parseAssessmentReportSnapshot({
        snapshotVersion: 2,
        snapshot: snapshotV2,
      })
    ).toEqual(snapshotV2)
    expect(
      parseAssessmentReportSnapshot({ snapshotVersion: 3, snapshot })
    ).toBeNull()
    expect(
      parseAssessmentReportSnapshot({
        snapshotVersion: 1,
        snapshot: {
          ...snapshot,
          subject: {
            ...snapshot.subject,
            source: 'EDUID',
          },
        },
      })
    ).toBeNull()
    expect(
      parseAssessmentReportSnapshot({
        snapshotVersion: 2,
        snapshot: {
          ...snapshotV2,
          subject: { ...snapshotV2.subject, givenName: '' },
        },
      })
    ).toBeNull()
    expect(
      parseAssessmentReportSnapshot({
        snapshotVersion: 1,
        snapshot: {
          ...snapshot,
          subject: { ...snapshot.subject, email: 'not-an-email' },
        },
      })
    ).toBeNull()
    expect(
      parseAssessmentReportSnapshot({
        snapshotVersion: 1,
        snapshot: {
          ...snapshot,
          results: { ...snapshot.results, totalPoints: 999 },
        },
      })
    ).toBeNull()
    expect(
      parseAssessmentReportSnapshot({
        snapshotVersion: 1,
        snapshot: {
          ...snapshot,
          comparison: {
            cohortSize: 10,
            percentile: 60,
            histogram: [{ binStart: 0, binEnd: 10, count: 2 }],
          },
        },
      })
    ).toBeNull()
  })

  it('withholds comparison data below the privacy threshold or at zero range', () => {
    expect(
      buildAssessmentReportComparison({
        scores: Array(9).fill(1),
        studentScore: 1,
        availableTotalPoints: 10,
      })
    ).toBeNull()
    expect(
      buildAssessmentReportComparison({
        scores: Array(10).fill(0),
        studentScore: 0,
        availableTotalPoints: 0,
      })
    ).toBeNull()
  })

  it('preserves distinct bins for a very small non-zero score range', () => {
    const comparison = buildAssessmentReportComparison({
      scores: Array(10).fill(0.005),
      studentScore: 0.005,
      availableTotalPoints: 0.01,
    })

    expect(comparison).not.toBeNull()
    expect(comparison!.histogram.at(-1)?.binEnd).toBe(0.01)
    expect(
      comparison!.histogram.every((bin) => bin.binEnd > bin.binStart)
    ).toBe(true)
  })

  it('merges sparse bins and preserves the complete cohort', () => {
    const comparison = buildAssessmentReportComparison({
      scores: [1, 2, 3, 31, 32, 33, 91, 92, 93, 94],
      studentScore: 32,
      availableTotalPoints: 100,
    })

    expect(comparison).not.toBeNull()
    expect(comparison!.percentile).toBe(50)
    expect(comparison!.histogram).toEqual([
      { binStart: 0, binEnd: 10, count: 3 },
      { binStart: 10, binEnd: 40, count: 3 },
      { binStart: 40, binEnd: 100, count: 4 },
    ])
    expect(comparison!.histogram.reduce((sum, bin) => sum + bin.count, 0)).toBe(
      comparison!.cohortSize
    )
    expect(comparison!.histogram.every((bin) => bin.count >= 3)).toBe(true)
  })
})
