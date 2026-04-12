import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import ExcelJS from 'exceljs'
import { afterEach, describe, expect, it } from 'vitest'

import { writeCsv } from '../src/csv.js'
import {
  type CourseExportResult,
  writeCombinedWorkbook,
} from '../src/exportCourse.js'
import { transformParticipant } from '../src/participants.js'

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
