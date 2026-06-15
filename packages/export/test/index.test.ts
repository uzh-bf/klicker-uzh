import { statSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import ExcelJS from 'exceljs'
import { afterEach, describe, expect, it } from 'vitest'

import { CliUsageError, parseExportCourseArgs } from '../src/cli.js'
import { transformCorrection } from '../src/corrections.js'
import { writeCsv } from '../src/csv.js'
import {
  type CourseExportResult,
  writeCombinedWorkbook,
} from '../src/exportCourse.js'
import { transformInvitation } from '../src/invitations.js'
import { transformLiveQuizResponse } from '../src/liveQuizResponses.js'
import { transformParticipant } from '../src/participants.js'
import { makePiiSalt, pseudonymize } from '../src/pii.js'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true }))
  )
})

async function createTempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'klicker-export-'))
  tempDirs.push(dir)
  return dir
}

function createCourseExportResult(courseName: string): CourseExportResult {
  return {
    outputPath: `/tmp/${courseName}`,
    courseName,
    counts: {
      liveQuizResponses: 0,
      participants: 0,
      invitations: 0,
      corrections: 0,
    },
    data: {
      liveQuizRows: [],
      participantRows: [],
      invitationRows: [],
      correctionRows: [],
    },
  }
}

describe('@klicker-uzh/export', () => {
  it('parses repeated course ids and output directory', () => {
    expect(
      parseExportCourseArgs([
        '--',
        '--courseId',
        'course-1',
        '--courseId',
        'course-2',
        '--outputDir',
        '/tmp/export',
      ])
    ).toEqual({
      courseIds: ['course-1', 'course-2'],
      outputDir: '/tmp/export',
      pseudonymize: false,
    })
  })

  it('parses the --pseudonymize flag', () => {
    expect(
      parseExportCourseArgs(['--courseId', 'course-1', '--pseudonymize'])
    ).toEqual({
      courseIds: ['course-1'],
      outputDir: './export-output',
      pseudonymize: true,
    })
    expect(parseExportCourseArgs(['--courseId', 'course-1']).pseudonymize).toBe(
      false
    )
  })

  it('rejects malformed CLI arguments before export starts', () => {
    expect(() => parseExportCourseArgs([])).toThrow(CliUsageError)
    expect(() => parseExportCourseArgs(['--courseId'])).toThrow(CliUsageError)
    expect(() => parseExportCourseArgs(['--courseId', '--outputDir'])).toThrow(
      CliUsageError
    )
    expect(() => parseExportCourseArgs(['--unknown'])).toThrow(CliUsageError)
  })

  it('writes distinct combined workbook sheet names for colliding course prefixes', async () => {
    const outputDir = await createTempDir()

    const outputPath = await writeCombinedWorkbook(
      [
        createCourseExportResult('Assessment Export Prefix A 2026'),
        createCourseExportResult('Assessment Export Prefix B 2026'),
      ],
      outputDir
    )

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(outputPath)

    expect(workbook.worksheets).toHaveLength(8)
    expect(new Set(workbook.worksheets.map((sheet) => sheet.name)).size).toBe(8)
  })

  it('writes distinct combined workbook sheet names for case-only collisions', async () => {
    const outputDir = await createTempDir()

    const outputPath = await writeCombinedWorkbook(
      [createCourseExportResult('Math'), createCourseExportResult('math')],
      outputDir
    )

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(outputPath)

    expect(workbook.worksheets).toHaveLength(8)
    expect(
      new Set(workbook.worksheets.map((sheet) => sheet.name.toLowerCase())).size
    ).toBe(8)
  })

  it('prefers the primary participant account over array order when exporting participants', () => {
    const row = {
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      participant: {
        id: 'participant-1',
        email: 'participant@example.org',
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        accounts: [
          {
            ssoType: 'affiliation',
            ssoId: 'affiliation-id',
            ssoEmail: 'affiliation@example.org',
            isPrimary: false,
            isVerified: true,
            createdAt: new Date('2025-02-01T00:00:00.000Z'),
          },
          {
            ssoType: 'EDUID',
            ssoId: 'edu-id',
            ssoEmail: 'primary@example.org',
            isPrimary: true,
            isVerified: true,
            createdAt: new Date('2025-01-01T00:00:00.000Z'),
          },
        ],
      },
    } as Parameters<typeof transformParticipant>[0]

    expect(transformParticipant(row)).toEqual([
      'participant-1',
      'participant@example.org',
      true,
      '2026-01-01T00:00:00.000Z',
      'EDUID',
      'edu-id',
      'primary@example.org',
      '2025-01-01T00:00:00.000Z',
    ])
  })

  it('emits liveQuizResponseId and structural join keys as the leading RESPONSES columns', () => {
    const row = {
      id: 9001,
      response: { type: 'SC', choices: [] },
      correctness: 'CORRECT',
      basePoints: 10,
      correctnessPoints: 5,
      bonusPoints: 2,
      submittedAt: new Date('2026-01-02T03:04:05.000Z'),
      correctionOnly: false,
      elementBlockExecution: 0,
      participant: { id: 'participant-1', email: 'participant@example.org' },
      instance: {
        id: 42,
        order: 3,
        elementId: 77,
        elementType: 'SC',
        elementData: { name: 'Question name', content: 'Question content' },
        elementBlock: {
          id: 5,
          order: 1,
          liveQuiz: { id: 'live-quiz-1', name: 'Quiz', displayName: null },
        },
      },
      _count: { appliedCorrections: 0 },
    } as unknown as Parameters<typeof transformLiveQuizResponse>[0]

    const out = transformLiveQuizResponse(row)
    // [liveQuizResponseId, elementBlockId, elementBlockOrder, instanceOrder, elementId]
    expect(out.slice(0, 5)).toEqual([9001, 5, 1, 3, 77])
    // participantId now follows the structural keys
    expect(out[5]).toBe('participant-1')
  })

  it('falls back to empty block ids when a response has no element block', () => {
    const row = {
      id: 9002,
      response: null,
      correctness: 'WRONG',
      basePoints: 0,
      correctnessPoints: 0,
      bonusPoints: 0,
      submittedAt: new Date('2026-01-02T03:04:05.000Z'),
      correctionOnly: false,
      elementBlockExecution: 0,
      participant: { id: 'participant-2', email: null },
      instance: {
        id: 43,
        order: 0,
        elementId: 78,
        elementType: 'CONTENT',
        elementData: { name: 'Content', content: 'Content' },
        elementBlock: null,
      },
      _count: { appliedCorrections: 0 },
    } as unknown as Parameters<typeof transformLiveQuizResponse>[0]

    const out = transformLiveQuizResponse(row)
    expect(out.slice(0, 5)).toEqual([9002, '', '', 0, 78])
  })

  it('emits liveQuizResponseId and elementBlockExecution join keys on corrections', () => {
    const row = {
      id: 555,
      awardedBasePoints: 1,
      awardedCorrectnessPoints: 0,
      awardedBonusPoints: 0,
      deductedBasePoints: 0,
      deductedCorrectnessPoints: 0,
      deductedBonusPoints: 0,
      createdAt: new Date('2026-01-02T03:04:05.000Z'),
      pointCorrection: { type: 'AWARD', reason: 'reason', studentReason: 'sr' },
      response: {
        id: 9001,
        elementBlockExecution: 2,
        participant: { id: 'participant-1', email: 'participant@example.org' },
        instance: {
          id: 42,
          elementData: { name: 'Question name', content: 'Question content' },
          elementBlock: {
            liveQuiz: { id: 'live-quiz-1', name: 'Quiz', displayName: null },
          },
        },
      },
    } as unknown as Parameters<typeof transformCorrection>[0]

    const out = transformCorrection(row)
    // [correctionId, liveQuizResponseId, elementBlockExecution, participantId]
    expect(out.slice(0, 4)).toEqual([555, 9001, 2, 'participant-1'])
  })

  it('pseudonymizes deterministically within a salt and empties nullish values', () => {
    const salt = makePiiSalt()
    expect(salt).toMatch(/^[0-9a-f]{32}$/)
    expect(pseudonymize(null, salt)).toBe('')
    expect(pseudonymize('', salt)).toBe('')
    const token = pseudonymize('user@example.org', salt)
    expect(token).toMatch(/^[0-9a-f]{16}$/)
    expect(pseudonymize('user@example.org', salt)).toBe(token)
    expect(pseudonymize('user@example.org', makePiiSalt())).not.toBe(token)
  })

  it('redacts direct identifiers and free text in pseudonymize mode', () => {
    const ctx = { mode: 'pseudonymize' as const, salt: 'fixed-test-salt' }

    const participant = {
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      participant: {
        id: 'participant-1',
        email: 'participant@example.org',
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        accounts: [
          {
            ssoType: 'EDUID',
            ssoId: 'edu-id',
            ssoEmail: 'primary@example.org',
            isPrimary: true,
            isVerified: true,
            createdAt: new Date('2025-01-01T00:00:00.000Z'),
          },
        ],
      },
    } as unknown as Parameters<typeof transformParticipant>[0]
    const pRow = transformParticipant(participant, ctx)
    expect(pRow[0]).toBe('participant-1') // opaque UUID kept
    expect(pRow[1]).toMatch(/^[0-9a-f]{16}$/) // email hashed
    expect(pRow[1]).not.toBe('participant@example.org')
    expect(pRow[5]).toMatch(/^[0-9a-f]{16}$/) // ssoId hashed
    expect(pRow[6]).toMatch(/^[0-9a-f]{16}$/) // ssoEmail hashed

    const invitation = {
      id: 1,
      email: 'invitee@example.org',
      matriculationNumber: '12-345-678',
      status: 'PENDING',
      invitedAt: new Date('2026-01-01T00:00:00.000Z'),
      acceptedAt: null,
      participant: null,
    } as unknown as Parameters<typeof transformInvitation>[0]
    const iRow = transformInvitation(invitation, ctx)
    expect(iRow[1]).toMatch(/^[0-9a-f]{16}$/) // email hashed
    expect(iRow[2]).toMatch(/^[0-9a-f]{16}$/) // matriculationNumber hashed
    expect(iRow[2]).not.toBe('12-345-678')

    const response = {
      id: 9001,
      response: { type: 'SC', choices: [] },
      correctness: 'CORRECT',
      basePoints: 0,
      correctnessPoints: 0,
      bonusPoints: 0,
      submittedAt: new Date('2026-01-02T03:04:05.000Z'),
      correctionOnly: false,
      elementBlockExecution: 0,
      participant: { id: 'participant-1', email: 'participant@example.org' },
      instance: {
        id: 42,
        order: 0,
        elementId: 77,
        elementType: 'SC',
        elementData: { name: 'Q', content: 'C' },
        elementBlock: {
          id: 5,
          order: 1,
          liveQuiz: { id: 'lq-1', name: 'Quiz', displayName: null },
        },
      },
      _count: { appliedCorrections: 0 },
    } as unknown as Parameters<typeof transformLiveQuizResponse>[0]
    const rRow = transformLiveQuizResponse(response, ctx)
    expect(rRow[6]).toMatch(/^[0-9a-f]{16}$/) // email hashed (index 6)
    expect(rRow[14]).toBe('[redacted]') // response JSON redacted (index 14)

    const correction = {
      id: 555,
      awardedBasePoints: 0,
      awardedCorrectnessPoints: 0,
      awardedBonusPoints: 0,
      deductedBasePoints: 0,
      deductedCorrectnessPoints: 0,
      deductedBonusPoints: 0,
      createdAt: new Date('2026-01-02T03:04:05.000Z'),
      pointCorrection: { type: 'AWARD', reason: 'reason', studentReason: 'sr' },
      response: {
        id: 9001,
        elementBlockExecution: 2,
        participant: { id: 'participant-1', email: 'participant@example.org' },
        instance: {
          id: 42,
          elementData: { name: 'Q', content: 'C' },
          elementBlock: {
            liveQuiz: { id: 'lq-1', name: 'Quiz', displayName: null },
          },
        },
      },
    } as unknown as Parameters<typeof transformCorrection>[0]
    const cRow = transformCorrection(correction, ctx)
    expect(cRow[4]).toMatch(/^[0-9a-f]{16}$/) // email hashed
    expect(cRow[11]).toBe('[redacted]') // studentReason redacted
  })

  it('writes CSV files with owner-only (0600) permissions', async () => {
    const outputDir = await createTempDir()
    const filePath = join(outputDir, 'perm.csv')
    await writeCsv(filePath, ['a'], [['1']])
    expect(statSync(filePath).mode & 0o777).toBe(0o600)
  })

  it('neutralizes spreadsheet formulas in CSV output', async () => {
    const outputDir = await createTempDir()
    const filePath = join(outputDir, 'test.csv')

    await writeCsv(
      filePath,
      ['value'],
      [['=2+2'], ['+SUM(A1:A2)'], ['-10'], ['@cmd'], [' =2+2'], ['\t=2+2']]
    )

    await expect(readFile(filePath, 'utf8')).resolves.toBe(
      "value\n'=2+2\n'+SUM(A1:A2)\n'-10\n'@cmd\n' =2+2\n'\t=2+2\n"
    )
  })
})
