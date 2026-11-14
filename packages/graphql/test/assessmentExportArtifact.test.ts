import { createHash } from 'node:crypto'
import type { StudentAssessmentResultsItem } from '@klicker-uzh/types'
import { parse } from 'csv-parse/sync'
import { describe, expect, it } from 'vitest'
import {
  assessmentExportColumns,
  buildAssessmentExportArtifact,
} from '../src/lib/assessmentExportArtifact.js'

const labels = {
  participantEmail: 'participantEmail',
  assessmentGivenName: 'assessmentGivenName',
  assessmentSurname: 'assessmentSurname',
  assessmentMatriculationNumber: 'assessmentMatriculationNumber',
  basePoints: 'basePoints',
  correctnessPoints: 'correctnessPoints',
  bonusPoints: 'bonusPoints',
  totalPoints: 'totalPoints',
}
const row: StudentAssessmentResultsItem = {
  participantId: 'synthetic-internal-id',
  participantEmail: 'synthetic@example.invalid',
  assessmentGivenName: 'Synthetic; "given"',
  assessmentSurname: 'Synthetic\nSurname',
  assessmentMatriculationNumber: '001234',
  basePoints: 2,
  correctnessPoints: 1.25,
  bonusPoints: -0.5,
}

describe('assessment CSV artifact', () => {
  it('round-trips the existing identity and score columns without internal IDs', () => {
    const artifact = buildAssessmentExportArtifact({ rows: [row], labels })
    const [result] = parse(artifact.body, {
      delimiter: ';',
      columns: true,
      bom: true,
    }) as [Record<string, string>]
    expect(Object.keys(result)).toEqual(assessmentExportColumns)
    expect(result).toEqual({
      participantEmail: row.participantEmail,
      assessmentGivenName: row.assessmentGivenName,
      assessmentSurname: row.assessmentSurname,
      assessmentMatriculationNumber: '001234',
      basePoints: '2',
      correctnessPoints: '1.25',
      bonusPoints: '-0.5',
      totalPoints: '2.75',
    })
    expect(artifact.recordCount).toBe(1)
    expect(artifact.byteCount).toBe(Buffer.byteLength(artifact.body))
    expect(artifact.sha256).toBe(
      createHash('sha256').update(artifact.body).digest('hex')
    )
  })

  it('neutralizes formulas in text cells without changing numeric scores', () => {
    for (const value of ['=1+1', '+1', '-1', '@SUM(A1)', '  =1', '\t=1']) {
      const artifact = buildAssessmentExportArtifact({
        rows: [{ ...row, assessmentSurname: value }],
        labels,
      })
      const [result] = parse(artifact.body, {
        delimiter: ';',
        columns: true,
        bom: true,
      }) as [Record<string, string>]
      expect(result.assessmentSurname).toBe(`'${value}`)
      expect(result.bonusPoints).toBe('-0.5')
    }
  })

  it('rejects invalid numeric results before producing an artifact', () => {
    for (const value of [NaN, Infinity, -Infinity]) {
      expect(() =>
        buildAssessmentExportArtifact({
          rows: [{ ...row, basePoints: value }],
          labels,
        })
      ).toThrow('DATA_EXPORT_INVALID_RESULT')
    }
  })
})
