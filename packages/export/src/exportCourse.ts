import { chmodSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

import ExcelJS from 'exceljs'
import { type PiiContext, type PiiMode, FULL_PII, makePiiSalt } from './pii.js'
import type { ReadonlyPrismaClient } from './readonlyPrisma.js'

import {
  CORRECTION_HEADERS,
  fetchCorrections,
  transformCorrection,
} from './corrections.js'
import { writeCsv } from './csv.js'
import {
  INVITATION_HEADERS,
  fetchInvitations,
  transformInvitation,
} from './invitations.js'
import {
  LIVE_QUIZ_RESPONSE_HEADERS,
  fetchLiveQuizResponses,
  transformLiveQuizResponse,
} from './liveQuizResponses.js'
import {
  PARTICIPANT_HEADERS,
  fetchParticipants,
  transformParticipant,
} from './participants.js'

export interface ExportOptions {
  /** `full` (default) writes identifiers verbatim; `pseudonymize` hashes them. */
  piiMode?: PiiMode
  /** Optional per-run salt so identifiers stay joinable across courses in one run. */
  piiSalt?: string
}

export interface CourseExportResult {
  outputPath: string
  courseName: string
  counts: {
    liveQuizResponses: number
    participants: number
    invitations: number
    corrections: number
  }
  data: {
    liveQuizRows: unknown[][]
    participantRows: unknown[][]
    invitationRows: unknown[][]
    correctionRows: unknown[][]
  }
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 80)
}

