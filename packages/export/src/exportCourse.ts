import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

import type { PrismaClient } from '@klicker-uzh/prisma/client'
import ExcelJS from 'exceljs'

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

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 80)
}

export async function exportCourseData(
  prisma: PrismaClient,
  courseId: string,
  outputDir: string
): Promise<{
  outputPath: string
  counts: {
    liveQuizResponses: number
    participants: number
    invitations: number
  }
}> {
  const course = await prisma.course.findUniqueOrThrow({
    where: { id: courseId },
    select: { id: true, name: true, displayName: true },
  })

  const folderName = `${sanitizeName(course.displayName || course.name)}_${course.id}`
  const outputPath = join(outputDir, folderName)
  mkdirSync(outputPath, { recursive: true })

  console.log(`Exporting course "${course.displayName}" (${course.id})...`)

  // Fetch all data
  const [liveQuizResponses, participants, invitations] = await Promise.all([
    fetchLiveQuizResponses(prisma, courseId),
    fetchParticipants(prisma, courseId),
    fetchInvitations(prisma, courseId),
  ])

  const liveQuizRows = liveQuizResponses.map(transformLiveQuizResponse)
  const participantRows = participants.map(transformParticipant)
  const invitationRows = invitations.map(transformInvitation)

  // Write CSVs
  await Promise.all([
    writeCsv(
      join(outputPath, 'responses-livequiz.csv'),
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
  ])

  // Write XLSX workbook
  const workbook = new ExcelJS.Workbook()

  addSheet(
    workbook,
    'LiveQuiz Responses',
    LIVE_QUIZ_RESPONSE_HEADERS,
    liveQuizRows
  )
  addSheet(workbook, 'Participants', PARTICIPANT_HEADERS, participantRows)
  addSheet(workbook, 'Invitations', INVITATION_HEADERS, invitationRows)

  await workbook.xlsx.writeFile(join(outputPath, 'export.xlsx'))

  const counts = {
    liveQuizResponses: liveQuizResponses.length,
    participants: participants.length,
    invitations: invitations.length,
  }

  console.log(
    `Wrote ${counts.liveQuizResponses} responses, ${counts.participants} participants, ${counts.invitations} invitations`
  )

  return { outputPath, counts }
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
