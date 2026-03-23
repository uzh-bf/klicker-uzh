import { prisma } from '@klicker-uzh/prisma'

import {
  type CourseExportResult,
  exportCourseData,
  writeCombinedWorkbook,
} from '../exportCourse.js'
import '../prismaTypes.js'
import { createReadonlyClient } from '../readonlyPrisma.js'

const readonlyPrisma = createReadonlyClient(prisma)

const args = process.argv.slice(2)

// Collect all --courseId values
const courseIds: string[] = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--courseId' && i + 1 < args.length) {
    courseIds.push(args[i + 1]!)
    i++
  }
}

const outputDirIdx = args.indexOf('--outputDir')
const outputDir =
  (outputDirIdx !== -1 ? args[outputDirIdx + 1] : undefined) ??
  './export-output'

if (courseIds.length === 0) {
  console.error(
    'Usage: tsx src/scripts/export-course.ts --courseId <uuid> [--courseId <uuid2> ...] [--outputDir <path>]'
  )
  process.exit(1)
}

try {
  const results: CourseExportResult[] = []

  for (const courseId of courseIds) {
    const result = await exportCourseData(readonlyPrisma, courseId, outputDir)
    console.log(`Export complete: ${result.outputPath}`)
    console.log(`  LiveQuiz responses: ${result.counts.liveQuizResponses}`)
    console.log(`  Participants: ${result.counts.participants}`)
    console.log(`  Invitations: ${result.counts.invitations}`)
    console.log(`  Corrections: ${result.counts.corrections}`)
    results.push(result)
  }

  if (results.length > 1) {
    const combinedPath = await writeCombinedWorkbook(results, outputDir)
    console.log(`\nCombined workbook: ${combinedPath}`)
  }

  console.log(`\nDone. Exported ${results.length} course(s).`)
} finally {
  await prisma.$disconnect()
}
