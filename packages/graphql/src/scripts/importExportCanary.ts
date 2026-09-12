import { runRecoveryCli } from '../lib/importExportOperations/recovery.js'
import { runOperationCli } from '../lib/importExportOperations/runtime.js'

const exitCode = await runOperationCli(
  'import-export-canary',
  async () => await runRecoveryCli('canary')
)
process.exitCode = exitCode
