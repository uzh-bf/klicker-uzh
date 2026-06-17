import { createRequire } from 'node:module'

import { prisma } from '@klicker-uzh/prisma'

import {
  CliUsageError,
  EXPORT_COURSE_USAGE,
  parseExportCourseArgs,
} from '../cli.js'
import {
  type CourseExportResult,
  exportCourseData,
  writeCombinedWorkbook,
} from '../exportCourse.js'
import { makePiiSalt } from '../pii.js'
import '../prismaTypes.js'
import { createReadonlyClient } from '../readonlyPrisma.js'

const readonlyPrisma = createReadonlyClient(prisma)

try {
  const { courseIds, outputDir, pseudonymize } = parseExportCourseArgs(
    process.argv.slice(2)
  )
  // One salt for the whole run so a participant maps to the same token across courses.
  const piiSalt = pseudonymize ? makePiiSalt() : undefined
  const exportedAt = new Date().toISOString()
  const { version: packageVersion } = createRequire(import.meta.url)(
    '../../package.json'
  ) as { version: string }
  const results: CourseExportResult[] = []

  for (const courseId of courseIds) {
    const result = await exportCourseData(readonlyPrisma, courseId, outputDir, {
      piiMode: pseudonymize ? 'pseudonymize' : 'full',
      piiSalt,
      exportedAt,
      packageVersion,
    })
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
} catch (error) {
  if (error instanceof CliUsageError) {
    console.error(error.message)
    if (error.message !== EXPORT_COURSE_USAGE) {
      console.error(EXPORT_COURSE_USAGE)
    }
    process.exit(1)
  }

  throw error
} finally {
  await prisma.$disconnect()
}
