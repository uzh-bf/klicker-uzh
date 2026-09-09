import { createOperationsPrisma } from '../lib/importExportOperations/database.js'
import { createImportExportBackfillVerificationOutput } from '../lib/importExportOperations/inspection.js'
import { runOperationCli } from '../lib/importExportOperations/runtime.js'

const exitCode = await runOperationCli(
  'import-export-backfill-verify',
  async () => {
    const prisma = createOperationsPrisma()
    try {
      return await createImportExportBackfillVerificationOutput({ prisma })
    } finally {
      await prisma.$disconnect()
    }
  }
)
process.exitCode = exitCode
