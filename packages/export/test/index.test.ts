import { statSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import ExcelJS from 'exceljs'
import { afterEach, describe, expect, it } from 'vitest'

import { CliUsageError, parseExportCourseArgs } from '../src/cli.js'
import { transformCorrection } from '../src/corrections.js'
import { writeCsv } from '../src/csv.js'
import {
  ELEMENT_INSTANCE_HEADERS,
  transformElementInstance,
} from '../src/elementInstances.js'
import {
  type CourseExportResult,
  writeCombinedWorkbook,
} from '../src/exportCourse.js'
import { transformInvitation } from '../src/invitations.js'
import {
  LIVE_QUIZ_RESPONSE_HEADERS,
  transformLiveQuizResponse,
} from '../src/liveQuizResponses.js'
import { LIVE_QUIZ_HEADERS, transformLiveQuiz } from '../src/liveQuizzes.js'
import { computeSha256, writeManifest } from '../src/manifest.js'
import { transformParticipant } from '../src/participants.js'
import { makePiiSalt, pseudonymize } from '../src/pii.js'
import { createReadonlyClient } from '../src/readonlyPrisma.js'

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
    manifestPath: `/tmp/${courseName}/manifest.json`,
    counts: {
      liveQuizResponses: 0,
      participants: 0,
      invitations: 0,
      corrections: 0,
      liveQuizzes: 0,
      elementInstances: 0,
    },
    data: {
      liveQuizRows: [],
      participantRows: [],
      invitationRows: [],
      correctionRows: [],
      liveQuizDimRows: [],
      elementInstanceRows: [],
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

  it('read-only client allows reads but blocks model writes and raw queries', async () => {
    let intercept:
      | ((p: {
          operation: string
          args: unknown
          query: (a: unknown) => Promise<unknown>
        }) => Promise<unknown>)
      | undefined
    const fakePrisma = {
      $extends: (ext: {
        query: { $allOperations: NonNullable<typeof intercept> }
      }) => {
        intercept = ext.query.$allOperations
        return {}
      },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createReadonlyClient(fakePrisma as any)
    const run = (operation: string) =>
      intercept!({ operation, args: {}, query: async () => 'ok' })

    await expect(run('findMany')).resolves.toBe('ok')
    await expect(run('findUniqueOrThrow')).resolves.toBe('ok')
    await expect(run('count')).resolves.toBe('ok')
    await expect(run('create')).rejects.toThrow('Write blocked')
    await expect(run('deleteMany')).rejects.toThrow('Write blocked')
    await expect(run('$queryRaw')).rejects.toThrow('Write blocked')
    await expect(run('$executeRaw')).rejects.toThrow('Write blocked')
  })

  it('locks the combined workbook dir to 0700 and file to 0600', async () => {
    const outputDir = await createTempDir()
    const outputPath = await writeCombinedWorkbook(
      [createCourseExportResult('Course A 2026')],
      outputDir
    )
    expect(statSync(outputPath).mode & 0o777).toBe(0o600)
    expect(statSync(outputDir).mode & 0o777).toBe(0o700)
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

    expect(workbook.worksheets).toHaveLength(12)
    expect(new Set(workbook.worksheets.map((sheet) => sheet.name)).size).toBe(
      12
    )
  })

  it('writes distinct combined workbook sheet names for case-only collisions', async () => {
    const outputDir = await createTempDir()

    const outputPath = await writeCombinedWorkbook(
      [createCourseExportResult('Math'), createCourseExportResult('math')],
      outputDir
    )

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(outputPath)

    expect(workbook.worksheets).toHaveLength(12)
    expect(
      new Set(workbook.worksheets.map((sheet) => sheet.name.toLowerCase())).size
    ).toBe(12)
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

  it('leaves participant identity columns empty for quiz-scoped respondents', () => {
    const row = {
      id: 9003,
      response: { type: 'SC', choices: [] },
      correctness: 'CORRECT',
      basePoints: 10,
      correctnessPoints: 5,
      bonusPoints: 0,
      submittedAt: new Date('2026-01-02T03:04:05.000Z'),
      correctionOnly: false,
      elementBlockExecution: 0,
      participant: null,
      instance: {
        id: 44,
        order: 0,
        elementId: 79,
        elementType: 'SC',
        elementData: { name: 'Question', content: 'Question' },
        elementBlock: {
          id: 6,
          order: 1,
          liveQuiz: { id: 'live-quiz-1', name: 'Quiz', displayName: null },
        },
      },
      _count: { appliedCorrections: 0 },
    } as unknown as Parameters<typeof transformLiveQuizResponse>[0]

    const out = transformLiveQuizResponse(row)

    expect(out[5]).toBe('')
    expect(out[6]).toBe('')
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
    expect(rRow[13]).toBe('[redacted]') // response JSON redacted (index 13)

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

  it('flattens type-specific answers and drops the truncated content column', () => {
    expect(LIVE_QUIZ_RESPONSE_HEADERS).not.toContain('elementContent')
    expect(LIVE_QUIZ_RESPONSE_HEADERS.slice(-4)).toEqual([
      'response_choices',
      'response_value',
      'response_selection',
      'response_assessment',
    ])

    const base = {
      id: 1,
      correctness: 'CORRECT',
      basePoints: 0,
      correctnessPoints: 0,
      bonusPoints: 0,
      submittedAt: new Date('2026-01-02T03:04:05.000Z'),
      correctionOnly: false,
      elementBlockExecution: 0,
      participant: { id: 'p', email: null },
      instance: {
        id: 1,
        order: 0,
        elementId: 1,
        elementType: 'SC',
        elementData: { name: 'n', content: 'c' },
        elementBlock: {
          id: 1,
          order: 0,
          liveQuiz: { id: 'lq', name: 'q', displayName: null },
        },
      },
      _count: { appliedCorrections: 0 },
    }

    const choices = transformLiveQuizResponse({
      ...base,
      response: {
        choices: [
          { ix: 0, selected: false },
          { ix: 2, selected: true },
          { ix: 3, selected: true },
        ],
      },
    } as unknown as Parameters<typeof transformLiveQuizResponse>[0])
    expect(choices).toHaveLength(LIVE_QUIZ_RESPONSE_HEADERS.length)
    expect(choices[22]).toBe('2,3') // response_choices: selected ix only

    const numerical = transformLiveQuizResponse({
      ...base,
      instance: { ...base.instance, elementType: 'NUMERICAL' },
      response: { value: '42' },
    } as unknown as Parameters<typeof transformLiveQuizResponse>[0])
    expect(numerical[23]).toBe('42') // response_value

    const selection = transformLiveQuizResponse({
      ...base,
      instance: { ...base.instance, elementType: 'SELECTION' },
      response: { selection: [1, 4, 5] },
    } as unknown as Parameters<typeof transformLiveQuizResponse>[0])
    expect(selection[24]).toBe('1,4,5') // response_selection
  })

  it('exports live quizzes and element instances with full untruncated content', () => {
    const quiz = {
      id: 'lq-1',
      name: 'Quiz',
      displayName: 'Quiz Display',
      status: 'PUBLISHED',
      isAssessmentEnabled: true,
      isGamificationEnabled: false,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      maxBonusPoints: 45,
      pointsMultiplier: 1,
      startedAt: null,
      finishedAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    } as unknown as Parameters<typeof transformLiveQuiz>[0]
    expect(transformLiveQuiz(quiz)).toHaveLength(LIVE_QUIZ_HEADERS.length)

    const longContent = 'x'.repeat(250)
    const instance = {
      id: 7,
      order: 2,
      elementId: 99,
      elementType: 'SC',
      elementData: {
        name: 'Element',
        content: longContent,
        options: { choices: [{ ix: 0, value: 'a', correct: true }] },
      },
      options: { basePoints: false, pointsMultiplier: 3 },
      isVersionOutdated: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      elementBlock: {
        id: 5,
        order: 1,
        liveQuiz: { id: 'lq-1', name: 'Quiz', displayName: null },
      },
    } as unknown as Parameters<typeof transformElementInstance>[0]
    const out = transformElementInstance(instance)
    expect(out).toHaveLength(ELEMENT_INSTANCE_HEADERS.length)
    expect(out[9]).toBe(longContent) // elementContent untruncated (250 chars)
    expect(out[10]).toBe(false) // instanceBasePointsEnabled
    expect(out[11]).toBe(3) // instancePointsMultiplier
  })

  it('freezes the header row and enables filters on workbook sheets', async () => {
    const outputDir = await createTempDir()
    const outputPath = await writeCombinedWorkbook(
      [createCourseExportResult('Course A 2026')],
      outputDir
    )
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(outputPath)
    for (const sheet of workbook.worksheets) {
      expect(sheet.views?.[0]?.state).toBe('frozen')
      // autoFilter is only set on sheets with data; when present its range must
      // span the data rows (not header-only), else Excel flags it for repair.
      if (sheet.rowCount > 1) {
        const ref = String(sheet.autoFilter)
        expect(ref).toBeTruthy()
        const lastRow = Number(ref.match(/(\d+)$/)?.[1])
        expect(lastRow).toBe(sheet.rowCount)
      }
    }
  })

  it('writes a manifest with checksums, counts, scope, and data dictionary', async () => {
    const outputDir = await createTempDir()
    await writeFile(join(outputDir, 'responses.csv'), 'a\n1\n')
    await writeFile(join(outputDir, 'export.xlsx'), 'binary')

    const manifestPath = await writeManifest(outputDir, {
      courseId: 'course-1',
      courseName: 'Course',
      exportedAt: '2026-01-01T00:00:00.000Z',
      packageVersion: '3.4.0',
      piiMode: 'full',
      counts: {
        liveQuizResponses: 1,
        participants: 0,
        invitations: 0,
        corrections: 0,
        liveQuizzes: 0,
        elementInstances: 0,
      },
      files: ['responses.csv', 'export.xlsx'],
    })

    expect(manifestPath.endsWith('manifest.json')).toBe(true)
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    expect(manifest.schemaVersion).toBe(1)
    expect(manifest.piiMode).toBe('full')
    expect(Object.keys(manifest.files)).toEqual([
      'responses.csv',
      'export.xlsx',
    ])
    expect(manifest.files['responses.csv'].sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(manifest.counts.liveQuizResponses).toBe(1)
    expect(manifest.dataDictionary.responses.blockExecution).toBeTruthy()
    expect(manifest.scope.excluded.length).toBeGreaterThan(0)
    expect(statSync(manifestPath).mode & 0o777).toBe(0o600)
  })

  it('computeSha256 matches the known digest of file content', async () => {
    const outputDir = await createTempDir()
    const filePath = join(outputDir, 'hello.txt')
    await writeFile(filePath, 'hello')
    // echo -n hello | sha256sum
    expect(await computeSha256(filePath)).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
    )
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
      "﻿value\n'=2+2\n'+SUM(A1:A2)\n'-10\n'@cmd\n' =2+2\n'\t=2+2\n"
    )
  })

  it('prepends a UTF-8 BOM to CSV output', async () => {
    const outputDir = await createTempDir()
    const filePath = join(outputDir, 'bom.csv')
    await writeCsv(filePath, ['value'], [['1']])
    const buf = await readFile(filePath)
    expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf])
  })

  it('normalizes embedded newlines so each row is one physical line', async () => {
    const outputDir = await createTempDir()
    const filePath = join(outputDir, 'newlines.csv')
    await writeCsv(filePath, ['value'], [['line1\nline2'], ['a\r\nb']])
    const text = await readFile(filePath, 'utf8')
    // BOM+header line, row1, row2, trailing newline -> 3 physical lines + ''
    expect(text.split('\n')).toHaveLength(4)
    expect(text).not.toMatch(/[\r]/)
    expect(text).toContain('line1 line2')
    expect(text).toContain('a b')
  })
})
