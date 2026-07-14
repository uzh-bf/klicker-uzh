import { createOperationsPrisma } from '../lib/importExportOperations/database.js'
import { createImportExportInspectionOutput } from '../lib/importExportOperations/inspection.js'
import { runOperationCli } from '../lib/importExportOperations/runtime.js'

const exitCode = await runOperationCli('import-export-inspect', async () => {
  const prisma = createOperationsPrisma()
  try {
    return await createImportExportInspectionOutput({ prisma })
  } finally {
    await prisma.$disconnect()
  }
})
process.exitCode = exitCode
