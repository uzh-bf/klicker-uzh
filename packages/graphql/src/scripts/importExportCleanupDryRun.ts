import { runRecoveryCli } from '../lib/importExportOperations/recovery.js'
import { runOperationCli } from '../lib/importExportOperations/runtime.js'

const exitCode = await runOperationCli(
  'import-export-cleanup-dry-run',
  async () => await runRecoveryCli('cleanup')
)
process.exitCode = exitCode
