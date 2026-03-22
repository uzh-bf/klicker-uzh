import { prisma } from '@klicker-uzh/prisma'

import { exportCourseData } from '../exportCourse.js'
import '../prismaTypes.js'

const args = process.argv.slice(2)
const courseIdIdx = args.indexOf('--courseId')
const outputDirIdx = args.indexOf('--outputDir')

const courseId = courseIdIdx !== -1 ? args[courseIdIdx + 1] : undefined
const outputDir =
  (outputDirIdx !== -1 ? args[outputDirIdx + 1] : undefined) ??
  './export-output'

if (!courseId) {
  console.error(
    'Usage: tsx src/scripts/export-course.ts --courseId <uuid> [--outputDir <path>]'
  )
  process.exit(1)
}

try {
  const result = await exportCourseData(prisma, courseId as string, outputDir)
  console.log(`Export complete: ${result.outputPath}`)
  console.log(`LiveQuiz responses: ${result.counts.liveQuizResponses}`)
  console.log(`Participants: ${result.counts.participants}`)
  console.log(`Invitations: ${result.counts.invitations}`)
} finally {
  await prisma.$disconnect()
}