function sanitizeSheetPrefix(name: string): string {
  return name
    .replace(/[*?:\\/[\]]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function createUniqueSheetName(
  usedNames: Set<string>,
  courseName: string,
  suffix: string
): string {
  const baseName = sanitizeSheetPrefix(courseName) || 'Course'
  let counter = 1

  while (true) {
    const counterSuffix = counter === 1 ? '' : ` ${counter}`
    const maxBaseLength = 31 - suffix.length - counterSuffix.length - 1
    const truncatedBase =
      baseName.substring(0, maxBaseLength).trimEnd() || 'Course'
    const sheetName = `${truncatedBase} ${suffix}${counterSuffix}`
    const normalizedSheetName = sheetName.toLowerCase()

    if (!usedNames.has(normalizedSheetName)) {
      usedNames.add(normalizedSheetName)
      return sheetName
    }

    counter++
  }
}

export async function exportCourseData(
  prisma: ReadonlyPrismaClient,
  courseId: string,
  outputDir: string,
  options: ExportOptions = {}
): Promise<CourseExportResult> {
  const piiMode: PiiMode = options.piiMode ?? 'full'
  const piiCtx: PiiContext =
    piiMode === 'pseudonymize'
      ? { mode: 'pseudonymize', salt: options.piiSalt ?? makePiiSalt() }
      : FULL_PII

  if (piiMode === 'full') {
    console.warn(
      'WARNING: export contains PII (email, sso id/email, matriculation number, free-text answers, raw response JSON). ' +
        'Output is restricted to owner-only (0600/0700). Pass --pseudonymize to de-identify direct identifiers.'
    )
  } else {
    console.log('PII mode: pseudonymize (per-run HMAC-SHA256 salt).')
  }

  const course = await prisma.course.findUniqueOrThrow({
    where: { id: courseId },
    select: { id: true, name: true, displayName: true },
  })

  const folderName = `${sanitizeName(course.displayName || course.name)}_${course.id}`
  const outputPath = join(outputDir, folderName)
  mkdirSync(outputPath, { recursive: true, mode: 0o700 })

  const courseName = course.displayName || course.name

  console.log(`Exporting course "${courseName}" (${course.id})...`)

  const [liveQuizResponses, participants, invitations, corrections] =
    await Promise.all([
      fetchLiveQuizResponses(prisma, courseId),
      fetchParticipants(prisma, courseId),
      fetchInvitations(prisma, courseId),
      fetchCorrections(prisma, courseId),
    ])

  const liveQuizRows = liveQuizResponses.map((r) =>
    transformLiveQuizResponse(r, piiCtx)
  )
  const participantRows = participants.map((r) =>
    transformParticipant(r, piiCtx)
  )
  const invitationRows = invitations.map((r) => transformInvitation(r, piiCtx))
  const correctionRows = corrections.map((r) => transformCorrection(r, piiCtx))

  // Write CSVs (created 0600; chmod backstop below in case of a permissive umask)
  const csvFiles = [
    'responses.csv',
    'participants.csv',
    'invitations.csv',
    'corrections.csv',
  ]
  await Promise.all([
    writeCsv(
      join(outputPath, 'responses.csv'),
      LIVE_QUIZ_RESPONSE_HEADERS,
      liveQuizRows
    ),
    writeCsv(
      join(outputPath, 'participants.csv'),
      PARTICIPANT_HEADERS,
      participantRows
    ),
    writeCsv(
      join(outputPath, 'invitations.csv'),
      INVITATION_HEADERS,
      invitationRows
    ),
    writeCsv(
      join(outputPath, 'corrections.csv'),
      CORRECTION_HEADERS,
      correctionRows
    ),
  ])
  for (const f of csvFiles) {
    chmodSync(join(outputPath, f), 0o600)
  }

  // Write XLSX workbook
  const workbook = new ExcelJS.Workbook()
  addSheet(workbook, 'RESPONSES', LIVE_QUIZ_RESPONSE_HEADERS, liveQuizRows)
  addSheet(workbook, 'PARTICIPANTS', PARTICIPANT_HEADERS, participantRows)
  addSheet(workbook, 'INVITATIONS', INVITATION_HEADERS, invitationRows)
  addSheet(workbook, 'CORRECTIONS', CORRECTION_HEADERS, correctionRows)
  const xlsxPath = join(outputPath, 'export.xlsx')
  await workbook.xlsx.writeFile(xlsxPath)
  chmodSync(xlsxPath, 0o600)

  const counts = {
    liveQuizResponses: liveQuizResponses.length,
    participants: participants.length,
    invitations: invitations.length,
    corrections: corrections.length,
  }

  console.log(
    `Wrote ${counts.liveQuizResponses} responses, ${counts.participants} participants, ${counts.invitations} invitations, ${counts.corrections} corrections`
  )

  return {
    outputPath,
    courseName,
    counts,
    data: { liveQuizRows, participantRows, invitationRows, correctionRows },
  }
}

export async function writeCombinedWorkbook(
  results: CourseExportResult[],
  outputDir: string
): Promise<string> {
  const workbook = new ExcelJS.Workbook()
  const usedSheetNames = new Set<string>()

  for (const result of results) {
    addSheet(
      workbook,
      createUniqueSheetName(usedSheetNames, result.courseName, 'RESP'),
      LIVE_QUIZ_RESPONSE_HEADERS,
      result.data.liveQuizRows
    )
    addSheet(
      workbook,
      createUniqueSheetName(usedSheetNames, result.courseName, 'PART'),
      PARTICIPANT_HEADERS,
      result.data.participantRows
    )
    addSheet(
      workbook,
      createUniqueSheetName(usedSheetNames, result.courseName, 'INV'),
      INVITATION_HEADERS,
      result.data.invitationRows
    )
    addSheet(
      workbook,
      createUniqueSheetName(usedSheetNames, result.courseName, 'CORR'),
      CORRECTION_HEADERS,
      result.data.correctionRows
    )
  }

  const outputPath = join(outputDir, 'combined-export.xlsx')
  await workbook.xlsx.writeFile(outputPath)
  chmodSync(outputPath, 0o600)
  return outputPath
}

function addSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  headers: string[],
  rows: unknown[][]
) {
  const sheet = workbook.addWorksheet(sheetName)
  sheet.columns = headers.map((header) => ({
    header,
    key: header,
    width: Math.max(header.length + 2, 15),
  }))
  for (const row of rows) {
    sheet.addRow(row)
  }
}
