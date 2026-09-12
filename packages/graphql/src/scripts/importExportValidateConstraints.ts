import {
  createOperationsPrisma,
  withAdvisoryLock,
} from '../lib/importExportOperations/database.js'
import {
  createOperationOutput,
  requireMasterGateOff,
  runOperationCli,
} from '../lib/importExportOperations/runtime.js'

const CONSTRAINT_VALIDATION_STATEMENTS = [
  'ALTER TABLE "public"."MediaFile" VALIDATE CONSTRAINT "MediaFile_contentHash_check"',
  'ALTER TABLE "public"."MediaFile" VALIDATE CONSTRAINT "MediaFile_importFingerprintVersion_check"',
  'ALTER TABLE "public"."Element" VALIDATE CONSTRAINT "Element_importFingerprintVersion_check"',
  'ALTER TABLE "public"."AnswerCollection" VALIDATE CONSTRAINT "AnswerCollection_importFingerprintVersion_check"',
] as const

const exitCode = await runOperationCli(
  'import-export-validate-constraints',
  async () => {
    requireMasterGateOff()
    const prisma = createOperationsPrisma()
    try {
      return await withAdvisoryLock({
        prisma,
        run: async (assertLockHeld) => {
          assertLockHeld()
          await prisma.$executeRawUnsafe(`SET lock_timeout = '5s'`)
          await prisma.$executeRawUnsafe(`SET statement_timeout = '60s'`)
          for (const statement of CONSTRAINT_VALIDATION_STATEMENTS) {
            assertLockHeld()
            await prisma.$executeRawUnsafe(statement)
          }
          assertLockHeld()
          return createOperationOutput('import-export-validate-constraints', {
            outcome: 'success',
            code: 'CONSTRAINT_VALIDATION_COMPLETE',
            counts: {
              validatedConstraints: CONSTRAINT_VALIDATION_STATEMENTS.length,
            },
            checks: { advisoryLockHeld: true, masterGateOff: true },
          })
        },
      })
    } finally {
      await prisma.$disconnect()
    }
  }
)
process.exitCode = exitCode
