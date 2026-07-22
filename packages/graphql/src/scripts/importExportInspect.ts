import { createOperationsPrisma } from '../lib/importExportOperations/database.js'
import { createImportExportInspectionOutput } from '../lib/importExportOperations/inspection.js'
import { runOperationCli } from '../lib/importExportOperations/runtime.js'

const requireReady =
  process.env.IMPORT_EXPORT_INSPECTION_REQUIRE_READY === 'true'
const exitCode = await runOperationCli(
  requireReady ? 'import-export-readiness' : 'import-export-inspect',
  async () => {
    const prisma = createOperationsPrisma()
    try {
      return await createImportExportInspectionOutput({
        prisma,
        requireReady,
      })
    } finally {
      await prisma.$disconnect()
    }
  }
)
process.exitCode = exitCode
