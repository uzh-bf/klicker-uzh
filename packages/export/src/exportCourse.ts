import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

import ExcelJS from 'exceljs'
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
  outputDir: string
): Promise<CourseExportResult> {
  const course = await prisma.course.findUniqueOrThrow({
    where: { id: courseId },
    select: { id: true, name: true, displayName: true },
  })

  const folderName = `${sanitizeName(course.displayName || course.name)}_${course.id}`
  const outputPath = join(outputDir, folderName)
  mkdirSync(outputPath, { recursive: true })

  console.log(`Exporting course "${course.displayName}" (${course.id})...`)

  const [liveQuizResponses, participants, invitations, corrections] =
    await Promise.all([
      fetchLiveQuizResponses(prisma, courseId),
      fetchParticipants(prisma, courseId),
      fetchInvitations(prisma, courseId),
      fetchCorrections(prisma, courseId),
    ])

  const liveQuizRows = liveQuizResponses.map(transformLiveQuizResponse)
  const participantRows = participants.map(transformParticipant)
  const invitationRows = invitations.map(transformInvitation)
  const correctionRows = corrections.map(transformCorrection)

  // Write CSVs
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

  // Write XLSX workbook
  const workbook = new ExcelJS.Workbook()
  addSheet(workbook, 'RESPONSES', LIVE_QUIZ_RESPONSE_HEADERS, liveQuizRows)
  addSheet(workbook, 'PARTICIPANTS', PARTICIPANT_HEADERS, participantRows)
  addSheet(workbook, 'INVITATIONS', INVITATION_HEADERS, invitationRows)
  addSheet(workbook, 'CORRECTIONS', CORRECTION_HEADERS, correctionRows)
  await workbook.xlsx.writeFile(join(outputPath, 'export.xlsx'))

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
    courseName: course.displayName || course.name,
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
