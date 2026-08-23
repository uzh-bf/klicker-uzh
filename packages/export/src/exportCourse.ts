import { chmodSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

import ExcelJS from 'exceljs'
import {
  CORRECTION_HEADERS,
  fetchCorrections,
  transformCorrection,
} from './corrections.js'
import { writeCsv } from './csv.js'
import {
  ELEMENT_INSTANCE_DATE_COLUMNS,
  ELEMENT_INSTANCE_HEADERS,
  fetchElementInstances,
  transformElementInstance,
} from './elementInstances.js'
import {
  fetchInvitations,
  INVITATION_HEADERS,
  transformInvitation,
} from './invitations.js'
import {
  fetchLiveQuizResponses,
  LIVE_QUIZ_RESPONSE_DATE_COLUMNS,
  LIVE_QUIZ_RESPONSE_HEADERS,
  transformLiveQuizResponse,
} from './liveQuizResponses.js'
import {
  fetchLiveQuizzes,
  LIVE_QUIZ_DATE_COLUMNS,
  LIVE_QUIZ_HEADERS,
  transformLiveQuiz,
} from './liveQuizzes.js'
import { writeManifest } from './manifest.js'
import {
  fetchParticipants,
  PARTICIPANT_HEADERS,
  transformParticipant,
} from './participants.js'
import { FULL_PII, makePiiSalt, type PiiContext, type PiiMode } from './pii.js'
import type { ReadonlyPrismaClient } from './readonlyPrisma.js'

// 0-based date-column indices for sheets whose headers live in this file's flow.
const PARTICIPANT_DATE_COLUMNS = [6, 10]
const INVITATION_DATE_COLUMNS = [4, 5]
const CORRECTION_DATE_COLUMNS = [18]

export interface ExportOptions {
  /** `full` (default) writes identifiers verbatim; `pseudonymize` hashes them. */
  piiMode?: PiiMode
  /** Optional per-run salt so identifiers stay joinable across courses in one run. */
  piiSalt?: string
  /** ISO-8601 export timestamp recorded in the manifest (defaults to now). */
  exportedAt?: string
  /** Package version recorded in the manifest (defaults to 'unknown'). */
  packageVersion?: string
}

export interface CourseExportResult {
  outputPath: string
  courseName: string
  manifestPath: string
  counts: {
    liveQuizResponses: number
    participants: number
    invitations: number
    corrections: number
    liveQuizzes: number
    elementInstances: number
  }
  data: {
    liveQuizRows: unknown[][]
    participantRows: unknown[][]
    invitationRows: unknown[][]
    correctionRows: unknown[][]
    liveQuizDimRows: unknown[][]
    elementInstanceRows: unknown[][]
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
  const exportedAt = options.exportedAt ?? new Date().toISOString()
  const packageVersion = options.packageVersion ?? 'unknown'
  const piiCtx: PiiContext =
    piiMode === 'pseudonymize'
      ? { mode: 'pseudonymize', salt: options.piiSalt ?? makePiiSalt() }
      : FULL_PII

  console.log(
    'Scope: live-quiz responses, participants, invitations, corrections only ' +
      '(no practice-quiz / microlearning / group-activity responses).'
  )
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

  const [
    liveQuizResponses,
    participants,
    invitations,
    corrections,
    liveQuizzes,
    elementInstances,
  ] = await Promise.all([
    fetchLiveQuizResponses(prisma, courseId),
    fetchParticipants(prisma, courseId),
    fetchInvitations(prisma, courseId),
    fetchCorrections(prisma, courseId),
    fetchLiveQuizzes(prisma, courseId),
    fetchElementInstances(prisma, courseId),
  ])

  const liveQuizRows = liveQuizResponses.map((r) =>
    transformLiveQuizResponse(r, piiCtx)
  )
  const participantRows = participants.map((r) =>
    transformParticipant(r, piiCtx)
  )
  const invitationRows = invitations.map((r) => transformInvitation(r, piiCtx))
  const correctionRows = corrections.map((r) => transformCorrection(r, piiCtx))
  // Dimension sheets carry no participant PII, so they need no pii context.
  const liveQuizDimRows = liveQuizzes.map(transformLiveQuiz)
  const elementInstanceRows = elementInstances.map(transformElementInstance)

  // Write CSVs (created 0600; chmod backstop below in case of a permissive umask)
  const csvFiles = [
    'responses.csv',
    'participants.csv',
    'invitations.csv',
    'corrections.csv',
    'live_quizzes.csv',
    'element_instances.csv',
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
    writeCsv(
      join(outputPath, 'live_quizzes.csv'),
      LIVE_QUIZ_HEADERS,
      liveQuizDimRows
    ),
    writeCsv(
      join(outputPath, 'element_instances.csv'),
      ELEMENT_INSTANCE_HEADERS,
      elementInstanceRows
    ),
  ])
  for (const f of csvFiles) {
    chmodSync(join(outputPath, f), 0o600)
  }

  // Write XLSX workbook (RESPONSES stays the primary tab; dimensions trail)
  const workbook = new ExcelJS.Workbook()
  addSheet(
    workbook,
    'RESPONSES',
    LIVE_QUIZ_RESPONSE_HEADERS,
    liveQuizRows,
    LIVE_QUIZ_RESPONSE_DATE_COLUMNS
  )
  addSheet(
    workbook,
    'PARTICIPANTS',
    PARTICIPANT_HEADERS,
    participantRows,
    PARTICIPANT_DATE_COLUMNS
  )
  addSheet(
    workbook,
    'INVITATIONS',
    INVITATION_HEADERS,
    invitationRows,
    INVITATION_DATE_COLUMNS
  )
  addSheet(
    workbook,
    'CORRECTIONS',
    CORRECTION_HEADERS,
    correctionRows,
    CORRECTION_DATE_COLUMNS
  )
  addSheet(
    workbook,
    'LIVE_QUIZZES',
    LIVE_QUIZ_HEADERS,
    liveQuizDimRows,
    LIVE_QUIZ_DATE_COLUMNS
  )
  addSheet(
    workbook,
    'ELEMENT_INSTANCES',
    ELEMENT_INSTANCE_HEADERS,
    elementInstanceRows,
    ELEMENT_INSTANCE_DATE_COLUMNS
  )
  const xlsxPath = join(outputPath, 'export.xlsx')
  await workbook.xlsx.writeFile(xlsxPath)
  chmodSync(xlsxPath, 0o600)

  const counts = {
    liveQuizResponses: liveQuizResponses.length,
    participants: participants.length,
    invitations: invitations.length,
    corrections: corrections.length,
    liveQuizzes: liveQuizzes.length,
    elementInstances: elementInstances.length,
  }

  console.log(
    `Wrote ${counts.liveQuizResponses} responses, ${counts.participants} participants, ${counts.invitations} invitations, ${counts.corrections} corrections, ${counts.liveQuizzes} live quizzes, ${counts.elementInstances} element instances`
  )

  const manifestPath = await writeManifest(outputPath, {
    courseId: course.id,
    courseName,
    exportedAt,
    packageVersion,
    piiMode,
    counts,
    files: [...csvFiles, 'export.xlsx'],
  })
  console.log(`  Manifest: ${manifestPath}`)

  return {
    outputPath,
    courseName,
    manifestPath,
    counts,
    data: {
      liveQuizRows,
      participantRows,
      invitationRows,
      correctionRows,
      liveQuizDimRows,
      elementInstanceRows,
    },
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
      result.data.liveQuizRows,
      LIVE_QUIZ_RESPONSE_DATE_COLUMNS
    )
    addSheet(
      workbook,
      createUniqueSheetName(usedSheetNames, result.courseName, 'PART'),
      PARTICIPANT_HEADERS,
      result.data.participantRows,
      PARTICIPANT_DATE_COLUMNS
    )
    addSheet(
      workbook,
      createUniqueSheetName(usedSheetNames, result.courseName, 'INV'),
      INVITATION_HEADERS,
      result.data.invitationRows,
      INVITATION_DATE_COLUMNS
    )
    addSheet(
      workbook,
      createUniqueSheetName(usedSheetNames, result.courseName, 'CORR'),
      CORRECTION_HEADERS,
      result.data.correctionRows,
      CORRECTION_DATE_COLUMNS
    )
    addSheet(
      workbook,
      createUniqueSheetName(usedSheetNames, result.courseName, 'LQ'),
      LIVE_QUIZ_HEADERS,
      result.data.liveQuizDimRows,
      LIVE_QUIZ_DATE_COLUMNS
    )
    addSheet(
      workbook,
      createUniqueSheetName(usedSheetNames, result.courseName, 'EI'),
      ELEMENT_INSTANCE_HEADERS,
      result.data.elementInstanceRows,
      ELEMENT_INSTANCE_DATE_COLUMNS
    )
  }

  // The combined workbook sits directly in outputDir (not a per-course 0700
  // subdir), so lock outputDir to owner-only first. That closes the umask
  // window between writeFile (default mode) and the chmod backstop below.
  mkdirSync(outputDir, { recursive: true, mode: 0o700 })
  chmodSync(outputDir, 0o700)

  const outputPath = join(outputDir, 'combined-export.xlsx')
  await workbook.xlsx.writeFile(outputPath)
  chmodSync(outputPath, 0o600)
  return outputPath
}

function addSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  headers: string[],
  rows: unknown[][],
  dateColumnIndices: number[] = []
) {
  const sheet = workbook.addWorksheet(sheetName)
  sheet.columns = headers.map((header) => ({
    header,
    key: header,
    width: Math.max(header.length + 2, 15),
  }))

  const dateCols = new Set(dateColumnIndices)
  for (const idx of dateCols) {
    sheet.getColumn(idx + 1).numFmt = 'yyyy-mm-dd hh:mm:ss'
  }

  for (const row of rows) {
    // Convert ISO date strings to Date objects for the configured columns so
    // Excel treats them as real dates; the CSV path keeps the ISO strings.
    const mapped = dateCols.size
      ? row.map((value, i) =>
          dateCols.has(i) && typeof value === 'string' && value !== ''
            ? new Date(value)
            : value
        )
      : row
    sheet.addRow(mapped)
  }

  // Freeze the header row.
  sheet.views = [{ state: 'frozen', ySplit: 1 }]

  // Enable per-column filtering across the FULL data range. The range must
  // include the data rows: a header-only range (to.row === 1) or a filter on
  // an empty sheet makes Excel flag the workbook as needing repair on open.
  if (rows.length > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: rows.length + 1, column: headers.length },
    }
  }
}
